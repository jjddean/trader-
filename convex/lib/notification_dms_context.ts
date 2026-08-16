/**
 * HMRC DMS notification interpretation (shared with src/lib/notification-context.ts).
 * Used by Convex saveWebhook for status authority and by the status timeline UI.
 */

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

/** FC 02 / DMSINV with AM- LRN and no validation errors — amend received, not declaration invalid. */
export function isAmendmentAcknowledged(ctx: DmsNotificationContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSINV") return false;
  const raw = rawPayload(ctx);
  if (!hasAmendLrnInPayload(raw)) return false;
  if (hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw)) return false;
  return !hasValidationErrors(ctx);
}

/** Amendment rejected — AM- LRN + validation errors (e.g. CDS13000). AM- alone is not enough. */
export function isAmendmentRejected(ctx: DmsNotificationContext): boolean {
  const type = ctx.notificationType?.toUpperCase() || "";
  if (type !== "DMSINV" && type !== "DMSREJ") return false;
  const raw = rawPayload(ctx);
  if (!hasAmendLrnInPayload(raw)) return false;
  if (hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw)) return false;
  return hasValidationErrors(ctx);
}

/** Amendment accepted — HMRC TT_IM002b success path uses DMSRES (FC 07) with Amendment block. */
export function isAmendmentAccepted(ctx: DmsNotificationContext): boolean {
  const type = ctx.notificationType?.toUpperCase() || "";
  const raw = rawPayload(ctx);
  if (type === "DMSRES" || /<(?:[^>]*:)?FunctionCode>\s*0?7\s*</i.test(raw)) {
    return /<(?:[^>]*:)?Amendment/i.test(raw) || hasAmendLrnInPayload(raw);
  }
  return false;
}

/** Cancel invalidation accepted — CX- LRN or CancellationDateTime, no validation errors. */
export function isInvalidationAccepted(ctx: DmsNotificationContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSINV") return false;
  if (hasValidationErrors(ctx)) return false;
  const raw = rawPayload(ctx);
  if (hasAmendLrnInPayload(raw)) return false;
  // A clean DMSINV answering a cancel request IS the acceptance. The CX- test
  // below cannot see that on the CNS route, where resolveFollowUpLrn sends the
  // original create LRN rather than a minted CX- reference.
  if (hasKnownOperation(ctx)) return isCancelOperation(ctx);
  return hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw);
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
  if (ctx.notificationType?.toUpperCase() !== "DMSREJ") return false;
  if (hasKnownOperation(ctx)) return isCancelOperation(ctx);
  return hasCancelLrnInPayload(rawPayload(ctx));
}

export function isPostCancelClearance(ctx: DmsNotificationContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSCLE") return false;
  return hasCancelLrnInPayload(rawPayload(ctx));
}

/** DMSCLE on timeline only — not final cleared/released state (TT sandbox default). */
export function isDmscleLifecycleOnly(ctx: DmsNotificationContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSCLE") return false;
  if (isPostCancelClearance(ctx)) return true;
  return process.env.HMRC_ENVIRONMENT === "sandbox";
}

/** Import-path DMSCLE (not post-cancel noise). HMRC treats these MRNs as non-amendable (CDS12015). */
export function isImportDmscleEvent(ctx: DmsNotificationContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSCLE") return false;
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
