import { NextResponse } from "next/server";
import { pullHmrcNotificationsForDeclaration } from "../../../../../lib/hmrc-pull-notifications";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import {
  resolveOrgHmrcRoutingForDeclaration,
  resolveOrgHmrcRoutingForOrg,
} from "../../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { userMessageFromError } from "@/lib/convex-errors";

/**
 * GET /api/hmrc/notifications/pull?conversationId={id}
 * GET /api/hmrc/notifications/pull?declarationId={id}
 * Pull notifications from HMRC's Pull Notifications API.
 * HMRC ref: Pull Notifications API v1.0
 * Two-step: 1) List unpulled by conversationId  2) Retrieve each notification
 * Notifications remain in queue for 14 days.
 *
 * Prefer declarationId — pulls every conversation linked to the declaration
 * (submit + amend + cancel). conversationId alone remains for backward compatibility.
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
    const conversationId = searchParams.get("conversationId")?.trim() || "";
    const declarationIdParam = searchParams.get("declarationId")?.trim() || "";

    if (!conversationId && !declarationIdParam) {
      return NextResponse.json(
        { error: "Missing conversationId or declarationId query parameter" },
        { status: 400 },
      );
    }

    const orgRouting = declarationIdParam
      ? await resolveOrgHmrcRoutingForDeclaration(convex, declarationIdParam as Id<"declarations">)
      : await resolveOrgHmrcRoutingForOrg(convex, clerkAuth.orgId);
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    let conversationIds: string[] = [];
    if (declarationIdParam) {
      const ids = await convex.query(api.submissions.getDistinctConversationIds, {
        declarationId: declarationIdParam as Id<"declarations">,
      });
      conversationIds = [...ids];
      if (conversationId && !conversationIds.includes(conversationId)) {
        conversationIds.push(conversationId);
      }
    } else {
      conversationIds = [conversationId];
    }

    if (conversationIds.length === 0) {
      return NextResponse.json({
        success: true,
        saved: 0,
        total: 0,
        conversations: [],
        message: "No conversation IDs linked to this declaration yet.",
      });
    }

    const result = await pullHmrcNotificationsForDeclaration({
      conversationIds,
      accessToken: tokenResult.token,
      request,
      convex,
      hmrcContext,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("Pull notifications crash:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
