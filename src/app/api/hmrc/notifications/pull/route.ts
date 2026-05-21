import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../../lib/hmrc-config";
import { parseHmrcNotification } from "../../../../../lib/hmrc-notification-parser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/hmrc/notifications/pull?conversationId={id}
 * Pull notifications from HMRC's Pull Notifications API.
 * HMRC ref: Pull Notifications API v1.0
 * Two-step: 1) List unpulled by conversationId  2) Retrieve each notification
 * Notifications remain in queue for 14 days.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId query parameter" }, { status: 400 });
    }

    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    if (!tokenRecord?.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found." }, { status: 403 });
    }

    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;

    // Step 1: Get list of unpulled notification IDs for this conversation
    const listUrl = `${hmrcBase}/notifications/conversationId/${encodeURIComponent(conversationId)}/unpulled`;
    const listResponse = await fetchHmrc(
      listUrl,
      {
        headers: {
          Accept: HMRC_CONFIG.accept.v1Xml,
        },
      },
      request,
      tokenRecord.accessToken
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("Pull notification list error:", listResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to list pull notifications", details: errorText },
        { status: listResponse.status }
      );
    }

    const listBody = await listResponse.text();

    // Parse notification IDs from XML response
    const notificationIds: string[] = [];
    const idRegex = /<(?:[^>]*:)?notification[^>]*href="[^"]*\/([^/"]+)"[^>]*\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = idRegex.exec(listBody)) !== null) {
      notificationIds.push(match[1]);
    }

    // Also try simpler ID extraction if the above doesn't match
    if (notificationIds.length === 0) {
      const simpleIdRegex = /<(?:[^>]*:)?(?:NotificationId|ID)[^>]*>([a-f0-9-]+)<\/(?:[^>]*:)?(?:NotificationId|ID)>/gi;
      while ((match = simpleIdRegex.exec(listBody)) !== null) {
        notificationIds.push(match[1]);
      }
    }

    // Step 2: Retrieve each notification
    const notifications: Array<{ id: string; body: string; status: number }> = [];
    for (const notifId of notificationIds) {
      const notifUrl = `${hmrcBase}/notifications/unpulled/${notifId}`;
      const notifResponse = await fetchHmrc(
        notifUrl,
        {
          headers: {
            Accept: HMRC_CONFIG.accept.v1Xml,
          },
        },
        request,
        tokenRecord.accessToken
      );

      const notifBody = await notifResponse.text();
      notifications.push({
        id: notifId,
        status: notifResponse.status,
        body: notifBody,
      });

      // Save each notification to Convex using same schema as push webhook
      if (notifResponse.ok) {
        const { notificationType, mrn, errorCodes, fieldErrors } = parseHmrcNotification(notifBody);
        console.log(`[HMRC-PULL] Parsed: type=${notificationType}, mrn=${mrn}, errorCodes=${errorCodes.join(",") || "none"}`);

        try {
          await convex.mutation(api.notifications.saveWebhook, {
            mrn,
            conversationId,
            notificationType,
            fieldErrors,
            errorCodes,
            rawPayload: notifBody,
            timestamp: new Date().toISOString(),
          });
        } catch (saveErr) {
          console.error("Failed to save pulled notification:", saveErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      conversationId,
      total: notificationIds.length,
      notifications,
    });
  } catch (error: unknown) {
    console.error("Pull notifications crash:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
