import { presentationForDmsType, resolveHmrcDmsType } from "./hmrc_notification_catalogue";
import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isInvalidationAccepted,
  type DmsNotificationContext,
} from "./notification_dms_context";

import type { NotificationRowForReplay } from "./replay_declaration_status";

export type CdsBadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

type CdsBadgeNotification = DmsNotificationContext | NotificationRowForReplay;

function resolvedType(n: CdsBadgeNotification): string {
  const row = n as NotificationRowForReplay;
  return resolveHmrcDmsType({
    rawPayload: n.rawPayload,
    storedNotificationType: n.notificationType,
    functionCode: row.functionCode,
  });
}

function asDmsContext(n: CdsBadgeNotification): DmsNotificationContext {
  return {
    notificationType: resolvedType(n),
    rawPayload: n.rawPayload,
    fieldErrors: n.fieldErrors,
    errorCodes: n.errorCodes,
    originatingOperation: "originatingOperation" in n ? n.originatingOperation : undefined,
  };
}

function replayOrderKey(n: CdsBadgeNotification): number {
  const row = n as NotificationRowForReplay;
  const issue = new Date(String(row.issueDateTime ?? "")).getTime();
  if (Number.isFinite(issue)) return issue;
  return new Date(String(row.timestamp ?? 0)).getTime();
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
  const rows = notifications ?? [];
  const ctx = rows.map(asDmsContext);
  const amendAccepted = ctx.some((n) => isAmendmentAccepted(n));
  const amendRejected = declarationHasAmendmentRejected(notifications);
  const amendAcknowledged = ctx.some((n) => isAmendmentAcknowledged(n));
  const cancelAccepted = declarationHasInvalidationAccepted(notifications);

  if (amendAccepted) {
    const p = presentationForDmsType("DMSRES");
    return { label: p.badgeLabel, tone: p.tone };
  }
  if (amendRejected && !cancelAccepted) {
    return { label: "Accepted — amend rejected", tone: "warning" };
  }
  if (amendAcknowledged && !amendAccepted && (status === "Accepted" || status === "Amendment Processing")) {
    return { label: "Accepted — amend processing", tone: "info" };
  }
  if (cancelAccepted) {
    const p = presentationForDmsType("DMSINV");
    return { label: p.badgeLabel, tone: p.tone };
  }

  const latest = [...rows].sort((a, b) => replayOrderKey(a) - replayOrderKey(b)).at(-1);
  if (latest) {
    const p = presentationForDmsType(resolvedType(latest));
    return { label: p.badgeLabel, tone: p.tone };
  }

  if (status === "Cleared") return { label: "Declaration cleared", tone: "info" };
  if (status === "Released") return { label: "Goods released", tone: "success" };
  if (status === "Amended") return { label: "Declaration corrected", tone: "info" };
  if (status === "Received") return { label: "Received by HMRC", tone: "info" };
  if (status === "Accepted") return { label: "Accepted by HMRC", tone: "success" };
  if (status === "Rejected") return { label: "Rejected by HMRC", tone: "danger" };
  if (status === "Inventory Rejected") return { label: status, tone: "danger" };
  if (status === "Cancelled") return { label: "Declaration cancelled", tone: "success" };
  if (status === "Invalid") return { label: "Invalid", tone: "danger" };
  if (status === "Action Required") return { label: status, tone: "danger" };
  if (status === "Draft") return { label: status, tone: "warning" };
  return { label: status, tone: "info" };
}
