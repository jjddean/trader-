import {
  declarationHasAmendStateBlocked as declarationHasAmendStateBlockedCore,
  declarationHasImportDmscle as declarationHasImportDmscleCore,
  hasAmendLrnInPayload,
  hasCancelLrnInPayload,
  hasCds12015StateError,
  isAmendmentAccepted as isAmendmentAcceptedCore,
  isAmendmentRejected as isAmendmentRejectedCore,
  isCancellationRejected as isCancellationRejectedCore,
  isInvalidationAccepted as isInvalidationAcceptedCore,
  isPostCancelClearance as isPostCancelClearanceCore,
  type DmsNotificationContext,
} from "../../convex/lib/notification_dms_context";
import {
  declarationHasAmendmentRejected,
  declarationHasInvalidationAccepted,
  resolveDeclarationCdsBadge,
  type CdsBadgeTone,
} from "../../convex/lib/cds_badge";
import { presentationForDmsType, resolveHmrcDmsType } from "../../convex/lib/hmrc_notification_catalogue";

export type { CdsBadgeTone };
export {
  declarationHasAmendmentRejected,
  declarationHasInvalidationAccepted,
  resolveDeclarationCdsBadge,
  resolveHmrcDmsType,
};

export type NotificationRowContext = DmsNotificationContext;

export { hasCancelLrnInPayload, hasAmendLrnInPayload };

export function isInvalidationAccepted(ctx: NotificationRowContext): boolean {
  return isInvalidationAcceptedCore(ctx);
}

export function isAmendmentRejected(ctx: NotificationRowContext): boolean {
  return isAmendmentRejectedCore(ctx);
}

export function isAmendmentAccepted(ctx: NotificationRowContext): boolean {
  return isAmendmentAcceptedCore(ctx);
}

export function isCancellationRejected(ctx: NotificationRowContext): boolean {
  return isCancellationRejectedCore(ctx);
}

export function isPostCancelClearance(ctx: NotificationRowContext): boolean {
  return isPostCancelClearanceCore(ctx);
}

export function declarationHasImportDmscle(notifications: NotificationRowContext[]): boolean {
  return declarationHasImportDmscleCore(notifications);
}

export function declarationHasAmendStateBlocked(notifications: NotificationRowContext[]): boolean {
  return declarationHasAmendStateBlockedCore(notifications);
}

export function isDmscleLifecycleOnly(ctx: NotificationRowContext): boolean {
  return isPostCancelClearanceCore(ctx);
}

export interface TimelineNotificationMeta {
  title: string;
  detail: string;
  color: string;
  icon: "success" | "warning" | "danger" | "info";
  normalizedType: string;
  showFieldErrors: boolean;
}

function toneColor(tone: string): string {
  if (tone === "success") return "bg-green-500";
  if (tone === "danger") return "bg-red-500";
  if (tone === "warning") return "bg-amber-500";
  return "bg-blue-500";
}

function toneIcon(tone: string): "success" | "warning" | "danger" | "info" {
  if (tone === "success") return "success";
  if (tone === "danger") return "danger";
  if (tone === "warning") return "warning";
  return "info";
}

export function resolveTimelineNotificationMeta(
  ctx: NotificationRowContext,
  defaults: Omit<TimelineNotificationMeta, "normalizedType" | "showFieldErrors"> & { normalizedType: string },
): TimelineNotificationMeta {
  const normalizedType = resolveHmrcDmsType({
    rawPayload: ctx.rawPayload,
    storedNotificationType: ctx.notificationType || defaults.normalizedType,
  });
  const presented = presentationForDmsType(normalizedType);
  const catalogueDefaults: TimelineNotificationMeta = {
    title: presented.timelineTitle,
    detail: presented.detail,
    color: toneColor(presented.tone),
    icon: toneIcon(presented.tone),
    normalizedType,
    showFieldErrors: false,
  };

  const resolvedCtx = { ...ctx, notificationType: normalizedType };

  if (isInvalidationAccepted(resolvedCtx)) {
    return {
      ...catalogueDefaults,
      title: presented.timelineTitle,
      showFieldErrors: false,
    };
  }

  if (isAmendmentAccepted(resolvedCtx)) {
    const p = presentationForDmsType("DMSRES");
    return {
      title: p.timelineTitle,
      detail: p.detail,
      color: toneColor(p.tone),
      icon: toneIcon(p.tone),
      normalizedType: "DMSRES",
      showFieldErrors: false,
    };
  }

  if (isAmendmentRejected(resolvedCtx)) {
    const stateBlocked = hasCds12015StateError(resolvedCtx);
    return {
      title: "Amendment rejected (DMSREJ)",
      detail: stateBlocked
        ? "CDS12015 at Declaration/ID (42A/D014): HMRC will not amend this MRN — declaration is cleared or not in an amendable state."
        : "HMRC rejected the amendment message.",
      color: "bg-red-500",
      icon: "danger",
      normalizedType,
      showFieldErrors: true,
    };
  }

  if (isCancellationRejected(resolvedCtx)) {
    return {
      title: "Cancellation rejected (DMSREJ)",
      detail: "HMRC rejected the invalidation message.",
      color: "bg-red-500",
      icon: "danger",
      normalizedType,
      showFieldErrors: true,
    };
  }

  const raw = String(ctx.rawPayload ?? "");
  const hasFieldErrors = Array.isArray(ctx.fieldErrors) && ctx.fieldErrors.length > 0;
  const hasErrorCodes = Array.isArray(ctx.errorCodes) && ctx.errorCodes.length > 0;

  return {
    ...catalogueDefaults,
    showFieldErrors:
      normalizedType === "DMSREJ" &&
      (hasFieldErrors || hasErrorCodes || /<(?:[^>]*:)?FunctionalError/i.test(raw)),
  };
}
