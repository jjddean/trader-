// Preference checker — deterministic duty comparison from Trade Tariff measures.

import {
  evaluatePreferenceOptions,
  type PreferenceEvaluation,
} from "../../convex/lib/duty_rate_parser";
import type { TariffJsonApi } from "../../convex/lib/tariff_parser";
import { fetchCommodityTariff } from "./trade-tariff-client";

export type PreferenceScheme = {
  code: string;
  countries: string[];
  measureCode: string;
  priority: "high" | "medium" | "low";
  label: string;
  notes?: string;
};

export const TRADE_AGREEMENTS: Record<string, PreferenceScheme> = {
  UK_EU_TCA: {
    code: "1013",
    countries: [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
      "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    ],
    measureCode: "1013",
    priority: "high",
    label: "UK–EU Trade and Cooperation Agreement",
    notes: "Requires origin compliance",
  },
  UK_JP_EPA: {
    code: "JP",
    countries: ["JP"],
    measureCode: "JP",
    priority: "high",
    label: "UK–Japan Comprehensive Economic Partnership",
    notes: "Requires origin compliance",
  },
  UK_CA_CTPA: {
    code: "CA",
    countries: ["CA"],
    measureCode: "CA",
    priority: "high",
    label: "UK–Canada CTPA",
    notes: "Requires origin compliance",
  },
  UK_AU_FTA: {
    code: "AU",
    countries: ["AU"],
    measureCode: "AU",
    priority: "high",
    label: "UK–Australia FTA",
    notes: "Requires origin compliance",
  },
  UK_NZ_FTA: {
    code: "NZ",
    countries: ["NZ"],
    measureCode: "NZ",
    priority: "high",
    label: "UK–New Zealand FTA",
    notes: "Requires origin compliance",
  },
  DCTS_STANDARD: {
    code: "1060",
    countries: [],
    measureCode: "1060",
    priority: "medium",
    label: "DCTS – Standard Preferences",
  },
  DCTS_ENHANCED: {
    code: "1061",
    countries: [],
    measureCode: "1061",
    priority: "medium",
    label: "DCTS – Enhanced Preferences",
  },
  DCTS_COMPREHENSIVE: {
    code: "1062",
    countries: [],
    measureCode: "1062",
    priority: "medium",
    label: "DCTS – Comprehensive Preferences",
  },
  UK_GLOBAL_TARIFF: {
    code: "1011",
    countries: [],
    measureCode: "1011",
    priority: "low",
    label: "UK Global Tariff (MFN)",
  },
  GCC_FTA: {
    code: "UK-GCC",
    countries: ["BH", "KW", "OM", "QA", "SA", "AE"],
    measureCode: "FTA_GCC",
    priority: "high",
    label: "UK–GCC FTA",
    notes: "Requires proof of origin; eligibility may vary by HS code",
  },
};

const SCHEME_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(TRADE_AGREEMENTS).map((s) => [s.code, s.label]),
);

export interface PreferenceEngineResult {
  best: {
    scheme: string;
    rate: string;
    saving: string;
    isMfn: boolean;
    dutyAmount: number;
    preferenceCodeId: string | null;
  };
  all: Array<{
    name: string;
    rate: string;
    rateValue: number;
    dutyAmount: number;
    eligible: boolean;
    isMfn: boolean;
    notes: string;
    preferenceCodeId: string | null;
    incompleteInput: boolean;
  }>;
  certificates: string[];
  quota: { orderNumber: string } | null;
  /** Estimate only — not HMRC-assessed. */
  estimateLabel: string;
}

function schemeLabelForGeo(geoAreaId: string, fallbackDescription: string): string {
  return SCHEME_LABEL[geoAreaId] || fallbackDescription || `Scheme ${geoAreaId}`;
}

function schemeNotes(geoAreaId: string): string {
  const entry = Object.values(TRADE_AGREEMENTS).find(
    (s) => s.code === geoAreaId || s.measureCode === geoAreaId,
  );
  return entry?.notes || "";
}

function formatSaving(
  bestDuty: number,
  mfnDuty: number | null,
  preferencesFound: boolean,
): string {
  if (mfnDuty != null && mfnDuty > bestDuty) {
    const savingGbp = mfnDuty - bestDuty;
    return `Saving: £${savingGbp.toFixed(2)} vs standard rate`;
  }
  if (preferencesFound) return "Same as standard rate";
  return "No preference schemes available for this origin. Standard MFN rate applies.";
}

export function buildPreferenceEngineResult(evaluation: PreferenceEvaluation): PreferenceEngineResult {
  const preferencesFound = evaluation.options.some((o) => o.isPreference);
  const certificatesFound = new Set<string>();
  let quota: { orderNumber: string } | null = null;

  for (const option of evaluation.options) {
    option.certificates.forEach((c) => certificatesFound.add(c));
    if (option.hasQuota && option.quotaOrderNumber && !quota) {
      quota = { orderNumber: option.quotaOrderNumber };
    }
  }

  const best = evaluation.best;
  const mfnDuty = evaluation.mfn?.dutyAmount ?? null;

  return {
    best: {
      scheme: schemeLabelForGeo(best.geographicalAreaId, best.geographicalAreaDescription),
      rate: best.rateLabel,
      saving: formatSaving(best.dutyAmount, mfnDuty, preferencesFound),
      isMfn: best.isMfn,
      dutyAmount: best.dutyAmount,
      preferenceCodeId: best.preferenceCodeId,
    },
    all: evaluation.options.map((option) => ({
      name: schemeLabelForGeo(option.geographicalAreaId, option.geographicalAreaDescription),
      rate: option.rateLabel,
      rateValue: option.dutyAmount,
      dutyAmount: option.dutyAmount,
      eligible: !option.incompleteInput,
      isMfn: option.isMfn,
      notes: schemeNotes(option.geographicalAreaId),
      preferenceCodeId: option.preferenceCodeId,
      incompleteInput: option.incompleteInput,
    })),
    certificates: Array.from(certificatesFound),
    quota,
    estimateLabel: "Estimate only — HMRC assessed amounts override on clearance",
  };
}

export function evaluatePreferenceFromTariffDoc(
  doc: TariffJsonApi,
  {
    country,
    commodityCode,
    customsValueGbp = 0,
    netWeightKg,
    supplementaryUnitQty,
    preferenceCode,
  }: {
    country: string;
    commodityCode: string;
    customsValueGbp?: number;
    netWeightKg?: number;
    supplementaryUnitQty?: number;
    preferenceCode?: string;
  },
): PreferenceEngineResult {
  if (!country || !commodityCode || commodityCode.length !== 10) {
    throw new Error("Country and valid 10-digit commodity code required");
  }

  const evaluation = evaluatePreferenceOptions(doc, {
    originCountry: country,
    input: {
      customsValueGbp,
      netWeightKg,
      supplementaryUnitQty,
    },
  });

  if (!evaluation) {
    throw new Error("No applicable measures found for this commodity.");
  }

  if (evaluation.best.incompleteInput) {
    throw new Error(
      "Net weight or supplementary units are required to calculate duty for this commodity.",
    );
  }

  return buildPreferenceEngineResult(evaluation);
}

/**
 * Fetches tariff data (country-filtered) and returns the best preference/MFN duty lane.
 * Prefer calling from `/api/tariff/preference` in the browser so fetches are server-side.
 */
export async function getPreferenceDecision({
  country,
  commodityCode,
  customsValueGbp = 0,
  netWeightKg,
  supplementaryUnitQty,
  preferenceCode,
}: {
  country: string;
  commodityCode: string;
  customsValueGbp?: number;
  netWeightKg?: number;
  supplementaryUnitQty?: number;
  preferenceCode?: string;
}): Promise<PreferenceEngineResult> {
  const response = await fetch("/api/tariff/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      country,
      commodityCode,
      customsValueGbp,
      netWeightKg,
      supplementaryUnitQty,
      preferenceCode,
    }),
  });

  const payload = (await response.json()) as PreferenceEngineResult & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Unable to check preferences for this commodity.");
  }

  return payload;
}

/** Server-side entry point used by the API route. */
export async function getPreferenceDecisionFromApi({
  country,
  commodityCode,
  customsValueGbp = 0,
  netWeightKg,
  supplementaryUnitQty,
}: {
  country: string;
  commodityCode: string;
  customsValueGbp?: number;
  netWeightKg?: number;
  supplementaryUnitQty?: number;
}): Promise<PreferenceEngineResult> {
  const doc = await fetchCommodityTariff(commodityCode, country);
  return evaluatePreferenceFromTariffDoc(doc, {
    country,
    commodityCode,
    customsValueGbp,
    netWeightKg,
    supplementaryUnitQty,
  });
}
