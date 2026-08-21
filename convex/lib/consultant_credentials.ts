import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type ConsultantCredentialTerminalState = "completed" | "revoked" | "expired";

/**
 * Close every bearer credential derived from one consultant dispatch.
 *
 * A dispatch can have more than one review token when more than one handoff
 * was issued. A consultant can also have created an end-user link from any of
 * those tokens. Closing only the token used for completion leaves the other
 * credentials live, so terminal transitions use this shared path.
 */
export async function closeConsultantCredentials(
  ctx: MutationCtx,
  args: {
    expertRequestId: Id<"expert_requests">;
    assessmentId: Id<"export_assessments">;
    terminalState: ConsultantCredentialTerminalState;
    terminalAt: number;
  },
): Promise<void> {
  const reviewTokens = await ctx.db
    .query("export_review_tokens")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
    .collect();
  const relatedReviewTokens = reviewTokens.filter(
    (token) => token.expertRequestId === args.expertRequestId,
  );

  for (const token of relatedReviewTokens) {
    if (args.terminalState === "completed") {
      if (token.completedAt == null || !token.revoked) {
        await ctx.db.patch(token._id, {
          completedAt: token.completedAt ?? args.terminalAt,
          revoked: true,
        });
      }
    } else if (!token.revoked) {
      await ctx.db.patch(token._id, { revoked: true });
    }
  }

  const handoffs = await ctx.db
    .query("consultant_handoffs")
    .withIndex("by_expert_request", (q) => q.eq("expertRequestId", args.expertRequestId))
    .collect();
  for (const handoff of handoffs) {
    if (handoff.consumedAt == null) {
      await ctx.db.patch(handoff._id, { consumedAt: args.terminalAt });
    }
  }

  const reviewTokenIds = new Set(relatedReviewTokens.map((token) => String(token._id)));
  if (reviewTokenIds.size === 0) return;

  const endUserTokens = await ctx.db
    .query("export_end_user_tokens")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
    .collect();
  for (const token of endUserTokens) {
    if (
      token.reviewTokenId != null &&
      reviewTokenIds.has(String(token.reviewTokenId)) &&
      token.completedAt == null &&
      !token.revoked
    ) {
      await ctx.db.patch(token._id, { revoked: true });
    }
  }
}
