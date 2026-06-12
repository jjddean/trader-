// Rule engine: resolves a declaration's scenario, evaluates enabled
// rule_definitions against it, and emits validation_results rows. Lives
// outside Convex so the submit route can re-use the same evaluation
// without round-tripping through Convex for each rule.

export type Severity = "blocking" | "advisory";
export type Status = "pass" | "fail" | "skip";

export interface TriggerScope {
  procedureCodes?: string[];
  additionalProcedureCodes?: string[];
  commodityPrefixes?: string[];
  originCountries?: string[];
  // Origin codes the rule explicitly does NOT apply to. Used by tariff rules
  // whose measure targets a region group (e.g. "All third countries") but
  // carves out specific countries via measure.excluded_countries.
  excludedOriginCountries?: string[];
  // When true, the rule only fires if the declaration claims a tariff
  // preference (an item carries a preferenceCode other than "100" / blank).
  // Tariff measure types 142 and 143 are gated this way — they describe
  // what the trader must show TO QUALIFY for preference, not blanket gates.
  requiresPreferenceClaim?: boolean;
  dispatchCountries?: string[];
  valuationMethods?: string[];
  transportModes?: string[];
  declarationTypes?: string[];
  modes?: string[]; // "minimal" | "enriched"
}

// Named cross-field predicates. Adding a new check = add a case in the
// runPredicate switch + cite it from a seed rule's effects.predicates.
// Keeping the grammar tiny on purpose: rules are data, predicates are code.
export type PredicateName =
  | "ITEM_VALUE_SUM_MATCHES_INVOICE"
  | "ALL_ITEMS_HAVE_PROCEDURE"
  | "WILDCARD_FORBID_ALL_DOCUMENTS"
  | "OVERSEAS_EXPORTER_ADDRESS";

export interface Effects {
  requiredDocuments?: {
    code: string;
    // Any-of: passes if `code` OR any of `alternatives` is present.
    // Tariff measures commonly list multiple acceptable docs; this avoids
    // blocking a user who provided a valid alternative.
    alternatives?: string[];
    lpcoExemptionCode?: string;
    reason?: string;
  }[];
  forbiddenDocuments?: { code: string; reason?: string }[];
  requiredFields?: { path: string; reason?: string }[];
  forbiddenFields?: { path: string; reason?: string }[];
  predicates?: { name: PredicateName; reason?: string; tolerance?: number }[];
}

export interface RuleMetadata {
  measureId?: string;
  measureTypeId?: string;
  measureTypeDescription?: string;
  geographicalAreaId?: string;
  geographicalAreaDescription?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  // Evidence block — populated for curated rules sourced from CDS rejections.
  // The engine never translates between code systems (e.g. N853 != D006) so
  // each curated rule must cite the rejection that proved its existence.
  evidence?: {
    mrn?: string;
    conversationId?: string;
    functionCode?: string;       // "03" = CDS rejection
    references?: string[];       // WCO section codes (42A/67A/68A) cited in the rejection
    confidence?: "high" | "medium";
    observedAt?: number;
  };
}

export interface RuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  severity: Severity;
  enabled: boolean;
  source?: string;
  triggerScope: TriggerScope;
  effects: Effects;
  metadata?: RuleMetadata;
}

export type RuleSourceKind = "core" | "tariff" | "curated";

function ruleSourceKind(rule: RuleDefinition): RuleSourceKind {
  if (rule.ruleId.startsWith("TARIFF-")) return "tariff";
  if (rule.source && rule.source.startsWith("trade-tariff:")) return "tariff";
  if (rule.ruleId.startsWith("CURATED-")) return "curated";
  if (rule.source && rule.source.startsWith("cds-rejection:")) return "curated";
  return "core";
}

export interface Scenario {
  declarationType: string;          // IMA, IMD, etc.
  procedureCodes: string[];         // distinct DE 1/10 across items
  additionalProcedureCodes: string[]; // distinct DE 1/11
  commodityCodes: string[];         // 10-digit codes from items
  originCountries: string[];
  dispatchCountry: string;
  valuationMethods: string[];
  transportMode: string;
  mode: string;                     // "minimal" | "enriched", defaults "minimal"
  // Distinct preference codes (DE 4/17) across items, normalised. "100"
  // means "no preference claimed" — items carrying only "100" or blank
  // are treated as no claim. Used by requiresPreferenceClaim gating.
  preferenceCodes: string[];
}

export interface ScenarioInput {
  declaration: {
    declarationType?: string;
    route?: string;
    dispatchCountry?: string;
    transportMode?: string;
    // DE 7/9 — vessel/wagon/flight identity. Required for R123 alongside DE 7/7.
    transportId?: string;
    // DE 7/7 — identification type code for the transport identity.
    transportIdType?: string;
    valuationMethod?: string;
    mode?: string; // "minimal" | "enriched"
    invoiceTotal?: number | string;
    exporterEori?: string;
    exporterName?: string;
    exporterCity?: string;
    exporterLine?: string;
    exporterPostcode?: string;
    transactionNatureCode?: string;
  };
  items: Array<{
    commodityCode?: string;
    hsCode?: string;
    originCountry?: string;
    procedureCode?: string;
    additionalProcedureCode?: string;
    valuationMethod?: string;
    valueAmount?: number | string;
    preferenceCode?: string; // DE 4/17 — "100" or blank = no preference
    additionalDocuments?: Array<{
      categoryCode?: string; CategoryCode?: string;
      typeCode?: string; TypeCode?: string;
      code?: string;
    }>;
  }>;
}

function isPreferenceClaimed(prefCodes: string[]): boolean {
  // "100" is the CDS code for "Tariff arrangement: No preference". A blank
  // / missing code is also no claim. Anything else (200/300/400 series, etc)
  // means the trader is claiming preferential treatment.
  return prefCodes.some((p) => p && p !== "100");
}

export interface ValidationResult {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  status: Status;
  source: RuleSourceKind;
  measureId?: string;
  field?: string;
  reason?: string;
  evidence?: unknown;
}

function uniq(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function mapDeclType(type?: string, route?: string): string {
  const prefix = route === "export" ? "EX" : "IM";
  const valid = ["A", "B", "C", "D", "E", "F", "J", "K", "Y", "Z"];
  const suffix = valid.includes((type || "").toUpperCase()) ? (type || "A").toUpperCase() : "A";
  return `${prefix}${suffix}`;
}

export function resolveScenario(input: ScenarioInput): Scenario {
  const { declaration, items } = input;
  const procPairs = items.map((i) => String(i.procedureCode || "").replace(/\s+/g, "").substring(0, 4));
  const addlProcs = items.map((i) => String(i.additionalProcedureCode || "").trim() || "000");
  const commodities = items.map((i) => String(i.commodityCode || i.hsCode || "").replace(/\s+/g, ""));
  const origins = items.map((i) => String(i.originCountry || "").trim().toUpperCase());
  // Default Method 1 — declaration may override per-item later. The mapper
  // currently hard-codes "1"; once that field becomes user-editable this
  // resolver picks it up automatically.
  const valuationMethods = items.map((i) => String(i.valuationMethod || declaration.valuationMethod || "1"));
  const preferenceCodes = items.map((i) => String(i.preferenceCode || "").trim());

  return {
    declarationType: mapDeclType(declaration.declarationType, declaration.route),
    procedureCodes: uniq(procPairs),
    additionalProcedureCodes: uniq(addlProcs),
    commodityCodes: uniq(commodities),
    originCountries: uniq(origins),
    dispatchCountry: String(declaration.dispatchCountry || "").trim().toUpperCase(),
    valuationMethods: uniq(valuationMethods),
    transportMode: String(declaration.transportMode || "").trim(),
    mode: String(declaration.mode || "minimal").trim().toLowerCase(),
    preferenceCodes: uniq(preferenceCodes),
  };
}

// A trigger scope matches when EVERY non-empty filter in the scope intersects
// the scenario. An empty/undefined filter on the scope matches anything.
export function ruleApplies(scope: TriggerScope, scenario: Scenario): boolean {
  const checks: Array<[string[] | undefined, string[] | string]> = [
    [scope.procedureCodes, scenario.procedureCodes],
    [scope.additionalProcedureCodes, scenario.additionalProcedureCodes],
    [scope.originCountries, scenario.originCountries],
    [scope.dispatchCountries, scenario.dispatchCountry],
    [scope.valuationMethods, scenario.valuationMethods],
    [scope.transportModes, scenario.transportMode],
    [scope.declarationTypes, scenario.declarationType],
    [scope.modes, scenario.mode],
  ];
  for (const [filter, candidate] of checks) {
    if (!filter || filter.length === 0) continue;
    const candidates = Array.isArray(candidate) ? candidate : [candidate];
    if (!candidates.some((c) => c && filter.includes(c))) return false;
  }
  if (scope.commodityPrefixes && scope.commodityPrefixes.length > 0) {
    const ok = scenario.commodityCodes.some((c) =>
      scope.commodityPrefixes!.some((p) => c.startsWith(p)),
    );
    if (!ok) return false;
  }
  // Carve-out: if every origin on the declaration is in the excluded list,
  // the rule does not apply. We use "every" rather than "any" so a multi-item
  // declaration where ONE item still falls inside the rule's geo group keeps
  // the rule active for the others.
  if (scope.excludedOriginCountries && scope.excludedOriginCountries.length > 0) {
    const excluded = new Set(scope.excludedOriginCountries.map((c) => c.toUpperCase()));
    const remaining = scenario.originCountries.filter((c) => !excluded.has(c));
    if (scenario.originCountries.length > 0 && remaining.length === 0) return false;
  }
  // Preference-gated rules don't apply unless the trader is actually claiming
  // preferential treatment. Without this, every preference measure (type 142)
  // would over-fire and demand a EUR1/origin certificate on imports that
  // weren't asking for preference in the first place.
  if (scope.requiresPreferenceClaim) {
    if (!isPreferenceClaimed(scenario.preferenceCodes)) return false;
  }
  return true;
}

function gatherDocCodes(input: ScenarioInput): string[] {
  const codes: string[] = [];
  for (const item of input.items) {
    const docs = item.additionalDocuments || [];
    for (const d of docs) {
      const cat = String(d.CategoryCode || d.categoryCode || "").trim();
      const type = String(d.TypeCode || d.typeCode || "").trim();
      const combined = d.code ? String(d.code).trim() : `${cat}${type}`;
      if (combined) codes.push(combined.toUpperCase());
    }
  }
  return uniq(codes);
}

// Resolve a dotted path on the declaration object. Returns undefined when
// any segment is missing. Used by the requiredFields / forbiddenFields
// effects so rules can reference structured paths without hard-coding.
function getPath(declaration: unknown, items: unknown[], path: string): unknown {
  const segments = path.split(".");
  let cursor: unknown = segments[0] === "items" ? items : { declaration, items };
  if (segments[0] === "declaration") cursor = (declaration as Record<string, unknown>) ?? {};
  const start = segments[0] === "declaration" || segments[0] === "items" ? 1 : 0;
  for (let i = start; i < segments.length; i++) {
    if (cursor == null) return undefined;
    cursor = (cursor as Record<string, unknown>)[segments[i]];
  }
  return cursor;
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

interface PredicateOutcome {
  ok: boolean;
  detail?: string;
  evidence?: unknown;
}

// Each predicate is a small typed checker. Returns ok=false to signal a
// rule failure. Keep the body of each branch a single screen — anything
// bigger means the predicate should be split.
function runPredicate(
  name: PredicateName,
  input: ScenarioInput,
  opts: { tolerance?: number },
): PredicateOutcome {
  switch (name) {
    case "ITEM_VALUE_SUM_MATCHES_INVOICE": {
      const invoice = toNumber(input.declaration.invoiceTotal);
      if (invoice == null) {
        return { ok: true, detail: "Skipped: declaration.invoiceTotal not set" };
      }
      const sum = input.items.reduce((acc, i) => acc + (toNumber(i.valueAmount) || 0), 0);
      const tolerance = opts.tolerance ?? 0.01;
      const diff = Math.abs(sum - invoice);
      return {
        ok: diff <= tolerance,
        detail: diff <= tolerance
          ? undefined
          : `Sum of item values (${sum.toFixed(2)}) differs from invoiceTotal (${invoice.toFixed(2)}) by ${diff.toFixed(2)}`,
        evidence: { sum, invoice, diff, tolerance },
      };
    }
    case "ALL_ITEMS_HAVE_PROCEDURE": {
      const missing = input.items
        .map((i, idx) => ({ idx, code: String(i.procedureCode || "").replace(/\s+/g, "") }))
        .filter((x) => !/^\d{4}$/.test(x.code));
      return {
        ok: missing.length === 0,
        detail: missing.length === 0 ? undefined : `Items missing 4-digit procedure code: ${missing.map((m) => m.idx).join(", ")}`,
        evidence: { missingIndexes: missing.map((m) => m.idx) },
      };
    }
    case "WILDCARD_FORBID_ALL_DOCUMENTS": {
      const present = gatherDocCodes(input);
      return {
        ok: present.length === 0,
        detail: present.length === 0 ? undefined : `Documents present in minimal mode: ${present.join(", ")}`,
        evidence: { present },
      };
    }
    case "OVERSEAS_EXPORTER_ADDRESS": {
      const dispatch = String(input.declaration.dispatchCountry || "").trim().toUpperCase();
      if (!dispatch || dispatch === "GB" || dispatch === "XI") {
        return { ok: true, detail: "Skipped: dispatch is GB/XI" };
      }
      const eori = String(input.declaration.exporterEori || "").trim();
      if (/^(GB|XI)\d{12}$/i.test(eori)) {
        return { ok: true, detail: "Skipped: GB/XI exporter EORI declared" };
      }
      const missing = (
        [
          ["exporterName", "Exporter name (DE 3/1)"],
          ["exporterCity", "Exporter city (DE 3/1)"],
          ["exporterLine", "Exporter address line (DE 3/1)"],
          ["exporterPostcode", "Exporter postcode (DE 3/1)"],
        ] as const
      ).filter(([key]) => !String(input.declaration[key as keyof typeof input.declaration] ?? "").trim());
      return {
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? undefined
            : `Missing overseas exporter fields: ${missing.map(([, label]) => label).join(", ")}`,
        evidence: { missingFields: missing.map(([key]) => key) },
      };
    }
    default: {
      // Unknown predicate name — treat as skip rather than fail so adding a
      // new predicate name in seed data doesn't crash older deployments.
      return { ok: true, detail: `Unknown predicate ${name as string} — skipped` };
    }
  }
}

// Merge the effects of every rule whose triggerScope matches the scenario.
// Used by the mapper to know which documents to strip pre-emission, without
// re-running the full evaluator.
export function activeEffects(rules: RuleDefinition[], input: ScenarioInput): Effects {
  const scenario = resolveScenario(input);
  const merged: Required<Effects> = {
    requiredDocuments: [],
    forbiddenDocuments: [],
    requiredFields: [],
    forbiddenFields: [],
    predicates: [],
  };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!ruleApplies(rule.triggerScope, scenario)) continue;
    if (rule.effects.requiredDocuments) merged.requiredDocuments.push(...rule.effects.requiredDocuments);
    if (rule.effects.forbiddenDocuments) merged.forbiddenDocuments.push(...rule.effects.forbiddenDocuments);
    if (rule.effects.requiredFields) merged.requiredFields.push(...rule.effects.requiredFields);
    if (rule.effects.forbiddenFields) merged.forbiddenFields.push(...rule.effects.forbiddenFields);
    if (rule.effects.predicates) merged.predicates.push(...rule.effects.predicates);
  }
  return merged;
}

export function evaluateRules(
  rules: RuleDefinition[],
  input: ScenarioInput,
): ValidationResult[] {
  const scenario = resolveScenario(input);
  const presentDocs = gatherDocCodes(input);
  const results: ValidationResult[] = [];

  // Sort core rules first so structural problems (transport identity,
  // valuation invariants) read before document specifics. Within docs the
  // tariff and curated layers are co-equal — both are independent obligations.
  const sourcePriority: Record<RuleSourceKind, number> = { core: 0, curated: 1, tariff: 2 };
  const ordered = [...rules].sort((a, b) =>
    sourcePriority[ruleSourceKind(a)] - sourcePriority[ruleSourceKind(b)],
  );

  for (const rule of ordered) {
    if (!rule.enabled) continue;
    const kind = ruleSourceKind(rule);
    const measureId = rule.metadata?.measureId;
    const base = {
      ruleId: rule.ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      source: kind,
      ...(measureId ? { measureId } : {}),
    } as const;

    if (!ruleApplies(rule.triggerScope, scenario)) {
      results.push({
        ...base,
        status: "skip",
        reason: "Trigger scope does not match this declaration",
      });
      continue;
    }

    const failures: ValidationResult[] = [];
    const e = rule.effects;

    for (const req of e.requiredDocuments || []) {
      const acceptable = [req.code, ...(req.alternatives || [])].map((c) => c.toUpperCase());
      const satisfied = acceptable.some((c) => presentDocs.includes(c));
      if (!satisfied) {
        failures.push({
          ...base,
          status: "fail",
          field: "additionalDocuments",
          reason:
            req.reason ||
            (acceptable.length === 1
              ? `Required document ${req.code} is missing`
              : `Required: one of ${acceptable.join(", ")} (none present)`),
          evidence: { acceptable, presentDocs },
        });
      }
    }
    for (const forb of e.forbiddenDocuments || []) {
      if (presentDocs.includes(forb.code.toUpperCase())) {
        failures.push({
          ...base,
          status: "fail",
          field: "additionalDocuments",
          reason: forb.reason || `Document ${forb.code} is not allowed for this scenario`,
          evidence: { forbiddenCode: forb.code },
        });
      }
    }
    for (const req of e.requiredFields || []) {
      if (!isPresent(getPath(input.declaration, input.items, req.path))) {
        failures.push({
          ...base,
          status: "fail",
          field: req.path,
          reason: req.reason || `Required field ${req.path} is missing`,
        });
      }
    }
    for (const forb of e.forbiddenFields || []) {
      if (isPresent(getPath(input.declaration, input.items, forb.path))) {
        failures.push({
          ...base,
          status: "fail",
          field: forb.path,
          reason: forb.reason || `Field ${forb.path} must not be set for this scenario`,
        });
      }
    }
    for (const pred of e.predicates || []) {
      const outcome = runPredicate(pred.name, input, { tolerance: pred.tolerance });
      if (!outcome.ok) {
        failures.push({
          ...base,
          status: "fail",
          field: pred.name,
          reason: pred.reason || outcome.detail || `Predicate ${pred.name} failed`,
          evidence: outcome.evidence,
        });
      }
    }

    if (failures.length === 0) {
      results.push({ ...base, status: "pass" });
    } else {
      results.push(...failures);
    }
  }

  return results;
}

// Action item collapsed from one or more failing rules. The user only needs
// to satisfy the action once — even if 4 different tariff measures all
// require document 9081, that's ONE thing for the user to do.
export interface ActionableFailure {
  // What the user must do, in human terms.
  action: "provide-document" | "declare-exemption" | "fix-field" | "remove-document" | "fix-predicate";
  // For provide-document: any one of these codes satisfies it.
  oneOf?: string[];
  // For fix-field / fix-predicate: which path or predicate name.
  field?: string;
  // Highest severity across the contributing rules.
  severity: Severity;
  // Plain-English reason. If multiple rules contributed, use the first.
  reason: string;
  // Provenance: every rule + measure that produced this action.
  causedBy: { ruleIds: string[]; measureIds: string[] };
  // Distinct source kinds that contributed. Lets the UI label each action
  // with where the obligation came from (Tariff, CDS-observed, Core).
  sources: RuleSourceKind[];
}

// Collapse the raw rule results into the minimum set of actions a user has
// to take. Multiple measures requiring the same document set produce ONE
// "provide one of [X, Y, Z]" action, not N copies.
export function summarizeFailures(results: ValidationResult[]): ActionableFailure[] {
  const actions = new Map<string, ActionableFailure>();
  const upgradeSeverity = (a: Severity, b: Severity): Severity =>
    a === "blocking" || b === "blocking" ? "blocking" : "advisory";

  const push = (key: string, action: ActionableFailure) => {
    const existing = actions.get(key);
    if (!existing) {
      actions.set(key, action);
      return;
    }
    existing.severity = upgradeSeverity(existing.severity, action.severity);
    for (const id of action.causedBy.ruleIds) {
      if (!existing.causedBy.ruleIds.includes(id)) existing.causedBy.ruleIds.push(id);
    }
    for (const id of action.causedBy.measureIds) {
      if (!existing.causedBy.measureIds.includes(id)) existing.causedBy.measureIds.push(id);
    }
    for (const s of action.sources) {
      if (!existing.sources.includes(s)) existing.sources.push(s);
    }
  };

  for (const r of results) {
    if (r.status !== "fail") continue;
    const ev = (r.evidence || {}) as { acceptable?: string[]; forbiddenCode?: string };

    if (r.field === "additionalDocuments" && ev.acceptable && ev.acceptable.length > 0) {
      const oneOf = [...ev.acceptable].sort();
      const key = `doc:${oneOf.join(",")}`;
      // Same Y/9-prefix logic as the parser: bag with no real doc codes is a
      // status-declaration ask, not a paperwork ask.
      const exemptionOnly = oneOf.every((c) => c.startsWith("Y") || /^9\d/.test(c));
      push(key, {
        action: exemptionOnly ? "declare-exemption" : "provide-document",
        oneOf,
        severity: r.severity,
        reason: exemptionOnly
          ? oneOf.length === 1
            ? `Declare exemption code ${oneOf[0]}`
            : `Declare one of these exemption codes: ${oneOf.join(" | ")}`
          : oneOf.length === 1
            ? `Provide document ${oneOf[0]}`
            : `Provide one of: ${oneOf.join(" | ")}`,
        causedBy: {
          ruleIds: [r.ruleId],
          measureIds: r.measureId ? [r.measureId] : [],
        },
        sources: [r.source],
      });
      continue;
    }

    if (r.field === "additionalDocuments" && ev.forbiddenCode) {
      const key = `forbid-doc:${ev.forbiddenCode}`;
      push(key, {
        action: "remove-document",
        oneOf: [ev.forbiddenCode],
        severity: r.severity,
        reason: r.reason || `Remove document ${ev.forbiddenCode}`,
        causedBy: {
          ruleIds: [r.ruleId],
          measureIds: r.measureId ? [r.measureId] : [],
        },
        sources: [r.source],
      });
      continue;
    }

    if (r.field) {
      const key = `field:${r.field}`;
      push(key, {
        action: r.field.toUpperCase() === r.field ? "fix-predicate" : "fix-field",
        field: r.field,
        severity: r.severity,
        reason: r.reason || `Fix ${r.field}`,
        causedBy: {
          ruleIds: [r.ruleId],
          measureIds: r.measureId ? [r.measureId] : [],
        },
        sources: [r.source],
      });
    }
  }

  // Blocking actions first; within a tier, fewest options first (most specific).
  return Array.from(actions.values()).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "blocking" ? -1 : 1;
    return (a.oneOf?.length || 0) - (b.oneOf?.length || 0);
  });
}
