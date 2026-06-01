import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

const triggerScopeValidator = v.object({
  procedureCodes: v.optional(v.array(v.string())),
  additionalProcedureCodes: v.optional(v.array(v.string())),
  commodityPrefixes: v.optional(v.array(v.string())),
  originCountries: v.optional(v.array(v.string())),
  excludedOriginCountries: v.optional(v.array(v.string())),
  requiresPreferenceClaim: v.optional(v.boolean()),
  dispatchCountries: v.optional(v.array(v.string())),
  valuationMethods: v.optional(v.array(v.string())),
  transportModes: v.optional(v.array(v.string())),
  declarationTypes: v.optional(v.array(v.string())),
  modes: v.optional(v.array(v.string())),
});

const effectsValidator = v.object({
  requiredDocuments: v.optional(v.array(v.object({
    code: v.string(),
    alternatives: v.optional(v.array(v.string())),
    lpcoExemptionCode: v.optional(v.string()),
    reason: v.optional(v.string()),
  }))),
  forbiddenDocuments: v.optional(v.array(v.object({
    code: v.string(),
    reason: v.optional(v.string()),
  }))),
  requiredFields: v.optional(v.array(v.object({
    path: v.string(),
    reason: v.optional(v.string()),
  }))),
  forbiddenFields: v.optional(v.array(v.object({
    path: v.string(),
    reason: v.optional(v.string()),
  }))),
  predicates: v.optional(v.array(v.object({
    name: v.string(),
    reason: v.optional(v.string()),
    tolerance: v.optional(v.number()),
  }))),
});

const metadataValidator = v.object({
  measureId: v.optional(v.string()),
  measureTypeId: v.optional(v.string()),
  measureTypeDescription: v.optional(v.string()),
  geographicalAreaId: v.optional(v.string()),
  geographicalAreaDescription: v.optional(v.string()),
  effectiveStartDate: v.optional(v.string()),
  effectiveEndDate: v.optional(v.string()),
  evidence: v.optional(v.object({
    mrn: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    functionCode: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    confidence: v.optional(v.string()),
    observedAt: v.optional(v.number()),
  })),
});

export const listEnabled = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("rule_definitions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

export const listAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("rule_definitions").collect();
  },
});

export const getByRuleId = query({
  args: { ruleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rule_definitions")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
  },
});

// Upsert by ruleId. Used by the seed module so re-seeding doesn't duplicate.
export const upsert = mutation({
  args: {
    ruleId: v.string(),
    name: v.string(),
    description: v.string(),
    severity: v.string(),
    enabled: v.boolean(),
    source: v.optional(v.string()),
    triggerScope: triggerScopeValidator,
    effects: effectsValidator,
    metadata: v.optional(metadataValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("rule_definitions")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        severity: args.severity,
        enabled: args.enabled,
        source: args.source,
        triggerScope: args.triggerScope,
        effects: args.effects,
        metadata: args.metadata,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("rule_definitions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal variant for the seed script — bypasses Clerk auth so it can run
// from a Node action or a one-off migration without an authenticated user.
export const upsertInternal = internalMutation({
  args: {
    ruleId: v.string(),
    name: v.string(),
    description: v.string(),
    severity: v.string(),
    enabled: v.boolean(),
    source: v.optional(v.string()),
    triggerScope: triggerScopeValidator,
    effects: effectsValidator,
    metadata: v.optional(metadataValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rule_definitions")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        severity: args.severity,
        enabled: args.enabled,
        source: args.source,
        triggerScope: args.triggerScope,
        effects: args.effects,
        metadata: args.metadata,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("rule_definitions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Best-effort extraction of CDS document codes from a rejection ErrorReason.
// We're looking for codes the rejection cites verbatim — D006, N853, C084,
// Y930, 9009, L001, 360. Avoids matching arbitrary 3-digit numbers by
// requiring either a leading letter or anchoring against a known short list.
const KNOWN_3DIGIT_DOC_CODES = new Set([
  "360", // CHED-PP equivalent
  "361", "660", "661", "664", "667", "669",
]);
function extractDocCodes(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const lettered = text.match(/\b([CDNYL]\d{3})\b/gi) || [];
  for (const m of lettered) out.add(m.toUpperCase());
  const ninePrefixed = text.match(/\b(9\d{3})\b/g) || [];
  for (const m of ninePrefixed) out.add(m);
  const threeDigit = text.match(/\b(\d{3})\b/g) || [];
  for (const m of threeDigit) {
    if (KNOWN_3DIGIT_DOC_CODES.has(m)) out.add(m);
  }
  return Array.from(out);
}

// Walk the structured errors from a CDS rejection (FunctionCode 03), pull
// out doc-code mentions tied to AdditionalDocument pointers, and propose
// matching curated rules. Disabled-by-default — never auto-blocks a future
// submission. The user reviews + promotes via setEnabled.
//
// Public mutation: same trust model as notifications.saveWebhook — the
// webhook route's bearer-token check is the trust boundary. The
// disabled-by-default insert is the secondary safety net: even if a
// caller pollutes the table, nothing gates a real submission.
export const proposeCuratedFromRejection = mutation({
  args: {
    mrn: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    fieldErrors: v.array(v.object({
      field: v.string(),
      code: v.optional(v.string()),
      reason: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    if (!args.mrn || args.mrn === "UNKNOWN") {
      return { proposed: 0, skipped: "no MRN" as const };
    }
    const declaration = await ctx.db
      .query("declarations")
      .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
      .first();
    if (!declaration) {
      return { proposed: 0, skipped: "no declaration for MRN" as const };
    }
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", declaration._id as any))
      .collect();
    const item = items[0];
    if (!item) {
      return { proposed: 0, skipped: "no items on declaration" as const };
    }
    const commodity = String(item.commodityCode || "").replace(/\s+/g, "");
    const commodityPrefix = commodity ? commodity.substring(0, 8) : undefined;
    const originCountry = String(item.originCountry || "").trim().toUpperCase() || undefined;
    const procedureCode = String(item.procedureCode || "").replace(/\s+/g, "").substring(0, 4) || undefined;
    if (!commodityPrefix || !originCountry || !procedureCode) {
      return { proposed: 0, skipped: "scope incomplete" as const };
    }

    // Only consider errors whose field pointer references an AdditionalDocument
    // section (02A) or whose reason mentions "AdditionalDocument" / "document".
    // Anything else is unrelated to the curated doc-code layer.
    const docRelated = args.fieldErrors.filter((fe) => {
      const f = (fe.field || "").toLowerCase();
      const r = (fe.reason || "").toLowerCase();
      return f.includes("additionaldocument") || f.includes("02a") ||
        r.includes("additional document") || r.includes("document code");
    });
    const docCodes = new Set<string>();
    for (const fe of docRelated) {
      for (const c of extractDocCodes(fe.reason)) docCodes.add(c);
    }
    if (docCodes.size === 0) {
      return { proposed: 0, skipped: "no doc codes detected" as const };
    }

    const now = Date.now();
    const proposals: Array<{ ruleId: string; action: "inserted" | "updated" }> = [];
    for (const docCode of docCodes) {
      const ruleId = ["CURATED", procedureCode, commodityPrefix, originCountry, docCode].join("-");
      const existing = await ctx.db
        .query("rule_definitions")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId))
        .first();
      const description =
        `Auto-proposed from CDS rejection${args.mrn ? ` MRN ${args.mrn}` : ""}.` +
        ` Document ${docCode} cited as missing on AdditionalDocument. Disabled by default — review evidence and promote via rule_definitions.setEnabled.`;
      const triggerScope = {
        commodityPrefixes: [commodityPrefix],
        originCountries: [originCountry],
        procedureCodes: [procedureCode],
      };
      const effects = {
        requiredDocuments: [{
          code: docCode,
          reason: `Required by CDS (auto-observed from rejection).`,
        }],
      };
      const evidence = {
        mrn: args.mrn,
        conversationId: args.conversationId,
        functionCode: "03",
        references: ["02A"],
        confidence: "medium" as const,
        observedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, {
          description,
          metadata: { evidence },
          updatedAt: now,
        });
        proposals.push({ ruleId, action: "updated" });
      } else {
        await ctx.db.insert("rule_definitions", {
          ruleId,
          name: `Auto: ${docCode} required for ${commodityPrefix} / ${originCountry} / CPC ${procedureCode}`,
          description,
          severity: "blocking",
          enabled: false, // never auto-enable
          source: `cds-rejection:${args.conversationId || args.mrn}`,
          triggerScope,
          effects,
          metadata: { evidence },
          createdAt: now,
          updatedAt: now,
        });
        proposals.push({ ruleId, action: "inserted" });
      }
    }
    return { proposed: proposals.length, proposals };
  },
});

// Auto-ingest a curated rule observed from a CDS rejection. Disabled by
// default — the user must explicitly promote it before it gates submissions.
// Idempotent on (commodityPrefix, originCountry, procedureCode, docCode).
export const upsertCuratedFromRejection = internalMutation({
  args: {
    docCode: v.string(),                    // e.g. "D006"
    commodityPrefix: v.optional(v.string()),// e.g. "84713000"
    originCountry: v.optional(v.string()),  // e.g. "BR"
    procedureCode: v.optional(v.string()),  // e.g. "4000"
    severity: v.optional(v.string()),       // defaults to "blocking"
    evidence: v.object({
      mrn: v.optional(v.string()),
      conversationId: v.optional(v.string()),
      functionCode: v.optional(v.string()),
      references: v.optional(v.array(v.string())),
      confidence: v.optional(v.string()),   // "high" | "medium"
      observedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const ruleId = [
      "CURATED",
      args.procedureCode || "ANY",
      args.commodityPrefix || "ANY",
      args.originCountry || "ANY",
      args.docCode,
    ].join("-");
    const now = Date.now();
    const existing = await ctx.db
      .query("rule_definitions")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId))
      .first();
    const description =
      `Document ${args.docCode} required, observed from CDS rejection` +
      (args.evidence.mrn ? ` MRN ${args.evidence.mrn}` : "") +
      ". Rule starts disabled — promote manually after verification.";
    const triggerScope = {
      commodityPrefixes: args.commodityPrefix ? [args.commodityPrefix] : undefined,
      originCountries: args.originCountry ? [args.originCountry] : undefined,
      procedureCodes: args.procedureCode ? [args.procedureCode] : undefined,
    };
    const effects = {
      requiredDocuments: [{
        code: args.docCode,
        reason: `Required by CDS (observed); rejected when missing.`,
      }],
    };
    const metadata = { evidence: { ...args.evidence, observedAt: args.evidence.observedAt ?? now } };
    if (existing) {
      // Append fresh evidence sighting — but never auto-enable. The user owns
      // the promotion decision so a misclassified rejection can't auto-block
      // a future declaration.
      await ctx.db.patch(existing._id, {
        description,
        metadata,
        updatedAt: now,
      });
      return { ruleId, action: "updated" as const, id: existing._id };
    }
    const id = await ctx.db.insert("rule_definitions", {
      ruleId,
      name: `Curated: ${args.docCode} required for ${args.commodityPrefix || "*"} / ${args.originCountry || "*"} / CPC ${args.procedureCode || "*"}`,
      description,
      severity: args.severity || "blocking",
      enabled: false,
      source: `cds-rejection:${args.evidence.conversationId || args.evidence.mrn || "unknown"}`,
      triggerScope,
      effects,
      metadata,
      createdAt: now,
      updatedAt: now,
    });
    return { ruleId, action: "inserted" as const, id };
  },
});

export const setEnabled = mutation({
  args: { ruleId: v.string(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("rule_definitions")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    if (!existing) throw new Error(`Rule ${args.ruleId} not found`);
    await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: Date.now() });
  },
});

// CLI-callable variant for bulk-toggling rules during debugging.
export const setEnabledBulkInternal = internalMutation({
  args: { ruleIds: v.array(v.string()), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results: Array<{ ruleId: string; action: "patched" | "missing" }> = [];
    for (const ruleId of args.ruleIds) {
      const existing = await ctx.db
        .query("rule_definitions")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId))
        .first();
      if (!existing) {
        results.push({ ruleId, action: "missing" });
        continue;
      }
      await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: now });
      results.push({ ruleId, action: "patched" });
    }
    return results;
  },
});

// CLI-callable severity flip — used to demote a rule from "blocking" to
// "advisory" (or back) when iterating during a Trade Test debug cycle.
export const setSeverityBulkInternal = internalMutation({
  args: { ruleIds: v.array(v.string()), severity: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results: Array<{ ruleId: string; action: "patched" | "missing" }> = [];
    for (const ruleId of args.ruleIds) {
      const existing = await ctx.db
        .query("rule_definitions")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId))
        .first();
      if (!existing) {
        results.push({ ruleId, action: "missing" });
        continue;
      }
      await ctx.db.patch(existing._id, { severity: args.severity, updatedAt: now });
      results.push({ ruleId, action: "patched" });
    }
    return results;
  },
});
