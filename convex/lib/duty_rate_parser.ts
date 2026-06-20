// Deterministic duty rate parser for UK Trade Tariff JSON:API responses.
// Parses import duty measures (MFN, preference, quota) — never AI-generated.
// Complements tariff_parser.ts which handles document-presentation rules only.

import type { TariffIncluded, TariffJsonApi } from "./tariff_parser";

/** Measure types that carry import duty rates (not document gates). */
export const DUTY_MEASURE_TYPE_IDS = new Set([
  "103", // Third country duty (MFN)
  "105", // Tariff preference (erga omnes)
  "142", // Tariff preference
  "143", // Tariff suspension
  "145", // Preference quota
  "146", // Tariff quota
  "109", // Anti-dumping
  "117", // Countervailing duty
]);

const MFN_MEASURE_TYPE_IDS = new Set(["103", "105"]);
const PREFERENCE_MEASURE_TYPE_IDS = new Set(["142", "143", "145"]);

const GEO_BROAD_APPLY = new Set(["1008", "1011", "1100"]);

const DEFAULT_VAT_RATE = 0.2;

export interface DutyCalculationInput {
  customsValueGbp: number;
  netWeightKg?: number;
  supplementaryUnitQty?: number;
}

export interface ParsedDutyMeasure {
  measureId: string;
  measureTypeId: string;
  measureTypeDescription: string;
  geographicalAreaId: string;
  preferenceCodeId: string | null;
  dutyExpressionBase: string;
  adValoremPercent: number;
  specificAmountGbp: number;
  specificUnitQuantity: number;
  specificUnitLabel: string;
  isMfn: boolean;
  isPreference: boolean;
  hasQuota: boolean;
  quotaOrderNumber: string | null;
  source: string;
}

export interface DutyRateEstimate {
  dutyAmount: number;
  vatRate: number;
  adValoremPercent: number | null;
  measureTypeId: string;
  measureId: string;
  geographicalAreaId: string;
  preferenceCodeId: string | null;
  dutyExpressionBase: string;
  isPreference: boolean;
  isMfn: boolean;
  hasQuota: boolean;
  quotaOrderNumber: string | null;
  source: string;
  /** True when specific duty needed weight/qty that was not supplied. */
  incompleteInput: boolean;
}

interface DutyIndexedDoc {
  measureTypes: Map<string, TariffIncluded>;
  geoAreas: Map<string, TariffIncluded>;
  measures: Map<string, TariffIncluded>;
  dutyExpressions: Map<string, TariffIncluded>;
  measureComponents: Map<string, TariffIncluded>;
  conditions: Map<string, TariffIncluded>;
}

function relId(rel: unknown): string | undefined {
  if (!rel || typeof rel !== "object") return undefined;
  const d = (rel as { data?: { id?: string } }).data;
  return d?.id;
}

function relIds(rel: unknown): string[] {
  if (!rel || typeof rel !== "object") return [];
  const d = (rel as { data?: Array<{ id?: string }> }).data;
  if (!Array.isArray(d)) return [];
  return d.map((x) => x?.id || "").filter(Boolean);
}

function isWithinValidity(attrs: Record<string, unknown>, todayIso: string): boolean {
  const start = String(attrs.effective_start_date || "");
  const end = attrs.effective_end_date == null ? "" : String(attrs.effective_end_date);
  const today = todayIso.slice(0, 10);
  if (start && start.slice(0, 10) > today) return false;
  if (end && end.slice(0, 10) < today) return false;
  return true;
}

function indexDutyIncluded(doc: TariffJsonApi): DutyIndexedDoc {
  const idx: DutyIndexedDoc = {
    measureTypes: new Map(),
    geoAreas: new Map(),
    measures: new Map(),
    dutyExpressions: new Map(),
    measureComponents: new Map(),
    conditions: new Map(),
  };
  for (const inc of doc.included || []) {
    if (inc.type === "measure_type") idx.measureTypes.set(inc.id, inc);
    else if (inc.type === "geographical_area") idx.geoAreas.set(inc.id, inc);
    else if (inc.type === "measure") idx.measures.set(inc.id, inc);
    else if (inc.type === "duty_expression") idx.dutyExpressions.set(inc.id, inc);
    else if (inc.type === "measure_component") idx.measureComponents.set(inc.id, inc);
    else if (inc.type === "measure_condition") idx.conditions.set(inc.id, inc);
  }
  return idx;
}

function isPreferenceClaimed(preferenceCode?: string): boolean {
  const code = String(preferenceCode || "").trim();
  return code !== "" && code !== "100";
}

function geoAreaAppliesToCountry(
  geoAreaId: string,
  originCountry: string,
  idx: DutyIndexedDoc,
  excludedCountryIds: string[],
): boolean {
  const origin = originCountry.toUpperCase();
  if (!/^[A-Z]{2}$/.test(origin)) return false;

  const excluded = excludedCountryIds
    .map((id) => String(idx.geoAreas.get(id)?.attributes?.id || id).toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (excluded.includes(origin)) return false;

  if (geoAreaId.toUpperCase() === origin) return true;

  const geo = idx.geoAreas.get(geoAreaId);
  if (geo) {
    const children = relIds(geo.relationships?.children_geographical_areas);
    if (children.some((c) => c.toUpperCase() === origin)) return true;
  }

  if (GEO_BROAD_APPLY.has(geoAreaId)) return true;
  return false;
}

export function parseDutyExpressionBase(base: string): {
  adValoremPercent: number;
  specificAmountGbp: number;
  specificUnitQuantity: number;
  specificUnitLabel: string;
} {
  const trimmed = base.trim();
  if (!trimmed) {
    return { adValoremPercent: 0, specificAmountGbp: 0, specificUnitQuantity: 1, specificUnitLabel: "" };
  }

  const compound = trimmed.match(/^([\d.]+)\s*%\s*\+\s*([\d.]+)\s+GBP\s*\/\s*(?:([\d.]+)\s+)?(.+)$/i);
  if (compound) {
    return {
      adValoremPercent: parseFloat(compound[1]) || 0,
      specificAmountGbp: parseFloat(compound[2]) || 0,
      specificUnitQuantity: compound[3] ? parseFloat(compound[3]) || 1 : 1,
      specificUnitLabel: compound[4].trim(),
    };
  }

  const adVal = trimmed.match(/^([\d.]+)\s*%$/);
  if (adVal) {
    return {
      adValoremPercent: parseFloat(adVal[1]) || 0,
      specificAmountGbp: 0,
      specificUnitQuantity: 1,
      specificUnitLabel: "",
    };
  }

  const specific = trimmed.match(/^([\d.]+)\s+GBP\s*\/\s*(?:([\d.]+)\s+)?(.+)$/i);
  if (specific) {
    return {
      adValoremPercent: 0,
      specificAmountGbp: parseFloat(specific[1]) || 0,
      specificUnitQuantity: specific[2] ? parseFloat(specific[2]) || 1 : 1,
      specificUnitLabel: specific[3].trim(),
    };
  }

  return { adValoremPercent: 0, specificAmountGbp: 0, specificUnitQuantity: 1, specificUnitLabel: "" };
}

function parseFromMeasureComponents(
  measure: TariffIncluded,
  idx: DutyIndexedDoc,
): ReturnType<typeof parseDutyExpressionBase> {
  const componentRefs =
    (measure.relationships?.measure_components as { data?: Array<{ id: string }> })?.data || [];
  let adValoremPercent = 0;
  let specificAmountGbp = 0;
  let specificUnitQuantity = 1;
  let specificUnitLabel = "";

  for (const ref of componentRefs) {
    const component = idx.measureComponents.get(ref.id);
    if (!component?.attributes) continue;
    const attrs = component.attributes;
    const abbrev = String(attrs.duty_expression_abbreviation || "");
    const amount = Number(attrs.duty_amount);
    if (!Number.isFinite(amount)) continue;

    if (abbrev === "%") {
      adValoremPercent += amount;
      continue;
    }

    if (attrs.monetary_unit_code === "GBP" && attrs.measurement_unit_code) {
      specificAmountGbp += amount;
      specificUnitLabel = String(attrs.measurement_unit_code);
      // DTN = hectokilogram (100 kg); default divisor 100 for weight units.
      if (attrs.measurement_unit_code === "DTN") {
        specificUnitQuantity = 1;
        specificUnitLabel = "100 kg";
      }
    }
  }

  return { adValoremPercent, specificAmountGbp, specificUnitQuantity, specificUnitLabel };
}

function resolveSpecificQuantity(
  unitLabel: string,
  input: DutyCalculationInput,
  dutyCalculatorMeta?: Record<string, unknown>,
): number | null {
  const units = dutyCalculatorMeta?.applicable_measure_units as
    | Record<string, { multiplier?: string; abbreviation?: string; measurement_unit_code?: string }>
    | undefined;

  if (units) {
    for (const [code, unitMeta] of Object.entries(units)) {
      const abbrev = String(unitMeta.abbreviation || "");
      if (unitLabel && abbrev && !unitLabel.toLowerCase().includes(abbrev.toLowerCase().replace(/^x\s*/, ""))) {
        continue;
      }
      const mult = parseFloat(String(unitMeta.multiplier || ""));
      if (Number.isFinite(mult) && input.netWeightKg != null) {
        return input.netWeightKg * mult;
      }
      if (code === "DTN" && input.netWeightKg != null) {
        return input.netWeightKg / 100;
      }
    }
  }

  if (/kg/i.test(unitLabel) && input.netWeightKg != null) {
    const match = unitLabel.match(/([\d.,]+)\s*kg/i);
    const divisor = match ? parseFloat(match[1].replace(",", "")) : 1;
    if (divisor > 0) return input.netWeightKg / divisor;
  }

  if (input.supplementaryUnitQty != null) return input.supplementaryUnitQty;
  if (input.netWeightKg != null && !unitLabel) return input.netWeightKg;

  return null;
}

export function calculateDutyAmount(
  measure: ParsedDutyMeasure,
  input: DutyCalculationInput,
  dutyCalculatorMeta?: Record<string, unknown>,
): { amount: number; incompleteInput: boolean } {
  let duty = 0;
  let incompleteInput = false;

  if (measure.adValoremPercent > 0) {
    duty += input.customsValueGbp * (measure.adValoremPercent / 100);
  }

  if (measure.specificAmountGbp > 0) {
    const qty = resolveSpecificQuantity(measure.specificUnitLabel, input, dutyCalculatorMeta);
    if (qty == null) {
      incompleteInput = true;
    } else {
      const divisor = measure.specificUnitQuantity > 0 ? measure.specificUnitQuantity : 1;
      duty += (qty / divisor) * measure.specificAmountGbp;
    }
  }

  return { amount: Math.max(0, duty), incompleteInput };
}

export function parseDutyMeasures(doc: TariffJsonApi, fetchedAtIso: string): ParsedDutyMeasure[] {
  const commodity = doc.data.attributes.goods_nomenclature_item_id;
  if (!commodity) return [];

  const idx = indexDutyIncluded(doc);
  const measures: ParsedDutyMeasure[] = [];
  const measureRefs = doc.data.relationships?.import_measures?.data || [];

  for (const ref of measureRefs) {
    const measure = idx.measures.get(ref.id);
    if (!measure) continue;

    const mAttrs = measure.attributes || {};
    if (mAttrs.import !== true) continue;
    if (!isWithinValidity(mAttrs, fetchedAtIso)) continue;

    const measureTypeId = relId(measure.relationships?.measure_type);
    if (!measureTypeId || !DUTY_MEASURE_TYPE_IDS.has(measureTypeId)) continue;

    const measureType = idx.measureTypes.get(measureTypeId);
    const dutyExprId = relId(measure.relationships?.duty_expression);
    const dutyExpr = dutyExprId ? idx.dutyExpressions.get(dutyExprId) : undefined;
    const base = String(dutyExpr?.attributes?.base || "").trim();

    let parsed = parseDutyExpressionBase(base);
    if (!base) {
      parsed = parseFromMeasureComponents(measure, idx);
    }

    const geoAreaId = relId(measure.relationships?.geographical_area) || "";
    const prefCodeId = relId(measure.relationships?.preference_code) || null;
    const excludedIds = relIds(measure.relationships?.excluded_countries);
    const orderNumberRef = relId(measure.relationships?.order_number);
    const measureId = String(mAttrs.id || measure.id);

    measures.push({
      measureId,
      measureTypeId,
      measureTypeDescription: String(measureType?.attributes?.description || measureTypeId),
      geographicalAreaId: geoAreaId,
      preferenceCodeId: prefCodeId,
      dutyExpressionBase: base || dutyExpr?.attributes?.verbose_duty?.toString() || "",
      adValoremPercent: parsed.adValoremPercent,
      specificAmountGbp: parsed.specificAmountGbp,
      specificUnitQuantity: parsed.specificUnitQuantity,
      specificUnitLabel: parsed.specificUnitLabel,
      isMfn: MFN_MEASURE_TYPE_IDS.has(measureTypeId),
      isPreference: PREFERENCE_MEASURE_TYPE_IDS.has(measureTypeId),
      hasQuota: !!orderNumberRef || !!mAttrs.order_number,
      quotaOrderNumber: orderNumberRef || (mAttrs.order_number ? String(mAttrs.order_number) : null),
      source: `trade-tariff:${commodity}@${fetchedAtIso.slice(0, 10)}#measure-${measureId}`,
    });
  }

  return measures;
}

export function selectApplicableDutyMeasure(
  measures: ParsedDutyMeasure[],
  originCountry: string,
  preferenceCode: string | undefined,
  idx: DutyIndexedDoc,
  excludedResolver: (measure: ParsedDutyMeasure) => string[],
): ParsedDutyMeasure | null {
  const origin = originCountry.toUpperCase();
  const claimed = isPreferenceClaimed(preferenceCode);
  const itemPref = String(preferenceCode || "").trim();

  const applicable = measures.filter((m) =>
    geoAreaAppliesToCountry(m.geographicalAreaId, origin, idx, excludedResolver(m)),
  );
  if (applicable.length === 0) return null;

  if (claimed) {
    const prefMeasures = applicable.filter((m) => m.isPreference);
    if (prefMeasures.length > 0) {
      const exact = itemPref
        ? prefMeasures.find((m) => m.preferenceCodeId === itemPref)
        : undefined;
      if (exact) return exact;
      return prefMeasures[0];
    }
  }

  const mfnMeasures = applicable.filter((m) => m.isMfn);
  if (mfnMeasures.length > 0) {
    const erga = mfnMeasures.find((m) => m.geographicalAreaId === "1011");
    return erga || mfnMeasures[0];
  }

  return applicable[0];
}

export function estimateItemDutyFromTariff(
  doc: TariffJsonApi,
  options: {
    originCountry: string;
    preferenceCode?: string;
    fetchedAtIso?: string;
    input: DutyCalculationInput;
  },
): DutyRateEstimate | null {
  const fetchedAtIso = options.fetchedAtIso || new Date().toISOString();
  const idx = indexDutyIncluded(doc);
  const measures = parseDutyMeasures(doc, fetchedAtIso);
  if (measures.length === 0) return null;

  const excludedResolver = (measure: ParsedDutyMeasure) => {
    const raw = idx.measures.get(measure.measureId);
    return raw ? relIds(raw.relationships?.excluded_countries) : [];
  };

  const selected = selectApplicableDutyMeasure(
    measures,
    options.originCountry,
    options.preferenceCode,
    idx,
    excludedResolver,
  );
  if (!selected) return null;

  const dutyCalculatorMeta = (doc.data as { meta?: { duty_calculator?: Record<string, unknown> } }).meta
    ?.duty_calculator;
  const { amount, incompleteInput } = calculateDutyAmount(selected, options.input, dutyCalculatorMeta);

  return {
    dutyAmount: amount,
    vatRate: DEFAULT_VAT_RATE,
    adValoremPercent: selected.adValoremPercent > 0 ? selected.adValoremPercent : null,
    measureTypeId: selected.measureTypeId,
    measureId: selected.measureId,
    geographicalAreaId: selected.geographicalAreaId,
    preferenceCodeId: selected.preferenceCodeId,
    dutyExpressionBase: selected.dutyExpressionBase,
    isPreference: selected.isPreference,
    isMfn: selected.isMfn,
    hasQuota: selected.hasQuota,
    quotaOrderNumber: selected.quotaOrderNumber,
    source: selected.source,
    incompleteInput,
  };
}

/** Pick the lowest-duty applicable measure (for comparison / optimisation hints). */
export function findLowestDutyMeasure(
  doc: TariffJsonApi,
  originCountry: string,
  input: DutyCalculationInput,
  fetchedAtIso?: string,
): ParsedDutyMeasure | null {
  const iso = fetchedAtIso || new Date().toISOString();
  const idx = indexDutyIncluded(doc);
  const measures = parseDutyMeasures(doc, iso);
  const meta = (doc.data as { meta?: { duty_calculator?: Record<string, unknown> } }).meta?.duty_calculator;

  const origin = originCountry.toUpperCase();
  let best: ParsedDutyMeasure | null = null;
  let bestAmount = Infinity;

  for (const measure of measures) {
    const raw = idx.measures.get(measure.measureId);
    const excluded = raw ? relIds(raw.relationships?.excluded_countries) : [];
    if (!geoAreaAppliesToCountry(measure.geographicalAreaId, origin, idx, excluded)) continue;

    const { amount, incompleteInput } = calculateDutyAmount(measure, input, meta);
    if (incompleteInput) continue;
    if (amount < bestAmount) {
      bestAmount = amount;
      best = measure;
    }
  }

  return best;
}

/** Measure types surfaced in the preference checker UI. */
export const PREFERENCE_CHECKER_MEASURE_TYPE_IDS = new Set(["103", "142"]);

export interface PreferenceOption {
  geographicalAreaId: string;
  geographicalAreaDescription: string;
  measureTypeId: string;
  measureId: string;
  preferenceCodeId: string | null;
  rateLabel: string;
  dutyAmount: number;
  isMfn: boolean;
  isPreference: boolean;
  certificates: string[];
  hasQuota: boolean;
  quotaOrderNumber: string | null;
  incompleteInput: boolean;
  source: string;
}

export interface PreferenceEvaluation {
  options: PreferenceOption[];
  best: PreferenceOption;
  mfn: PreferenceOption | null;
}

function extractCertificatesFromMeasure(measureId: string, idx: DutyIndexedDoc): string[] {
  const raw = idx.measures.get(measureId);
  if (!raw) return [];
  const certs = new Set<string>();
  for (const cId of relIds(raw.relationships?.measure_conditions)) {
    const cond = idx.conditions.get(cId);
    const certId = relId(cond?.relationships?.certificate);
    if (certId) certs.add(certId);
  }
  return Array.from(certs);
}

function geoAreaDescription(geoAreaId: string, idx: DutyIndexedDoc): string {
  return String(idx.geoAreas.get(geoAreaId)?.attributes?.description || geoAreaId);
}

/** Compare all MFN and preference duty measures for an origin lane. */
export function evaluatePreferenceOptions(
  doc: TariffJsonApi,
  options: {
    originCountry: string;
    input: DutyCalculationInput;
    fetchedAtIso?: string;
  },
): PreferenceEvaluation | null {
  const fetchedAtIso = options.fetchedAtIso || new Date().toISOString();
  const idx = indexDutyIncluded(doc);
  const measures = parseDutyMeasures(doc, fetchedAtIso).filter((m) =>
    PREFERENCE_CHECKER_MEASURE_TYPE_IDS.has(m.measureTypeId),
  );
  if (measures.length === 0) return null;

  const meta = (doc.data as { meta?: { duty_calculator?: Record<string, unknown> } }).meta?.duty_calculator;
  const origin = options.originCountry.toUpperCase();
  const optionsOut: PreferenceOption[] = [];

  for (const measure of measures) {
    const raw = idx.measures.get(measure.measureId);
    const excluded = raw ? relIds(raw.relationships?.excluded_countries) : [];
    if (!geoAreaAppliesToCountry(measure.geographicalAreaId, origin, idx, excluded)) continue;

    const { amount, incompleteInput } = calculateDutyAmount(measure, options.input, meta);
    optionsOut.push({
      geographicalAreaId: measure.geographicalAreaId,
      geographicalAreaDescription: geoAreaDescription(measure.geographicalAreaId, idx),
      measureTypeId: measure.measureTypeId,
      measureId: measure.measureId,
      preferenceCodeId: measure.preferenceCodeId,
      rateLabel: measure.dutyExpressionBase || `${measure.adValoremPercent}%`,
      dutyAmount: amount,
      isMfn: measure.isMfn,
      isPreference: measure.isPreference,
      certificates: extractCertificatesFromMeasure(measure.measureId, idx),
      hasQuota: measure.hasQuota,
      quotaOrderNumber: measure.quotaOrderNumber,
      incompleteInput,
      source: measure.source,
    });
  }

  if (optionsOut.length === 0) return null;

  const complete = optionsOut.filter((o) => !o.incompleteInput);
  const ranked = [...(complete.length > 0 ? complete : optionsOut)].sort(
    (a, b) => a.dutyAmount - b.dutyAmount,
  );
  const mfn = optionsOut.find((o) => o.isMfn && !o.incompleteInput) ?? optionsOut.find((o) => o.isMfn) ?? null;

  return {
    options: optionsOut.sort((a, b) => a.dutyAmount - b.dutyAmount),
    best: ranked[0],
    mfn,
  };
}
