"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Find declarations stuck in Processing
    const stuckDeclarations: Array<{
      _id: string;
      userId: string;
      conversationId?: string | null;
    }> = await ctx.runQuery(internal.declarations.getStuckProcessingDeclarations, {
      olderThanMs: STUCK_THRESHOLD_MS,
    });

    if (stuckDeclarations.length === 0) return null;

    const HMRC_ENVIRONMENT = process.env.HMRC_ENVIRONMENT || "sandbox";
    const hmrcBase =
      HMRC_ENVIRONMENT === "sandbox"
        ? "https://test-api.service.hmrc.gov.uk"
        : "https://api.service.hmrc.gov.uk";

    for (const decl of stuckDeclarations) {
      if (!decl.conversationId) continue;

      // 2. Get the user's HMRC token
      const tokenRow: { accessToken?: string } | null = await ctx.runQuery(
        internal.declarations.getHmrcTokenForUser,
        { userId: decl.userId },
      );
      if (!tokenRow?.accessToken) continue;

      // 3. Pull notifications for this conversation
      try {
        const listUrl = `${hmrcBase}/customs/declarations/notifications/${encodeURIComponent(decl.conversationId)}`;
        const res = await fetch(listUrl, {
          headers: {
            Authorization: `Bearer ${tokenRow.accessToken}`,
            Accept: "application/vnd.hmrc.1.0+xml",
          },
        });
        if (!res.ok) {
          console.warn(`[RECOVER] Pull failed for ${decl._id}: ${res.status}`);
        } else {
          console.log(`[RECOVER] Pulled notifications for stuck declaration ${decl._id}`);
        }
      } catch (err) {
        console.warn(`[RECOVER] Error for ${decl._id}:`, err);
      }
    }

    return null;
  },
});
