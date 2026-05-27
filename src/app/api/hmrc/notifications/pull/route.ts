import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { pullHmrcNotificationsForConversation } from "../../../../../lib/hmrc-pull-notifications";

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

    const result = await pullHmrcNotificationsForConversation({
      conversationId,
      accessToken: tokenRecord.accessToken,
      request,
      convex,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("Pull notifications crash:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
