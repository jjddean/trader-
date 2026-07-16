/** User-facing financial copy. Internal fields keep `derived` / `hmrc_confirmed`. */

export const FINANCIAL_LABELS = {
  confirmedProvenance: "Confirmed by HMRC",
  estimatedProvenance: "Estimated (pending HMRC assessment)",
  confirmedSettlement: "Final duty and VAT from HMRC",
  estimatedFromDeclaration: "Estimated from your declaration (commodity code, value, and origin)",
  estimateFromTariffMeasures:
    "Estimated from UK Trade Tariff measures using declared origin and preference",
  estimateHistoricalFallback:
    "Rough estimate — tariff measures unavailable; using historical averages",
  estimateIncompleteWeight:
    "Estimate incomplete — add net weight or supplementary units for weight-based duty",
  preClearanceHeadline: "Pre-clearance cost estimate",
  estimateOnlyBadge: "Estimate only",
  preferenceSavingHint: (amount: number) =>
    `If preference is claimed with valid origin proof, duty could be up to £${amount.toFixed(2)} lower`,
  recordsPageIntro: "Duty and import VAT from your declarations — confirmed by HMRC or estimated until assessed.",
  pendingAssessment: "Estimated until HMRC confirms duty and VAT",
  dutyConfirmedMethod: "Amount confirmed by HMRC",
  dutyEstimatedMethod: (declValue: number) =>
    `Estimated from commodity codes and invoice value (£${declValue.toFixed(2)} customs value)`,
  vatConfirmedMethod: "Amount confirmed by HMRC",
  vatEstimatedMethod: (declValue: number) =>
    `Estimated import VAT on customs value and duty (£${declValue.toFixed(2)} base)`,
  statementFromHmrc: "From HMRC tax assessment",
  statementEstimated: "Not yet confirmed by HMRC",
  paymentHmrcAssessed: "HMRC assessed",
  reportConfirmed: "Duty and VAT confirmed by HMRC",
  reportEstimated: "Estimated from Trade Tariff measures on declared items",
  reportStatusConfirmed: "Declaration status confirmed by HMRC",
  overpaymentAfterAssessment:
    "Repayment and savings opportunities appear after HMRC confirms duty and VAT on a declaration.",
  estimateHigherThanHmrc: "Your estimate was higher than HMRC's assessed duty",
  estimateLowerThanHmrc: "HMRC assessed more duty than your estimate",
  estimateHigherThanHmrcVat: "Your estimate was higher than HMRC's assessed VAT",
  estimateLowerThanHmrcVat: "HMRC assessed more VAT than your estimate",
  varianceDutyHigher: "Pre-clearance duty estimate exceeded HMRC assessed duty (A00)",
  varianceDutyLower: "HMRC assessed duty exceeded your pre-clearance estimate (A00)",
  varianceVatHigher: "Pre-clearance VAT estimate exceeded HMRC assessed VAT (B00)",
  varianceVatLower: "HMRC assessed VAT exceeded your pre-clearance estimate (B00)",
  fxConversionFootnote:
    "Non-GBP invoice values converted to GBP using synced Open Exchange Rates for this estimate.",
  fxUnavailableFootnote:
    "Non-GBP invoice currency detected but exchange rates are unavailable — duty estimate may be incomplete.",
  savingsOpportunity: "Possible duty savings (review required)",
} as const;
