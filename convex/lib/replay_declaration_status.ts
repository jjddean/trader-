import { resolveHmrcDmsType } from "./hmrc_notification_catalogue";
import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isCancellationRejected,
  isInvalidationAccepted,
  isSubmitReceipt,
  isPostCancelClearance,
} from "./notification_dms_context";
import { statusAfterNotification } from "./notification_status";

export interface NotificationRowForReplay {
  mrn?: string | null;
  notificationType?: string | null;
  rawPayload?: string | null;
  fieldErrors?: Array<{ field: string; reason: string; code?: string }>;
  errorCodes?: string[];
  timestamp?: string | number;
  /** HMRC IssueDateTime (ISO) — authoritative order when present. */
  issueDateTime?: string | null;
  /** submit | amend | cancel — which request this notification answers. */
  originatingOperation?: string | null;
  functionCode?: string | null;
}

/** HMRC IssueDateTime is authoritative; fall back to local receipt timestamp. */
function replayOrderKey(n: NotificationRowForReplay): number {
  const issue = new Date(String(n.issueDateTime ?? "")).getTime();
  if (Number.isFinite(issue)) return issue;
  return new Date(String(n.timestamp ?? 0)).getTime();
}

/** Replay HMRC notifications (current MRN only) to derive display status. */
export function replayDeclarationStatus(
  storedStatus: string,
  declarationMrn: string | undefined | null,
  notifications: NotificationRowForReplay[],
): string {
  const currentMrn = String(declarationMrn ?? "").trim();
  const scoped = currentMrn
    ? notifications.filter((n) => String(n.mrn ?? "").trim() === currentMrn)
    : notifications;

  const ordered = [...scoped].sort((a, b) => replayOrderKey(a) - replayOrderKey(b));

  const hasDmsInv = ordered.some((n) => {
    const resolvedType = resolveHmrcDmsType({
      rawPayload: n.rawPayload,
      storedNotificationType: n.notificationType,
      functionCode: n.functionCode,
    });
    return isInvalidationAccepted({
      notificationType: resolvedType,
      rawPayload: n.rawPayload,
      fieldErrors: n.fieldErrors,
      errorCodes: n.errorCodes,
      originatingOperation: n.originatingOperation,
    });
  });

  let status = storedStatus || "Draft";
  if (status === "Invalid" && !hasDmsInv) {
    status = "Processing";
  }
  for (const n of ordered) {
    const resolvedType = resolveHmrcDmsType({
      rawPayload: n.rawPayload,
      storedNotificationType: n.notificationType,
      functionCode: n.functionCode,
    });
    const ctx = {
      notificationType: resolvedType,
      rawPayload: n.rawPayload,
      fieldErrors: n.fieldErrors,
      errorCodes: n.errorCodes,
      originatingOperation: n.originatingOperation,
    };
    const hasResolvedMrn = currentMrn.length > 0;
    status = statusAfterNotification({
      currentStatus: status,
      notificationType: ctx.notificationType,
      hasResolvedMrn,
      isAmendmentRejected: isAmendmentRejected(ctx),
      isAmendmentAccepted: isAmendmentAccepted(ctx),
      isAmendmentAcknowledged: isAmendmentAcknowledged(ctx),
      isCancellationRejected: isCancellationRejected(ctx),
      isInvalidationAccepted: isInvalidationAccepted(ctx),
      isSubmitReceipt: isSubmitReceipt(ctx),
      isPostCancelClearance: isPostCancelClearance(ctx),
    });
  }
  return status;
}
