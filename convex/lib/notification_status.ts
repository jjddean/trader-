/**
 * Declaration status from HMRC DMS types (catalogue) plus follow-up context.
 * DMS type is never renamed here — only FreightCode workflow status.
 */

import { businessStatusFromDmsType } from "./hmrc_notification_catalogue";

const STATUS_RANK: Record<string, number> = {
  Draft: 0,
  Submitted: 10,
  Processing: 15,
  Received: 22,
  DMSTAX: 20,
  DMSRCV: 22,
  DMSACC: 40,
  Accepted: 40,
  Amended: 45,
  "Action Required": 70,
  Released: 75,
  DMSROG: 75,
  DMSCTL: 72,
  DMSREQ: 74,
  DMSRES: 76,
  DMSQRY: 78,
  DMSDOC: 79,
  DMSCLE: 80,
  Cleared: 80,
  Cancelled: 95,
  DMSINV: 95,
  Invalid: 95,
  DMSREJ: 100,
  Rejected: 100,
};

export function statusFromNotificationType(
  notificationType: string,
  hasResolvedMrn: boolean,
): string {
  const fromCatalogue = businessStatusFromDmsType(notificationType);
  if (notificationType === "DMSACC") {
    return hasResolvedMrn ? "Accepted" : "Submitted";
  }
  if (notificationType === "DMSCLE" || notificationType === "DMSEOG") {
    return hasResolvedMrn ? fromCatalogue : "Submitted";
  }
  if (notificationType === "DMSTAX") {
    return hasResolvedMrn ? "Accepted" : "Submitted";
  }
  if (notificationType === "DMSRCV") {
    return "Received";
  }
  return fromCatalogue;
}

export function shouldApplyNotificationStatus(
  currentStatus: string,
  proposedStatus: string,
): boolean {
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const proposedRank = STATUS_RANK[proposedStatus] ?? 0;
  return proposedRank >= currentRank;
}

export function statusAfterNotification(params: {
  currentStatus: string;
  notificationType: string;
  hasResolvedMrn: boolean;
  isAmendmentRejected: boolean;
  isAmendmentAccepted: boolean;
  isAmendmentAcknowledged?: boolean;
  isCancellationRejected?: boolean;
  isInvalidationAccepted: boolean;
  isSubmitReceipt?: boolean; // unused — DMSRCV does not promote to Accepted
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

  if (params.isCancellationRejected) {
    if (params.currentStatus === "Cancellation Requested") {
      return "Accepted";
    }
    return params.currentStatus;
  }

  // Amend message registered (DMSRCV) — declaration legal status unchanged.
  if (params.isAmendmentAcknowledged) {
    return params.currentStatus === "Amendment Processing" ? "Amendment Processing" : params.currentStatus === "Draft" ? "Received" : params.currentStatus;
  }

  if (params.isInvalidationAccepted) {
    return "Cancelled";
  }

  if (params.notificationType === "DMSCLE") {
    if (params.isPostCancelClearance) return params.currentStatus;
  }

  return shouldApplyNotificationStatus(params.currentStatus, proposed)
    ? proposed
    : params.currentStatus;
}
