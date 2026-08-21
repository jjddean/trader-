import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { userError } from "./user_errors";

/**
 * A consultant signs the dispatch snapshot, not a moving assessment. Sender
 * edits therefore require withdrawal while a review is open. A completed
 * review becomes historical as soon as a later material mutation commits.
 */
export async function assertNoOpenConsultantDispatch(
  ctx: MutationCtx,
  assessmentId: Id<"export_assessments">,
): Promise<void> {
  const requests = await ctx.db
    .query("expert_requests")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  const now = Date.now();
  const open = requests.some(
    (request) =>
      request.reasonCode === "consultant_dispatch" &&
      request.completedAt == null &&
      request.revokedAt == null &&
      request.deliveryStatus !== "revoked" &&
      request.deliveryStatus !== "expired" &&
      (request.expiresAt == null || request.expiresAt > now),
  );
  if (open) {
    throw userError(
      "assessment_locked_for_consultant_review",
      "Withdraw the active consultant review before changing this assessment",
    );
  }

  const identity = await ctx.auth.getUserIdentity();
  const actor = identity?.subject ?? "system";
  for (const request of requests) {
    if (
      request.reasonCode !== "consultant_dispatch" ||
      request.completedAt == null ||
      request.supersededAt != null
    ) {
      continue;
    }
    await ctx.db.patch(request._id, {
      status: "superseded",
      supersededAt: now,
      supersededBy: actor,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      userId: actor,
      action: "consultant_review_superseded",
      details: { assessmentId, expertRequestId: request._id },
      timestamp: now,
      archived: false,
    });
  }
}
