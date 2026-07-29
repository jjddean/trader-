/** F2 — compare pre-clearance estimates against HMRC-confirmed DMSTAX amounts. */

export const VARIANCE_MIN_GBP = 1;
export const VARIANCE_MIN_PCT = 0.02;

export type VarianceKind =
  | "duty_higher_than_hmrc"
  | "duty_lower_than_hmrc"
  | "vat_higher_than_hmrc"
  | "vat_lower_than_hmrc";

export interface FinancialVarianceInput {
  derivedDuty: number;
  derivedVat: number;
  confirmedDuty: number;
  confirmedVat: number;
  hasConfirmedFinancials: boolean;
}

export interface FinancialVarianceResult {
  dutyVarianceAmount: number;
  vatVarianceAmount: number;
  varianceAlert: boolean;
  varianceKinds: VarianceKind[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function exceedsThreshold(delta: number, derived: number, confirmed: number): boolean {
  const abs = Math.abs(delta);
  if (abs < VARIANCE_MIN_GBP) return false;
  const baseline = Math.max(derived, confirmed, 1);
  return abs / baseline >= VARIANCE_MIN_PCT;
}

/**
 * Positive delta = estimate higher than HMRC (possible overpayment on estimate).
 * Negative delta = estimate lower than HMRC (possible underpayment risk).
 */
export function computeFinancialVariance(
  input: FinancialVarianceInput,
): FinancialVarianceResult | null {
  if (!input.hasConfirmedFinancials) return null;

  const dutyVarianceAmount = round2(input.derivedDuty - input.confirmedDuty);
  const vatVarianceAmount = round2(input.derivedVat - input.confirmedVat);

  const kinds: VarianceKind[] = [];

  if (exceedsThreshold(dutyVarianceAmount, input.derivedDuty, input.confirmedDuty)) {
    kinds.push(
      dutyVarianceAmount > 0 ? "duty_higher_than_hmrc" : "duty_lower_than_hmrc",
    );
  }
  if (exceedsThreshold(vatVarianceAmount, input.derivedVat, input.confirmedVat)) {
    kinds.push(vatVarianceAmount > 0 ? "vat_higher_than_hmrc" : "vat_lower_than_hmrc");
  }

  return {
    dutyVarianceAmount,
    vatVarianceAmount,
    varianceAlert: kinds.length > 0,
    varianceKinds: kinds,
  };
}
