/**
 * Which declarations qualify for HMRC notification recovery.
 *
 * A declaration is "stuck" when HMRC has taken it but no terminal notification
 * has landed — either the push webhook never arrived or it was never pulled.
 * The hourly recovery cron uses this to decide what to re-check.
 */

/**
 * Intermediate HMRC states, lowercased. Compared case-insensitively because this
 * also tests *replayed* statuses, whose casing is not guaranteed.
 */
export const STUCK_HMRC_STATUSES = new Set([
  "processing",
  "amendment processing",
  "cancellation requested",
]);

/**
 * Exact spellings written by the submit/amend/cancel routes. These are the
 * `declarations.by_status_and_updated` index lookup keys, so they must match what
 * is stored byte-for-byte — a mismatch silently returns zero rows rather than
 * erroring. `stuck-declarations.test.ts` asserts parity with the set above.
 */
export const STUCK_HMRC_STATUS_VALUES = [
  "Processing",
  "Amendment Processing",
  "Cancellation Requested",
] as const;

export function isStuckHmrcStatus(status: string | undefined | null): boolean {
  return STUCK_HMRC_STATUSES.has(String(status || "").toLowerCase());
}

/** Stale = in a stuck HMRC state and untouched since `cutoff`. */
export function isStaleStuckProcessingRow(
  storedStatus: string | undefined,
  lastUpdated: number | undefined,
  created: number | undefined,
  cutoff: number,
): boolean {
  if (!isStuckHmrcStatus(storedStatus)) return false;
  return Number(lastUpdated || created || 0) < cutoff;
}
