import {
  isAmendmentAccepted,
  isAmendmentRejected,
  isInvalidationAccepted,
  type DmsNotificationContext,
} from "./notification_dms_context";

import type { NotificationRowForReplay } from "./replay_declaration_status";

export type CdsBadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

type CdsBadgeNotification = DmsNotificationContext | NotificationRowForReplay;

function asDmsContext(n: CdsBadgeNotification): DmsNotificationContext {
  return {
    notificationType: String(n.notificationType ?? ""),
    rawPayload: n.rawPayload,
    fieldErrors: n.fieldErrors,
    errorCodes: n.errorCodes,
  };
}

export function declarationHasInvalidationAccepted(
  notifications: CdsBadgeNotification[] | undefined,
): boolean {
  return (notifications ?? []).some((n) => isInvalidationAccepted(asDmsContext(n)));
}

export function declarationHasAmendmentRejected(
  notifications: CdsBadgeNotification[] | undefined,
): boolean {
  return (notifications ?? []).some((n) => isAmendmentRejected(asDmsContext(n)));
}

export function resolveDeclarationCdsBadge(
  status: string,
  notifications: CdsBadgeNotification[] | undefined,
): { label: string; tone: CdsBadgeTone } {
  const ctx = (notifications ?? []).map(asDmsContext);
  const amendAccepted = ctx.some((n) => isAmendmentAccepted(n));
  const amendRejected = declarationHasAmendmentRejected(notifications);
  const cancelAccepted = declarationHasInvalidationAccepted(notifications);

  if (amendAccepted) {
    return { label: "Amended (DMSRES)", tone: "success" };
  }
  if (amendRejected && !cancelAccepted) {
    return { label: "Accepted — amend rejected", tone: "warning" };
  }
  if (cancelAccepted) {
    return { label: "Cancelled (DMSINV)", tone: "success" };
  }
  if (status === "Cleared") {
    return { label: "Accepted (clearance event)", tone: "info" };
  }
  if (status === "Amended") return { label: "Amended (DMSRES)", tone: "success" };
  if (status === "Accepted") return { label: "Accepted (DMSACC)", tone: "success" };
  if (status === "Rejected") return { label: "Rejected (DMSREJ)", tone: "danger" };
  if (status === "Invalid") return { label: "Invalid (DMSINV)", tone: "danger" };
  if (status === "Action Required") return { label: status, tone: "warning" };
  if (status === "Draft") return { label: status, tone: "neutral" };
  return { label: status, tone: "info" };
}
