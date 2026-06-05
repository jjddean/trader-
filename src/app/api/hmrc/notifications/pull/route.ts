import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { pullHmrcNotificationsForConversation } from "../../../../../lib/hmrc-pull-notifications";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";

/**
 * GET /api/hmrc/notifications/pull?conversationId={id}
 * Pull notifications from HMRC's Pull Notifications API.
 * HMRC ref: Pull Notifications API v1.0
 * Two-step: 1) List unpulled by conversationId  2) Retrieve each notification
 * Notifications remain in queue for 14 days.
 */
export async function GET(request: Request) {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) {
      return session.error;
    }
    const { convex, userId } = session;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId query parameter" }, { status: 400 });
    }

    const tokenResult = await resolveHmrcAccessToken(convex, userId);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const result = await pullHmrcNotificationsForConversation({
      conversationId,
      accessToken: tokenResult.token,
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
