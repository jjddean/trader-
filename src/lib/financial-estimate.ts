/** User-facing pre-clearance estimate copy — see convex/lib/financial_labels.ts */

export type FinancialSource = "hmrc_confirmed" | "derived";
export type EstimateMethod = "hmrc_confirmed" | "tariff_measures" | "historical_fallback";

export interface FinancialEstimateInput {
  dutyAmount: number;
  vatAmount: number;
  customsValue: number;
  financialSource?: FinancialSource;
  estimateMethod?: EstimateMethod;
  estimateIncomplete?: boolean;
  potentialPreferenceSaving?: number | null;
}

export interface FinancialEstimateDisplay {
  headline: string;
  badge: string;
  badgeTone: "confirmed" | "estimate" | "warning";
  dutyLabel: string;
  vatLabel: string;
  totalLabel: string;
  footnote: string;
  preferenceHint: string | null;
}

export function buildFinancialEstimateDisplay(input: FinancialEstimateInput): FinancialEstimateDisplay {
  const duty = Number(input.dutyAmount || 0);
  const vat = Number(input.vatAmount || 0);
  const total = duty + vat;
  const confirmed = input.financialSource === "hmrc_confirmed";

  if (confirmed) {
    return {
      headline: "HMRC assessed amounts",
      badge: "Confirmed by HMRC",
      badgeTone: "confirmed",
      dutyLabel: "Import duty (A00)",
      vatLabel: "Import VAT (B00)",
      totalLabel: "Total duty and VAT",
      footnote: "These amounts come from HMRC tax notifications and override any earlier estimates.",
      preferenceHint: null,
    };
  }

  const incomplete = input.estimateIncomplete === true;
  const fallback = input.estimateMethod === "historical_fallback";

  let badge = "Estimate only";
  let badgeTone: FinancialEstimateDisplay["badgeTone"] = "estimate";
  let footnote =
    "Pre-clearance estimate from your declaration data. HMRC assessed amounts will replace these on clearance.";

  if (incomplete) {
    badge = "Estimate incomplete";
    badgeTone = "warning";
    footnote =
      "Some items need net weight or supplementary units before duty can be calculated from Trade Tariff measures.";
  } else if (fallback) {
    badge = "Rough estimate";
    badgeTone = "warning";
    footnote =
      "Tariff cache unavailable for one or more items — using historical averages until measures are loaded.";
  } else {
    footnote =
      "Calculated from UK Trade Tariff measures using the preference and origin declared on each item.";
  }

  const preferenceHint =
    input.potentialPreferenceSaving != null && input.potentialPreferenceSaving > 0
      ? `If you claim available preference and provide origin proof, duty could be up to £${input.potentialPreferenceSaving.toFixed(2)} lower. Use Preference Checker to review.`
      : null;

  return {
    headline: "Pre-clearance cost estimate",
    badge,
    badgeTone,
    dutyLabel: "Estimated import duty (A00)",
    vatLabel: "Estimated import VAT (B00)",
    totalLabel: "Estimated total duty and VAT",
    footnote,
    preferenceHint,
  };
}
