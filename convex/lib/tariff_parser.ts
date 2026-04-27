// Parser for UK Trade Tariff API responses. Pure — no I/O, no Convex.
// Walks the JSON:API `included` array and produces rule_definition rows
// that cite the exact measure_condition_id they came from.
//
// We DO NOT invent rules. Every output row has source =
// "trade-tariff:<commodity>@<isoDate>#measure-<id>" so each rule is traceable
// back to a row the gov.uk API returned.

export interface TariffJsonApi {
  data: {
    id: string;
    type: string;
    attributes: {
      goods_nomenclature_item_id: string;
      description?: string;
    };
    relationships?: {
      import_measures?: { data: Array<{ id: string; type: string }> };
    };
  };
  included?: TariffIncluded[];
}

export interface TariffIncluded {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data: unknown }>;
}

export interface ParsedRule {
  ruleId: string;
  name: string;
  description: string;
  severity: "blocking" | "advisory";
  enabled: boolean;
  source: string;
  triggerScope: {
    commodityPrefixes?: string[];
    originCountries?: string[];
    excludedOriginCountries?: string[];
    requiresPreferenceClaim?: boolean;
    dispatchCountries?: string[];
  };
  effects: {
    requiredDocuments?: { code: string; alternatives?: string[]; reason?: string }[];
  };
  metadata?: {
    measureId?: string;
    measureTypeId?: string;
    measureTypeDescription?: string;
    geographicalAreaId?: string;
    geographicalAreaDescription?: string;
    effectiveStartDate?: string;
    effectiveEndDate?: string;
  };
}

interface IndexedDoc {
  measureTypes: Map<string, TariffIncluded>;
  geoAreas: Map<string, TariffIncluded>;
  measures: Map<string, TariffIncluded>;
  conditions: Map<string, TariffIncluded>;
}

function indexIncluded(doc: TariffJsonApi): IndexedDoc {
  const idx: IndexedDoc = {
    measureTypes: new Map(),
    geoAreas: new Map(),
    measures: new Map(),
    conditions: new Map(),
  };
  for (const inc of doc.included || []) {
    if (inc.type === "measure_type") idx.measureTypes.set(inc.id, inc);
    else if (inc.type === "geographical_area") idx.geoAreas.set(inc.id, inc);
    else if (inc.type === "measure") idx.measures.set(inc.id, inc);
    else if (inc.type === "measure_condition") idx.conditions.set(inc.id, inc);
  }
  return idx;
}

// A measure_condition with condition_code "B" and a non-null document_code
// represents a "presentation of a certificate/licence/document" requirement.
// Any one of the alternatives within the same measure satisfies it — so we
// emit a single rule per measure that lists all valid codes, not one rule
// per code. action_code "26"/"27" = "Import allowed" if doc presented; "28"/"29"
// = "Import not allowed" — those flip the meaning.
function isDocumentPresentationCondition(c: TariffIncluded): boolean {
  const a = c.attributes || {};
  return String(a.condition_code) === "B" && !!a.document_code;
}

function relId(rel: unknown): string | undefined {
  if (!rel || typeof rel !== "object") return undefined;
  const d = (rel as { data?: { id?: string } }).data;
  return d?.id;
}

// Geo group IDs that we KNOW cover broadly enough that "apply to all origins
// minus exclusions" is correct. Any other group ID (CPTPP 20XX, EU 1013,
// CARIFORUM 1033, SADC 1035, DCTS 1062, Channel Islands 1080, etc.) requires
// expanding the group's member country list, which this single endpoint does
// not provide. Rules from those measures are emitted with enabled=false so
// they're auditable but never fire — better to under-warn than over-block.
const GEO_BROAD_APPLY: Record<string, string> = {
  "1008": "All third countries",
  "1011": "ERGA OMNES",
  "1100": "Countries other than Member States of the European Union",
};

function relIds(rel: unknown): string[] {
  if (!rel || typeof rel !== "object") return [];
  const d = (rel as { data?: Array<{ id?: string }> }).data;
  if (!Array.isArray(d)) return [];
  return d.map((x) => x?.id || "").filter(Boolean);
}

// effective_end_date is null for open-ended measures. A measure is in scope
// when (a) start <= today AND (b) end is null OR end >= today.
function isWithinValidity(attrs: Record<string, unknown>, todayIso: string): boolean {
  const start = String(attrs.effective_start_date || "");
  const end = attrs.effective_end_date == null ? "" : String(attrs.effective_end_date);
  const today = todayIso.slice(0, 10);
  if (start && start.slice(0, 10) > today) return false;
  if (end && end.slice(0, 10) < today) return false;
  return true;
}

export function parseTariffResponse(doc: TariffJsonApi, fetchedAtIso: string): ParsedRule[] {
  const commodity = doc.data.attributes.goods_nomenclature_item_id;
  if (!commodity) return [];
  const idx = indexIncluded(doc);
  const rules: ParsedRule[] = [];

  const measureRefs = doc.data.relationships?.import_measures?.data || [];
  for (const ref of measureRefs) {
    const measure = idx.measures.get(ref.id);
    if (!measure) continue;
    const mAttrs = measure.attributes || {};

    // Applicability gates — drop rules we KNOW don't apply, rather than
    // emitting them and relying on the engine to filter at runtime.
    if (mAttrs.import !== true) continue;
    if (!isWithinValidity(mAttrs, fetchedAtIso)) continue;

    const measureTypeId = relId(measure.relationships?.measure_type);
    const measureType = measureTypeId ? idx.measureTypes.get(measureTypeId) : undefined;
    const measureTypeDesc = String(measureType?.attributes?.description || measureTypeId || "");
    if (!measureTypeId) continue;

    // Skip non-document measures: these only describe duty/VAT/quota, no doc gate.
    const conditionRefs =
      (measure.relationships?.measure_conditions as { data?: Array<{ id: string }> })?.data || [];
    if (conditionRefs.length === 0) continue;

    const docCodes = new Set<string>();
    for (const cref of conditionRefs) {
      const cond = idx.conditions.get(cref.id);
      if (!cond) continue;
      if (!isDocumentPresentationCondition(cond)) continue;
      const action = String(cond.attributes?.action || "");
      // Only "Import allowed" actions describe documents that ENABLE clearance.
      // "Import not allowed" / "Apply other duties" describe gates we surface
      // separately later.
      if (!action.toLowerCase().startsWith("import allowed")) continue;
      const docCode = String(cond.attributes?.document_code || "").trim();
      if (docCode) docCodes.add(docCode);
    }
    if (docCodes.size === 0) continue;

    // Geographical scope. Tariff geographical_area can be a single country
    // ("BR") or a region group ("1008" = ERGA OMNES, "1011" = third countries
    // except EU, etc). For region groups we leave originCountries unset and
    // let the rule apply to all origins, but we capture the area ID +
    // description in metadata so a reviewer can verify.
    const geoId = relId(measure.relationships?.geographical_area);
    const geoArea = geoId ? idx.geoAreas.get(geoId) : undefined;
    const geoCode = String(geoArea?.attributes?.id || "");
    const geoDesc = String(geoArea?.attributes?.description || "");
    const isCountry = /^[A-Z]{2}$/.test(geoCode);
    const isAllowedGroup = !isCountry && geoCode in GEO_BROAD_APPLY;
    const isUnresolvedGroup = !isCountry && !isAllowedGroup && geoCode.length > 0;

    // measure.excluded_countries lists 2-letter codes the measure does NOT
    // cover, even when the geo area is a broad group. Resolve via the geo
    // area index since the relationship gives us area IDs.
    const excludedRefIds = relIds(measure.relationships?.excluded_countries);
    const excludedCountries = excludedRefIds
      .map((id) => String(idx.geoAreas.get(id)?.attributes?.id || id))
      .filter((c) => /^[A-Z]{2}$/.test(c));

    const measureId = String(mAttrs.id || measure.id);
    const ruleId = `TARIFF-${commodity}-MEASURE-${measureId}`;
    const docList = Array.from(docCodes);

    const skipPrefix = isUnresolvedGroup
      ? `[SKIPPED — geographical area ${geoCode} (${geoDesc}) is a country group whose members are not in this response; not safe to apply universally] `
      : "";

    // Document-code semantics:
    //   C* / N* = a real certificate / licence / commercial doc that the
    //             trader must obtain and reference on the declaration
    //   Y / 9*  = a status / exemption code declaring "this control does not
    //             apply because [reason]" — no actual paperwork required
    // When the acceptable bag is ALL exemption codes, the measure is really
    // "you must declare this exemption statement on the entry", not "you must
    // produce a certificate". Surface that as advisory + exemption-only so
    // the dry-run can render it differently.
    const isExemptionCode = (c: string) => c.startsWith("Y") || /^9\d/.test(c);
    const exemptionOnly = docList.every(isExemptionCode);

    // Tariff measure types 142 (Tariff preference) and 143 (Tariff suspension
    // under quota) only apply when the trader is actually claiming preferential
    // treatment. Without this gate, every preferential-origin measure would
    // demand origin certificates on every plain-vanilla import.
    const requiresPreferenceClaim = measureTypeId === "142" || measureTypeId === "143";

    rules.push({
      ruleId,
      name: exemptionOnly
        ? `Tariff ${commodity}: ${measureTypeDesc} — declare exemption`
        : `Tariff ${commodity}: ${measureTypeDesc} requires document`,
      description:
        skipPrefix +
        `Trade Tariff measure ${measureId} (type ${measureTypeId} — ${measureTypeDesc}) ` +
        (exemptionOnly
          ? `requires the trader to declare one of these exemption / status codes: ${docList.join(", ")}. `
          : `requires presentation of one of: ${docList.join(", ")}. `) +
        `Geographical area: ${geoCode}${geoDesc ? ` (${geoDesc})` : ""}. ` +
        (requiresPreferenceClaim ? "Only applies when a preference is claimed (DE 4/17 ≠ 100). " : "") +
        `Source: gov.uk Trade Tariff API.`,
      severity: exemptionOnly ? "advisory" : "blocking",
      enabled: !isUnresolvedGroup,
      source: `trade-tariff:${commodity}@${fetchedAtIso}#measure-${measureId}`,
      triggerScope: {
        commodityPrefixes: [commodity],
        ...(isCountry ? { originCountries: [geoCode] } : {}),
        ...(excludedCountries.length > 0 ? { excludedOriginCountries: excludedCountries } : {}),
        ...(requiresPreferenceClaim ? { requiresPreferenceClaim: true } : {}),
      },
      effects: {
        requiredDocuments: [
          {
            code: docList[0],
            ...(docList.length > 1 ? { alternatives: docList.slice(1) } : {}),
            reason: exemptionOnly
              ? `Declare exemption code for tariff measure ${measureId} (${measureTypeDesc}).`
              : `Required by tariff measure ${measureId} (${measureTypeDesc}).`,
          },
        ],
      },
      metadata: {
        measureId,
        measureTypeId,
        measureTypeDescription: measureTypeDesc,
        geographicalAreaId: geoCode || undefined,
        geographicalAreaDescription: geoDesc || undefined,
        effectiveStartDate: mAttrs.effective_start_date ? String(mAttrs.effective_start_date) : undefined,
        effectiveEndDate: mAttrs.effective_end_date == null ? undefined : String(mAttrs.effective_end_date),
      },
    });
  }

  return rules;
}
