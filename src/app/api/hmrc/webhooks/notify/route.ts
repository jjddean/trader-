import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { parseHmrcNotification } from "../../../../../lib/hmrc-notification-parser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/hmrc/webhooks/notify
 * HMRC Push Notification endpoint (Trade Test v2.0 sandbox + production).
 * HMRC POSTs DMS* notifications here once a submitted declaration changes state.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const expectedToken =
      process.env.HMRC_WEBHOOK_AUTH_TOKEN ||
      process.env.HMRC_CDS_CALLBACK_TOKEN ||
      process.env.HMRC_CDS_BEARER_TOKEN ||
      "";
    const receivedToken = authHeader.replace(/^Bearer\s+/i, "");
    const authMatches =
      expectedToken.length > 0 &&
      (authHeader === expectedToken || receivedToken === expectedToken);

    if (expectedToken.length === 0) {
      console.error("[HMRC-WEBHOOK] Missing webhook auth token configuration.");
      return NextResponse.json({ error: "Webhook auth token not configured" }, { status: 500 });
    }

    if (!authMatches) {
      console.warn(`[HMRC-WEBHOOK] Unauthorized attempt. Received: ${authHeader.substring(0, 20)}...`);
      return new Response("Unauthorized", { status: 401 });
    }

    const rawPayload = await request.text();
    const conversationId = request.headers.get("X-Conversation-ID") || "UNKNOWN";

    console.log(`[HMRC-WEBHOOK] Received authorized notification for Conversation ID: ${conversationId}`);
    console.log(`[HMRC-WEBHOOK] Payload preview: ${rawPayload.substring(0, 500)}`);

    const { notificationType, mrn, errorCodes, fieldErrors } = parseHmrcNotification(rawPayload);
    console.log(`[HMRC-WEBHOOK] Parsed: type=${notificationType}, mrn=${mrn}, errorCodes=${errorCodes.join(",") || "none"}`);

    // Save to Convex for the dashboard to pick up
    await convex.mutation(api.notifications.saveWebhook, {
      mrn,
      conversationId,
      notificationType,
      fieldErrors,
      errorCodes,
      rawPayload,
      timestamp: new Date().toISOString(),
    });

    // Auto-ingest curated rule proposals when HMRC rejects (FunctionCode 03 /
    // DMSREJ) and cites missing AdditionalDocument codes. Inserted rules are
    // ALWAYS disabled — the user reviews and promotes manually so a misread
    // rejection can never auto-block a future submission. Failures here are
    // non-critical: the raw payload is already persisted via saveWebhook.
    if (notificationType === "DMSREJ" && fieldErrors.length > 0) {
      try {
        const proposalResult = await convex.mutation(
          api.rule_definitions.proposeCuratedFromRejection,
          { mrn, conversationId, fieldErrors },
        );
        console.log(`[HMRC-WEBHOOK] Curated rule proposals: ${JSON.stringify(proposalResult)}`);
      } catch (proposeErr) {
        console.warn("[HMRC-WEBHOOK] Curated proposal failed (non-critical):", proposeErr);
      }
    }

    // Provide the 200 OK that HMRC expects to acknowledge receipt
    return new Response(null, { status: 200 });
  } catch (error: unknown) {
    console.error("[HMRC-WEBHOOK] Crash:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
