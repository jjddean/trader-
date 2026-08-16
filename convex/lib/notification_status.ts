/**
 * Declaration status authority when multiple DMS notifications arrive for one MRN.
 * Higher rank wins; never downgrade (e.g. Cleared → Accepted).
 */

const STATUS_RANK: Record<string, number> = {
  Draft: 0,
  Submitted: 10,
  Processing: 15,
  DMSTAX: 20,
  DMSRCV: 25,
  DMSACC: 40,
  Accepted: 40,
  Amended: 45,
  "Action Required": 70,
  DMSROG: 70,
  DMSCTL: 72,
  DMSREQ: 74,
  DMSRES: 76,
  DMSQRY: 78,
  DMSDOC: 79,
  DMSCLE: 80,
  Cleared: 80,
  DMSINV: 95,
  Invalid: 95,
  DMSREJ: 100,
  Rejected: 100,
};

export function statusFromNotificationType(
  notificationType: string,
  hasResolvedMrn: boolean,
): string {
  switch (notificationType) {
    case "DMSUB":
    case "DMSSUB":
      return "Submitted";
    case "DMSACC":
      return hasResolvedMrn ? "Accepted" : "Submitted";
    case "DMSCLE":
      return hasResolvedMrn ? "Cleared" : "Submitted";
    case "DMSROG":
    case "DMSCTL":
    case "DMSREQ":
    case "DMSRES":
    case "DMSQRY":
    case "DMSDOC":
      return "Action Required";
    case "DMSREJ":
      return "Rejected";
    case "DMSINV":
      return "Invalid";
    case "DMSTAX":
    case "DMSRCV":
      return hasResolvedMrn ? "Accepted" : "Submitted";
    default:
      return hasResolvedMrn ? "Accepted" : "Submitted";
  }
}

export function shouldApplyNotificationStatus(
  currentStatus: string,
  proposedStatus: string,
): boolean {
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const proposedRank = STATUS_RANK[proposedStatus] ?? 0;
  return proposedRank >= currentRank;
}

/** Amendment rejected: declaration stays Accepted — do not apply DMSINV → Invalid. */
export function statusAfterNotification(params: {
  currentStatus: string;
  notificationType: string;
  hasResolvedMrn: boolean;
  isAmendmentRejected: boolean;
  isAmendmentAccepted: boolean;
  isAmendmentAcknowledged?: boolean;
  isCancellationRejected?: boolean;
  isInvalidationAccepted: boolean;
  isPostCancelClearance?: boolean;
}): string {
  const proposed = statusFromNotificationType(params.notificationType, params.hasResolvedMrn);

  if (params.isAmendmentAccepted) {
    return "Amended";
  }

  if (params.isAmendmentRejected) {
    if (params.currentStatus === "Accepted" || params.currentStatus === "Amendment Processing") {
      return "Accepted";
    }
    return params.currentStatus;
  }

  /**
   * A rejected *cancellation* (DMSREJ carrying a CX- LRN, e.g. CDS12015 at
   * 42A/D014) says the request was refused — the declaration itself is untouched
   * and HMRC still holds it. Without this it fell through to the generic path and
   * became "Rejected", which is both wrong and rank 100, so no later notification
   * could correct it. Mirrors the amendment-rejected branch above.
   */
  if (params.isCancellationRejected) {
    if (params.currentStatus === "Cancellation Requested") {
      return "Accepted";
    }
    return params.currentStatus;
  }

  // FC 02 amend ack (DMSINV + AM- LRN, no errors) — import stays accepted; await DMSRES.
  if (params.isAmendmentAcknowledged) {
    return params.currentStatus === "Amendment Processing" ? "Amendment Processing" : "Accepted";
  }

  if (params.notificationType === "DMSINV" && params.isInvalidationAccepted) {
    return "Invalid";
  }

  // Trade Test: DMSCLE is a lifecycle event on the timeline — not final "Cleared" state.
  if (params.notificationType === "DMSCLE") {
    if (params.isPostCancelClearance) return params.currentStatus;
    if (process.env.HMRC_ENVIRONMENT === "sandbox") return params.currentStatus;
  }

  return shouldApplyNotificationStatus(params.currentStatus, proposed)
    ? proposed
    : params.currentStatus;
}
