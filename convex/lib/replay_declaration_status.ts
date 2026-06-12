import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isInvalidationAccepted,
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

  let status = storedStatus || "Draft";
  for (const n of ordered) {
    const ctx = {
      notificationType: String(n.notificationType ?? ""),
      rawPayload: n.rawPayload,
      fieldErrors: n.fieldErrors,
      errorCodes: n.errorCodes,
    };
    const hasResolvedMrn = currentMrn.length > 0;
    status = statusAfterNotification({
      currentStatus: status,
      notificationType: ctx.notificationType,
      hasResolvedMrn,
      isAmendmentRejected: isAmendmentRejected(ctx),
      isAmendmentAccepted: isAmendmentAccepted(ctx),
      isAmendmentAcknowledged: isAmendmentAcknowledged(ctx),
      isInvalidationAccepted: isInvalidationAccepted(ctx),
      isPostCancelClearance: isPostCancelClearance(ctx),
    });
  }
  return status;
}
