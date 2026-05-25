// src/lib/preference-engine.ts
// Duty optimisation engine: extracts preference logic from UI

export type PreferenceScheme = {
  code: string;
  countries: string[];
  measureCode: string;
  priority: 'high' | 'medium' | 'low';
  label: string;
  notes?: string;
};

export const TRADE_AGREEMENTS: Record<string, PreferenceScheme> = {
  UK_EU_TCA: {
    code: '1013',
    countries: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'],
    measureCode: '1013',
    priority: 'high',
    label: 'UK–EU TCA',
    notes: 'Requires origin compliance',
  },
  UK_JP_EPA: {
    code: 'JP',
    countries: ['JP'],
    measureCode: 'JP',
    priority: 'high',
    label: 'UK–Japan EPA',
    notes: 'Requires origin compliance',
  },
  UK_CA_CTPA: {
    code: 'CA',
    countries: ['CA'],
    measureCode: 'CA',
    priority: 'high',
    label: 'UK–Canada CTPA',
    notes: 'Requires origin compliance',
  },
  UK_AU_FTA: {
    code: 'AU',
    countries: ['AU'],
    measureCode: 'AU',
    priority: 'high',
    label: 'UK–Australia FTA',
    notes: 'Requires origin compliance',
  },
  UK_NZ_FTA: {
    code: 'NZ',
    countries: ['NZ'],
    measureCode: 'NZ',
    priority: 'high',
    label: 'UK–New Zealand FTA',
    notes: 'Requires origin compliance',
  },
  DCTS_STANDARD: {
    code: '1060',
    countries: [], // Populate as needed
    measureCode: '1060',
    priority: 'medium',
    label: 'DCTS Standard',
  },
  DCTS_ENHANCED: {
    code: '1061',
    countries: [],
    measureCode: '1061',
    priority: 'medium',
    label: 'DCTS Enhanced',
  },
  DCTS_COMPREHENSIVE: {
    code: '1062',
    countries: [],
    measureCode: '1062',
    priority: 'medium',
    label: 'DCTS Comprehensive',
  },
  UK_GLOBAL_TARIFF: {
    code: '1011',
    countries: [],
    measureCode: '1011',
    priority: 'low',
    label: 'UK Global Tariff (MFN)',
  },
  GCC_FTA: {
    code: 'UK-GCC',
    countries: ['BH', 'KW', 'OM', 'QA', 'SA', 'AE'],
    measureCode: 'FTA_GCC',
    priority: 'high',
    label: 'UK–GCC FTA',
    notes: 'Requires proof of origin; eligibility may vary by HS code',
  },
};


export interface PreferenceEngineResult {
  best: {
    scheme: string;
    rate: string;
    saving: string;
  };
  all: Array<{
    name: string;
    rate: string;
    rateValue: number;
    eligible: boolean;
    isMfn: boolean;
    notes: string;
  }>;
}

/**
 * Fetches and computes the best available preference scheme and duty rate for a given country and 10-digit HS code.
 */
export async function getPreferenceDecision({
  country,
  commodityCode,
}: {
  country: string;
  commodityCode: string;
}): Promise<PreferenceEngineResult> {
  if (!country || !commodityCode || commodityCode.length !== 10) {
    throw new Error("Country and valid 10-digit commodity code required");
  }

  const response = await fetch(
    `https://www.trade-tariff.service.gov.uk/api/v2/commodities/${commodityCode}?country=${country}`
  );
  if (!response.ok) {
    throw new Error("Unable to fetch tariff data. Please check that the commodity code is a valid 10-digit number.");
  }
  const json = await response.json();
  const included = json.included || [];
  const relevantMeasureIds = new Set(
    json.data.relationships.import_measures.data.map((m: any) => String(m.id))
  );
  const findIncluded = (type: string, id: string) =>
    included.find((item: any) => item.type === type && item.id === id);
  const allMeasures = included.filter(
    (item: any) => item.type === "measure" && relevantMeasureIds.has(String(item.id))
  );

  const results: any[] = [];
  let mfnRateValue = 0;
  let preferencesFound = false;

  allMeasures.forEach((measure: any) => {
    const measureTypeId = measure.relationships.measure_type.data.id;
    const geoAreaId = measure.relationships.geographical_area.data.id;
    const dutyExprId = measure.relationships.duty_expression.data.id;
    const geoArea = findIncluded("geographical_area", geoAreaId);
    const dutyExpr = findIncluded("duty_expression", dutyExprId);
    const children = geoArea?.relationships?.children_geographical_areas?.data || [];
    const isChild = children.some((c: any) => c.id === country);
    const isRelevantGeo = geoAreaId === country || geoAreaId === "1011" || isChild;
    if (isRelevantGeo && (measureTypeId === "103" || measureTypeId === "142")) {
      const rate = dutyExpr?.attributes?.base || "0.00 %";
      const rateValue = parseFloat(rate.replace(/[^\d.]/g, "")) || 0;
      // Map to scheme label if possible
      const scheme = Object.values(TRADE_AGREEMENTS).find(s => s.code === geoAreaId || s.measureCode === geoAreaId);
      const schemeName = scheme?.label || geoArea?.attributes?.description || `Scheme ${geoAreaId}`;
      const isMfn = measureTypeId === "103";
      if (isMfn) mfnRateValue = rateValue;
      if (!isMfn) preferencesFound = true;
      results.push({
        name: schemeName,
        rate: rate,
        rateValue: rateValue,
        eligible: true,
        isMfn: isMfn,
        notes: scheme?.notes || "",
      });
    }
  });

  if (results.length === 0) {
    throw new Error("No applicable measures found for this commodity.");
  }

  const sorted = [...results].sort((a, b) => a.rateValue - b.rateValue);
  const best = sorted[0];
  const savingValue = Math.max(0, mfnRateValue - best.rateValue);
  let savingText =
    savingValue > 0
      ? `Saving: ${savingValue}% vs standard rate`
      : best.isMfn
      ? "No preference saving available"
      : "Same as standard rate";
  if (!preferencesFound) {
    savingText = "No preference schemes available for this origin. Standard MFN rate applies.";
  }
  return {
    best: {
      scheme: best.name,
      rate: best.rate,
      saving: savingText,
    },
    all: results.sort((a, b) => (a.isMfn ? 1 : -1)),
  };
}
