/** User-facing pre-clearance estimate copy — see convex/lib/financial_labels.ts */

import { FINANCIAL_LABELS as FL } from "./financial-labels";

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
  derivedDutyAmount?: number | null;
  derivedVatAmount?: number | null;
  dutyVarianceAmount?: number | null;
  vatVarianceAmount?: number | null;
  varianceAlert?: boolean;
  varianceKinds?: string[];
  fxConversionUsed?: boolean;
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
  varianceLines: string[];
}

function varianceLine(kind: string, amount: number): string | null {
  const abs = Math.abs(amount).toFixed(2);
  switch (kind) {
    case "duty_higher_than_hmrc":
      return `${FL.varianceDutyHigher}: £${abs} above HMRC.`;
    case "duty_lower_than_hmrc":
      return `${FL.varianceDutyLower}: £${abs} below your estimate.`;
    case "vat_higher_than_hmrc":
      return `${FL.varianceVatHigher}: £${abs} above HMRC.`;
    case "vat_lower_than_hmrc":
      return `${FL.varianceVatLower}: £${abs} below your estimate.`;
    default:
      return null;
  }
}

export function buildFinancialEstimateDisplay(input: FinancialEstimateInput): FinancialEstimateDisplay {
  const duty = Number(input.dutyAmount || 0);
  const vat = Number(input.vatAmount || 0);
  const confirmed = input.financialSource === "hmrc_confirmed";
  const varianceLines: string[] = [];

  if (confirmed && input.varianceAlert) {
    for (const kind of input.varianceKinds ?? []) {
      const amount =
        kind.startsWith("vat") || kind.includes("_vat_")
          ? Number(input.vatVarianceAmount || 0)
          : Number(input.dutyVarianceAmount || 0);
      const line = varianceLine(kind, amount);
      if (line) varianceLines.push(line);
    }
  }

  if (confirmed) {
    return {
      headline: "HMRC assessed amounts",
      badge: input.varianceAlert ? "Variance vs estimate" : "Confirmed by HMRC",
      badgeTone: input.varianceAlert ? "warning" : "confirmed",
      dutyLabel: "Import duty (A00)",
      vatLabel: "Import VAT (B00)",
      totalLabel: "Total duty and VAT",
      footnote: input.varianceAlert
        ? "HMRC assessed amounts differ from your pre-clearance estimate. Review A00 duty and B00 VAT lines."
        : "These amounts come from HMRC tax notifications and override any earlier estimates.",
      preferenceHint: null,
      varianceLines,
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

  if (input.fxConversionUsed) {
    footnote = `${footnote} ${FL.fxConversionFootnote}`;
  } else if (incomplete) {
    footnote = `${footnote} ${FL.fxUnavailableFootnote}`;
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
    varianceLines,
  };
}
