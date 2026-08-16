/**
 * Which statuses may start an amendment or cancellation.
 *
 * Pure so the rule is testable without a deployment. The claim exists to stop a
 * double-click or a retry over a slow HMRC response filing the same amendment
 * twice at CDS — the routes previously only set status after HMRC replied.
 */
export type FollowUpOperation = "amend" | "cancel";

export type FollowUpClaimResult =
  | { ok: true; nextStatus: "Amendment Processing" | "Cancellation Requested" }
  | { ok: false; reason: "in_flight" | "not_live" };

const IN_FLIGHT = ["Processing", "Amendment Processing", "Cancellation Requested"];
const LIVE = ["Accepted", "Amended"];

export function followUpClaim(
  status: string,
  operation: FollowUpOperation,
): FollowUpClaimResult {
  if (IN_FLIGHT.includes(status)) return { ok: false, reason: "in_flight" };

  // Amend mirrors the route's own precondition. Cancel deliberately has no
  // status restriction: the route never had one, and which states CDS permits
  // an invalidation from is a compliance question for AGENT-SPEC, not something
  // to infer from symmetry with amend.
  if (operation === "amend" && !LIVE.includes(status)) {
    return { ok: false, reason: "not_live" };
  }
  return {
    ok: true,
    nextStatus: operation === "amend" ? "Amendment Processing" : "Cancellation Requested",
  };
}

/**
 * Whether a failed follow-up may release the claim.
 * An unknown outcome must keep it: the request may have reached CDS, and
 * re-opening the declaration would allow a duplicate filing.
 */
export function mayReleaseClaim(disposition: "rejected" | "outcome_unknown"): boolean {
  return disposition === "rejected";
}
