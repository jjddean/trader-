/**
 * HMRC DMS notification interpretation (shared with src/lib/notification-context.ts).
 * Used by Convex saveWebhook for status authority and by the status timeline UI.
 */

export interface DmsNotificationContext {
  notificationType: string;
  rawPayload?: string | null;
  fieldErrors?: Array<{ field: string; reason: string; code?: string }>;
  errorCodes?: string[];
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
  return hasCancelLrnInPayload(raw) || hasCancellationDateTime(raw);
}

export function isCancellationRejected(ctx: DmsNotificationContext): boolean {
  if (ctx.notificationType?.toUpperCase() !== "DMSREJ") return false;
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
