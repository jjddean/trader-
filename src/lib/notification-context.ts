import { normalizeNotificationType } from "./notification-labels";
import {
  hasAmendLrnInPayload,
  hasCancelLrnInPayload,
  isAmendmentAccepted as isAmendmentAcceptedCore,
  isAmendmentRejected as isAmendmentRejectedCore,
  isCancellationRejected as isCancellationRejectedCore,
  isInvalidationAccepted as isInvalidationAcceptedCore,
  isPostCancelClearance as isPostCancelClearanceCore,
  type DmsNotificationContext,
} from "../../convex/lib/notification_dms_context";

function isTradeTestClient(): boolean {
  return (process.env.NEXT_PUBLIC_HMRC_ENV || "sandbox") === "sandbox";
}

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

/** DMSCLE = event on timeline; in Trade Test it is not final clearance proof. */
export function isDmscleLifecycleOnly(ctx: NotificationRowContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSCLE") return false;
  if (isPostCancelClearanceCore(ctx)) return true;
  return isTradeTestClient();
}

export interface TimelineNotificationMeta {
  title: string;
  detail: string;
  color: string;
  icon: "success" | "warning" | "danger" | "info";
  normalizedType: string;
  showFieldErrors: boolean;
}

export function resolveTimelineNotificationMeta(
  ctx: NotificationRowContext,
  defaults: Omit<TimelineNotificationMeta, "normalizedType" | "showFieldErrors"> & { normalizedType: string },
): TimelineNotificationMeta {
  const normalizedType = defaults.normalizedType;

  if (isInvalidationAccepted(ctx)) {
    return {
      title: "Declaration invalidated (DMSINV)",
      detail: "HMRC accepted the cancellation request. The declaration is no longer active.",
      color: "bg-green-500",
      icon: "success",
      normalizedType,
      showFieldErrors: false,
    };
  }

  if (isAmendmentAccepted(ctx)) {
    return {
      title: "Amendment accepted (DMSRES)",
      detail: "HMRC accepted the COR amendment. Version should increment on the declaration.",
      color: "bg-green-500",
      icon: "success",
      normalizedType,
      showFieldErrors: false,
    };
  }

  if (isAmendmentRejected(ctx)) {
    return {
      title: "Amendment rejected (DMSINV)",
      detail:
        "HMRC rejected the amendment message. The import declaration remains accepted — fix the change and resubmit amend.",
      color: "bg-red-500",
      icon: "danger",
      normalizedType,
      showFieldErrors: true,
    };
  }

  if (normalizedType === "DMSINV" && hasAmendLrnInPayload(String(ctx.rawPayload ?? ""))) {
    return {
      title: "Amendment response (FC 02)",
      detail:
        "HMRC responded to the amend message (no validation errors in payload). Success proof is DMSRES (FC 07) per TT_IM002b — await further notifications.",
      color: "bg-blue-500",
      icon: "info",
      normalizedType,
      showFieldErrors: false,
    };
  }

  if (isCancellationRejected(ctx)) {
    return {
      title: "Cancellation rejected (DMSREJ)",
      detail: "HMRC rejected the invalidation message. Review error codes and fix the cancel XML.",
      color: "bg-red-500",
      icon: "danger",
      normalizedType,
      showFieldErrors: true,
    };
  }

  if (isDmscleLifecycleOnly(ctx)) {
    const afterCancel = isPostCancelClearanceCore(ctx);
    return {
      title: "Clearance event (DMSCLE)",
      detail: afterCancel
        ? "Trade Test lifecycle message after invalidation — not the invalidation outcome."
        : "Trade Test lifecycle message — not proof the declaration is finally cleared or released.",
      color: "bg-blue-500",
      icon: "info",
      normalizedType,
      showFieldErrors: false,
    };
  }

  if (normalizedType === "DMSINV") {
    return {
      title: "Declaration invalid (DMSINV)",
      detail: "HMRC returned field-level validation errors on the declaration.",
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
    ...defaults,
    normalizedType,
    showFieldErrors:
      normalizedType === "DMSREJ" ||
      (normalizedType === "DMSINV" &&
        (hasFieldErrors || hasErrorCodes || /<(?:[^>]*:)?FunctionalError/i.test(raw))),
  };
}

export function declarationHasInvalidationAccepted(
  notifications: NotificationRowContext[] | undefined,
): boolean {
  return (notifications ?? []).some((n) => isInvalidationAccepted(n));
}

export function declarationHasAmendmentRejected(
  notifications: NotificationRowContext[] | undefined,
): boolean {
  return (notifications ?? []).some((n) => isAmendmentRejected(n));
}

export type CdsBadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

export function resolveDeclarationCdsBadge(
  status: string,
  notifications: NotificationRowContext[] | undefined,
): { label: string; tone: CdsBadgeTone } {
  const amendAccepted = (notifications ?? []).some((n) => isAmendmentAccepted(n));
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
