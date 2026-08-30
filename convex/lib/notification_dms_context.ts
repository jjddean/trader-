/**
 * HMRC DMS notification interpretation (shared with src/lib/notification-context.ts).
 * Used by Convex saveWebhook for status authority and by the status timeline UI.
 */
import { resolveHmrcDmsType } from "./hmrc_notification_catalogue";

export interface DmsNotificationContext {
  notificationType: string;
  rawPayload?: string | null;
  fieldErrors?: Array<{ field: string; reason: string; code?: string }>;
  errorCodes?: string[];
  /**
   * Which request this notification answers — stamped on the row at ingest from
   * the submissions entry sharing its conversationId. The authority for telling a
   * follow-up outcome from a declaration outcome. Absent on rows stored before
   * this field existed; predicates fall back to payload inspection there.
   */
  originatingOperation?: string | null;
}

function resolvedType(ctx: DmsNotificationContext): string {
  return resolveHmrcDmsType({
    rawPayload: ctx.rawPayload,
    storedNotificationType: ctx.notificationType,
  });
}

function isCancelOperation(ctx: DmsNotificationContext): boolean {
  return String(ctx.originatingOperation ?? "") === "cancel";
}

function hasKnownOperation(ctx: DmsNotificationContext): boolean {
  return Boolean(String(ctx.originatingOperation ?? "").trim());
}

function rawPayload(ctx: DmsNotificationContext): string {
  return String(ctx.rawPayload ?? "");
}

export function hasCancelLrnInPayload(raw: string): boolean {
  return /CX-[a-z0-9]{10,}/i.test(raw);
}

export function hasAmendLrnInPayload(raw: string): boolean {
  return /AM-[a-z0-9]{10,}/i.test(raw);
}

function hasCancellationDateTime(raw: string): boolean {
  return raw.includes("CancellationDateTime");
}

function hasFunctionalErrors(raw: string): boolean {
  return /<(?:[^>]*:)?FunctionalError/i.test(raw);
}

function hasValidationErrors(ctx: DmsNotificationContext): boolean {
  if ((ctx.fieldErrors?.length ?? 0) > 0) return true;
  if ((ctx.errorCodes?.length ?? 0) > 0) return true;
  return hasFunctionalErrors(rawPayload(ctx));
}

function isSubmitOperation(ctx: DmsNotificationContext): boolean {
  return String(ctx.originatingOperation ?? "") === "submit";
}

/** DMSRCV answering submit — message registered, not legal acceptance. */
export function isSubmitReceipt(ctx: DmsNotificationContext): boolean {
  const type = resolvedType(ctx);
  if (type !== "DMSRCV") return false;
  if (!isSubmitOperation(ctx)) return false;
  if (hasValidationErrors(ctx)) return false;
  const raw = rawPayload(ctx);
  if (hasAmendLrnInPayload(raw) || hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw)) {
    return false;
  }
  return true;
}

/** DMSRCV with AM- LRN — amend message registered. */
export function isAmendmentAcknowledged(ctx: DmsNotificationContext): boolean {
  if (resolvedType(ctx) !== "DMSRCV") return false;
  const raw = rawPayload(ctx);
  if (!hasAmendLrnInPayload(raw)) return false;
  if (hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw)) return false;
  return !hasValidationErrors(ctx);
}

/** Amendment rejected — AM- LRN + validation errors (e.g. CDS13000). AM- alone is not enough. */
export function isAmendmentRejected(ctx: DmsNotificationContext): boolean {
  const type = resolvedType(ctx);
  if (type !== "DMSREJ") return false;
  const raw = rawPayload(ctx);
  if (!hasAmendLrnInPayload(raw)) return false;
  if (hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw)) return false;
  return hasValidationErrors(ctx);
}

/** Amendment accepted — HMRC DMSRES (FC 07): corrections applied. */
export function isAmendmentAccepted(ctx: DmsNotificationContext): boolean {
  if (resolvedType(ctx) !== "DMSRES") return false;
  const raw = rawPayload(ctx);
  return /<(?:[^>]*:)?Amendment/i.test(raw) || hasAmendLrnInPayload(raw);
}

/** HMRC DMSINV (FC 10) — declaration cancelled. FC 02 DMSRCV is not cancellation. */
export function isInvalidationAccepted(ctx: DmsNotificationContext): boolean {
  const type = resolvedType(ctx);
  if (type !== "DMSINV") return false;
  if (hasValidationErrors(ctx)) return false;
  const raw = rawPayload(ctx);
  if (hasAmendLrnInPayload(raw)) return false;
  return true;
}

/**
 * Was this DMSREJ a refusal of a *cancellation request*, rather than a rejection
 * of the declaration itself?
 *
 * `originatingOperation` is the authority. HMRC issues a distinct
 * X-Conversation-ID per request — verified in production TDR data, where one
 * declaration shows submit `1fc754d3…` and cancel `231a6ee0…`, and another shows
 * submit `b8eedd1e…` and amend `341f8fa8…`. So the notification's conversationId
 * identifies which request it answers, via the `submissions` evidence row.
 *
 * The CX- LRN payload check is a fallback for rows stored before this field
 * existed. It cannot work on the CNS route: `resolveFollowUpLrn` sends the
 * ORIGINAL create LRN on CNS amendments and cancellations, because CNS requires
 * it, so HMRC echoes FC-… back and no CX- ever appears. Direct-HMRC follow-ups
 * do mint CX-. See docs/hmrc/ACTIVE/tdr/errors-handled.md, 2026-08-15.
 */
export function isCancellationRejected(ctx: DmsNotificationContext): boolean {
  if (resolvedType(ctx) !== "DMSREJ") return false;
  if (hasKnownOperation(ctx)) return isCancelOperation(ctx);
  return hasCancelLrnInPayload(rawPayload(ctx));
}

export function isPostCancelClearance(ctx: DmsNotificationContext): boolean {
  if (resolvedType(ctx) !== "DMSCLE") return false;
  return hasCancelLrnInPayload(rawPayload(ctx));
}

/** Post-cancel DMSCLE only — not a goods-clearance status change. */
export function isDmscleLifecycleOnly(ctx: DmsNotificationContext): boolean {
  return isPostCancelClearance(ctx);
}

/** Import-path DMSCLE (not post-cancel noise). HMRC treats these MRNs as non-amendable (CDS12015). */
export function isImportDmscleEvent(ctx: DmsNotificationContext): boolean {
  if (resolvedType(ctx) !== "DMSCLE") return false;
  return !isPostCancelClearance(ctx);
}

export function declarationHasImportDmscle(notifications: DmsNotificationContext[]): boolean {
  return notifications.some(isImportDmscleEvent);
}

/** CDS12015 on an amend message — HMRC will reject further amends on this MRN. */
export function declarationHasAmendStateBlocked(notifications: DmsNotificationContext[]): boolean {
  return notifications.some(
    (n) => isAmendmentRejected(n) && hasCds12015StateError(n),
  );
}

export function hasCds12015StateError(ctx: DmsNotificationContext): boolean {
  if ((ctx.errorCodes ?? []).includes("CDS12015")) return true;
  return /<(?:[^>]*:)?ValidationCode>\s*CDS12015\s*</i.test(rawPayload(ctx));
}
