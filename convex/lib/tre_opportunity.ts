// Deterministic TRE preference-opportunity rule.
//
// HMRC alignment (FINANCIAL-ROADMAP.md §5, .cursorrules §2–3):
//   - Flag only. Never assert money is recoverable or that a claim will succeed.
//   - Deterministic TypeScript only. No AI in this path.
//   - Preference eligibility authority is the Trade Tariff API (caller supplies
//     the parsed MFN / preference duty amounts from tariff_cache measures).
//   - Any £ delta is INDICATIVE and must be labelled as such by the UI.
//
// This module makes no tariff decisions itself — it compares amounts the caller
// derived deterministically from Trade Tariff measures and applies the
// "no preference claimed + a cheaper preferential measure exists" rule.

/** HMRC repayment time limit (C285): 3 years from notification of the debt. */
export const REPAYMENT_WINDOW_YEARS = 3;

/** Preference code empty or 100 = no preferential treatment claimed (MFN). */
export function isPreferenceClaimed(code?: string | null): boolean {
  const c = String(code ?? "").trim();
  return c !== "" && c !== "100";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** True when acceptanceDate is within the C285 repayment window from `nowMs`. */
export function isWithinRepaymentWindow(
  acceptanceDate: string | undefined | null,
  nowMs: number = Date.now(),
): boolean {
  const raw = String(acceptanceDate ?? "").trim();
  if (!raw) return false;
  const accepted = Date.parse(raw);
  if (!Number.isFinite(accepted)) return false;
  const cutoff = new Date(nowMs);
  cutoff.setFullYear(cutoff.getFullYear() - REPAYMENT_WINDOW_YEARS);
  return accepted >= cutoff.getTime();
}

export interface TreOpportunityInput {
  preferenceCode?: string | null;
  countryOfOriginCode?: string | null;
  commodityCode?: string | null;
  itemCustomsValue?: number | null;
  acceptanceDate?: string | null;
  /** £ duty for this row's customs value under the MFN (third-country) measure. */
  mfnDutyAmount: number | null;
  /** £ duty for this row under the cheapest applicable preferential measure. */
  preferenceDutyAmount: number | null;
  mfnRateLabel?: string;
  preferenceRateLabel?: string;
  preferenceGeoDescription?: string;
  /** Preferential measure carries a proof-of-origin certificate condition. */
  requiresProofOfOrigin?: boolean;
  /** trade-tariff:{commodity}@{date}#measure-{id} provenance string. */
  measureSource?: string;
  nowMs?: number;
}

export interface TreOpportunity {
  commodityCode: string;
  countryOfOriginCode: string;
  customsValue: number;
  /** INDICATIVE only — difference between MFN and preferential duty. */
  indicativeDelta: number;
  mfnRateLabel: string;
  preferenceRateLabel: string;
  preferenceGeoDescription: string;
  requiresProofOfOrigin: boolean;
  withinRepaymentWindow: boolean;
  measureSource: string;
  /** Fixed, non-promissory classification shown to the user. */
  flag: "potential_preference_opportunity";
}

/**
 * Returns an opportunity flag when a row paid MFN duty but a cheaper
 * preferential measure exists for its origin. Returns null otherwise.
 *
 * Conservative by design: any missing/unquantifiable input → null (no flag).
 */
export function evaluateRowOpportunity(input: TreOpportunityInput): TreOpportunity | null {
  // Already claimed preference → nothing to review.
  if (isPreferenceClaimed(input.preferenceCode)) return null;

  const origin = String(input.countryOfOriginCode ?? "").trim().toUpperCase();
  const commodity = String(input.commodityCode ?? "").trim();
  if (!/^[A-Z]{2}$/.test(origin)) return null;
  if (commodity.length !== 10) return null;

  const customsValue = Number(input.itemCustomsValue ?? 0);
  if (!Number.isFinite(customsValue) || customsValue <= 0) return null;

  const mfn = input.mfnDutyAmount;
  const pref = input.preferenceDutyAmount;
  // Cannot quantify (e.g. specific duty needing weight TRE does not carry) → no flag.
  if (mfn == null || pref == null) return null;
  if (!Number.isFinite(mfn) || !Number.isFinite(pref)) return null;

  const delta = mfn - pref;
  if (!(delta > 0)) return null;

  return {
    commodityCode: commodity,
    countryOfOriginCode: origin,
    customsValue: round2(customsValue),
    indicativeDelta: round2(delta),
    mfnRateLabel: input.mfnRateLabel ?? "",
    preferenceRateLabel: input.preferenceRateLabel ?? "",
    preferenceGeoDescription: input.preferenceGeoDescription ?? "",
    requiresProofOfOrigin: Boolean(input.requiresProofOfOrigin),
    withinRepaymentWindow: isWithinRepaymentWindow(input.acceptanceDate, input.nowMs),
    measureSource: input.measureSource ?? "",
    flag: "potential_preference_opportunity",
  };
}
