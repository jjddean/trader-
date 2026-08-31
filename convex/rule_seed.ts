import { internalMutation } from "./_generated/server";

// Initial rule set, hand-curated from:
//   - HMRC CDS reject library (CDS12* family)
//   - WCO DEC-DMS:2 schema constraints
//   - Empirical TDR rejections recorded in docs/hmrc/ACTIVE/tdr/errors-handled.md
//
// The set is deliberately small. Each rule is keyed on the smallest
// trigger scope that captures the constraint, so adding the next lane
// (e.g. CPC 4400 with PVA, or HS-specific licensing) is additive.
//
// To extend: add an entry to RULES below and run
//   npx convex run rule_seed:seedAll
// The mutation upserts by ruleId so re-running is idempotent.

interface SeedRule {
  ruleId: string;
  name: string;
  description: string;
  severity: "blocking" | "advisory";
  enabled: boolean;
  source?: string;
  triggerScope: {
    procedureCodes?: string[];
    additionalProcedureCodes?: string[];
    commodityPrefixes?: string[];
    originCountries?: string[];
    dispatchCountries?: string[];
    valuationMethods?: string[];
    transportModes?: string[];
    declarationTypes?: string[];
    modes?: string[];
  };
  effects: {
    requiredDocuments?: { code: string; lpcoExemptionCode?: string; reason?: string }[];
    forbiddenDocuments?: { code: string; reason?: string }[];
    requiredFields?: { path: string; reason?: string }[];
    forbiddenFields?: { path: string; reason?: string }[];
    predicates?: { name: string; reason?: string; tolerance?: number }[];
  };
  metadata?: {
    evidence?: {
      mrn?: string;
      conversationId?: string;
      functionCode?: string;
      references?: string[];
      confidence?: "high" | "medium";
      observedAt?: number;
    };
  };
}

const RULES: SeedRule[] = [
  // -------- Universal (any import) --------
  {
    ruleId: "DEC-DISPATCH-COUNTRY",
    name: "Dispatch country (DE 5/14) is mandatory",
    description:
      "Every import declaration must carry the country goods were shipped FROM. CDS rejects with CDS10001/CDS12100 22B 090 when ExportCountry.ID is blank or set to GB on a non-UK lane.",
    severity: "blocking",
    enabled: true,
    source: "HMRC CDS guide DE 5/14; empirical TDR (CDS12100 22B 090)",
    triggerScope: { declarationTypes: ["IMA", "IMD", "IMY", "IMZ"] },
    effects: {
      requiredFields: [
        { path: "declaration.dispatchCountry", reason: "DE 5/14 dispatch country must be the country goods shipped FROM (e.g. BR for Brazil)." },
      ],
    },
  },
  {
    ruleId: "DEC-TRANSPORT-IDENTITY",
    name: "Transport identity (DE 7/9 + 7/14) must be populated",
    description:
      "Both BorderTransportMeans and ArrivalTransportMeans need the full triplet (ID + IdentificationTypeCode + ModeCode). CDS rejects R123/CDS12073 when ID or IdentificationTypeCode is missing.",
    severity: "blocking",
    enabled: true,
    source: "WCO DEC-DMS:2; CDS R123 / CDS12073; empirical TDR pass 2 (2026-04-25)",
    triggerScope: { declarationTypes: ["IMA", "IMD"] },
    effects: {
      requiredFields: [
        { path: "declaration.transportId", reason: "Transport ID (vessel/wagon/flight) required for R123." },
        { path: "declaration.transportIdType", reason: "Transport ID type code (DE 7/7) required for R123." },
        { path: "declaration.transportMode", reason: "Mode of transport (DE 7/4) required for CDS12073." },
      ],
    },
  },
  {
    ruleId: "DEC-TRANSACTION-NATURE",
    name: "Nature of transaction (DE 8/5) is mandatory",
    description:
      "GoodsShipment/TransactionNatureCode (WCOID 103, DE 8/5) must be present. CDS12073 fires when absent; Trade Test passing baseline uses 11.",
    severity: "blocking",
    enabled: true,
    source: "docs/hmrc/ARCHIVE/trade-test/errors-handled.md CDS12073; WCOID 103",
    triggerScope: { declarationTypes: ["IMA", "IMD", "IMY", "IMZ"] },
    effects: {
      requiredFields: [
        { path: "declaration.transactionNatureCode", reason: "DE 8/5 nature of transaction (e.g. 11)." },
      ],
    },
  },
  {
    ruleId: "DEC-OVERSEAS-EXPORTER",
    name: "Overseas exporter Name+Address required (DE 3/1)",
    description:
      "When dispatch country is not GB/XI, CDS requires foreign exporter Name+Address — no mapper placeholders.",
    severity: "blocking",
    enabled: true,
    source: "docs/hmrc/ACTIVE/tdr/mapping/de-3-x-parties.md; h1-operational-invariants",
    triggerScope: { declarationTypes: ["IMA", "IMD", "IMY", "IMZ"] },
    effects: {
      predicates: [
        { name: "OVERSEAS_EXPORTER_ADDRESS", reason: "Overseas import requires exporter Name+Address on Core Schema." },
      ],
    },
  },

  // -------- Valuation invariants --------
  {
    ruleId: "H1-VALUATION-METHOD1-ONLY",
    name: "H1 currently supports valuation Method 1 only",
    description:
      "FreightCode H1 files DE 4/16 Method 1 (transaction value) only. SPV/SIV additional procedures E01, E02 and 1SV require Method 4 and are blocked. Represented consignments above £20,000 require an explicit Method 1 confirmation (Group 4 DE 4/16).",
    severity: "blocking",
    enabled: true,
    source: "docs/hmrc/ACTIVE/tdr/mapping/de-4-x-valuation.md; Group 4 completion guide DE 4/16",
    triggerScope: {},
    effects: {
      predicates: [{ name: "H1_VALUATION_FILEABLE" }],
    },
  },
  {
    ruleId: "INV-METHOD1-N935",
    name: "Method 1 valuation requires N935 (commercial invoice)",
    description:
      "DE 4/16 = 1 (transaction value) requires N935 on every goods item per the wco-dec valuation-method-types invariant.",
    severity: "blocking",
    enabled: true,
    source: "github.com/hmrc/wco-dec valuation-method-types.json",
    triggerScope: { valuationMethods: ["1"] },
    effects: {
      requiredDocuments: [
        { code: "N935", reason: "Commercial invoice required for Method 1 transaction value." },
      ],
    },
  },

  // -------- Mode lock --------
  {
    ruleId: "MODE-MINIMAL-LOCK",
    name: "Minimal mode forbids any AdditionalDocument",
    description:
      "When the declaration is in minimal mode (default for new lanes) the engine refuses every document, regardless of code. The user must promote the lane to enriched mode before adding docs — that way bad data can't slip in by default.",
    severity: "blocking",
    enabled: true,
    source: "Internal — TradeDNA minimal-mode contract",
    triggerScope: { modes: ["minimal"] },
    effects: {
      predicates: [
        { name: "WILDCARD_FORBID_ALL_DOCUMENTS", reason: "Lane is in minimal mode — promote to enriched before adding documents." },
      ],
    },
  },
  // -------- Cross-field arithmetic --------
  {
    ruleId: "VALUE-MATCH-INVOICE",
    name: "Sum of item values must match declaration invoiceTotal",
    description:
      "When the user has set declaration.invoiceTotal explicitly, the sum of goods_items.valueAmount must match within 0.01. Catches data entry drift before CDS does.",
    severity: "blocking",
    enabled: true,
    source: "Empirical — CDS routinely rejects invoice/item value mismatches",
    triggerScope: {},
    effects: {
      predicates: [
        { name: "ITEM_VALUE_SUM_MATCHES_INVOICE", tolerance: 0.01 },
      ],
    },
  },
];

// Rules that USED to live in this seed file but were removed because they
// were guesses rather than authoritative facts. seedAll disables them so
// re-running this script after a trim doesn't leave stale rules enabled.
//
// NOTE: D006/D028/D031/360 were retired as guesses, then RE-INSTATED below
// Legacy BR chicken lane only — not active lane (see docs/hmrc/ARCHIVE/trade-test/lane.md). CURATED rules after CDS empirically rejected HS 0207129000 / BR /
// CPC 4000 submission for missing exactly those codes (TDR rejection,
// 2026-04-26). The new CURATED-* IDs supersede the retired CPC-4000-* IDs.
const RETIRED_RULE_IDS: string[] = [
  "ORIGIN-PREFERENCE-NO-U110",
  "CPC-4000-NO-D006",
  "CPC-4000-NO-D031",
  "CPC-4000-NO-D028",
  "CPC-4000-NO-360",      // historical alt-spelling
  "CPC-4000-NO-DOC-360",  // actual ruleId in DB
];

// Curated rules — each backed by a real CDS rejection. These are NOT guesses:
// every entry cites the rejection that proved the requirement exists. They
// fill gaps the gov.uk public Trade Tariff API does not surface (e.g. D006
// CITES, D028 CHED, D031 customs decision references, 360 CHED-PP).
const CURATED_RULES: SeedRule[] = [
  {
    ruleId: "CURATED-4000-02071290-BR-D006",
    name: "Curated: D006 required for HS 02071290 / BR / CPC 4000",
    description:
      "CDS rejected an HS 0207129000 (frozen chicken cuts) import from BR under CPC 4000 for missing D006. Required even though the public Trade Tariff API does not surface D006 in measure_conditions for this commodity.",
    severity: "blocking",
    enabled: true,
    source: "cds-rejection:TDR-2026-04-26",
    triggerScope: {
      procedureCodes: ["4000"],
      commodityPrefixes: ["02071290"],
      originCountries: ["BR"],
    },
    effects: {
      requiredDocuments: [{ code: "D006", reason: "Required by CDS (observed): rejection cited missing D006 on AdditionalDocument 02A." }],
    },
    metadata: {
      evidence: {
        functionCode: "03",
        references: ["68A", "02A"],
        confidence: "high",
      },
    },
  },
  {
    ruleId: "CURATED-4000-02071290-BR-D028",
    name: "Curated: D028 required for HS 02071290 / BR / CPC 4000",
    description:
      "CDS rejected an HS 0207129000 import from BR under CPC 4000 for missing D028. Required even though the public Trade Tariff API does not surface D028 in measure_conditions for this commodity.",
    severity: "blocking",
    enabled: true,
    source: "cds-rejection:TDR-2026-04-26",
    triggerScope: {
      procedureCodes: ["4000"],
      commodityPrefixes: ["02071290"],
      originCountries: ["BR"],
    },
    effects: {
      requiredDocuments: [{ code: "D028", reason: "Required by CDS (observed): rejection cited missing D028 on AdditionalDocument 02A." }],
    },
    metadata: {
      evidence: {
        functionCode: "03",
        references: ["68A", "02A"],
        confidence: "high",
      },
    },
  },
  {
    ruleId: "CURATED-4000-02071290-BR-D031",
    name: "Curated: D031 required for HS 02071290 / BR / CPC 4000",
    description:
      "CDS rejected an HS 0207129000 import from BR under CPC 4000 for missing D031. Required even though the public Trade Tariff API does not surface D031 in measure_conditions for this commodity.",
    severity: "blocking",
    enabled: true,
    source: "cds-rejection:TDR-2026-04-26",
    triggerScope: {
      procedureCodes: ["4000"],
      commodityPrefixes: ["02071290"],
      originCountries: ["BR"],
    },
    effects: {
      requiredDocuments: [{ code: "D031", reason: "Required by CDS (observed): rejection cited missing D031 on AdditionalDocument 02A." }],
    },
    metadata: {
      evidence: {
        functionCode: "03",
        references: ["68A", "02A"],
        confidence: "high",
      },
    },
  },
  {
    ruleId: "CURATED-4000-02071290-BR-360",
    name: "Curated: 360 required for HS 02071290 / BR / CPC 4000",
    description:
      "CDS rejected an HS 0207129000 import from BR under CPC 4000 for missing document code 360 (CHED-PP / phytosanitary equivalent). Required even though the public Trade Tariff API does not surface 360 in measure_conditions for this commodity.",
    severity: "blocking",
    enabled: true,
    source: "cds-rejection:TDR-2026-04-26",
    triggerScope: {
      procedureCodes: ["4000"],
      commodityPrefixes: ["02071290"],
      originCountries: ["BR"],
    },
    effects: {
      requiredDocuments: [{ code: "360", reason: "Required by CDS (observed): rejection cited missing 360 on AdditionalDocument 02A." }],
    },
    metadata: {
      evidence: {
        functionCode: "03",
        references: ["68A", "02A"],
        confidence: "high",
      },
    },
  },
];

export const seedAll = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    let retired = 0;
    let curated = 0;
    for (const ruleId of RETIRED_RULE_IDS) {
      const stale = await ctx.db
        .query("rule_definitions")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId))
        .first();
      if (stale && stale.enabled) {
        await ctx.db.patch(stale._id, { enabled: false, updatedAt: now });
        retired++;
      }
    }
    const allRules = [...RULES, ...CURATED_RULES];
    for (const rule of allRules) {
      const existing = await ctx.db
        .query("rule_definitions")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", rule.ruleId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          enabled: rule.enabled,
          source: rule.source,
          triggerScope: rule.triggerScope,
          effects: rule.effects,
          metadata: rule.metadata,
          updatedAt: now,
        });
        updated++;
      } else {
        await ctx.db.insert("rule_definitions", {
          ...rule,
          createdAt: now,
          updatedAt: now,
        });
        inserted++;
      }
      if (rule.ruleId.startsWith("CURATED-")) curated++;
    }
    return { inserted, updated, retired, curated, total: allRules.length };
  },
});
