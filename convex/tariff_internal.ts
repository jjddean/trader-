import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/** Default TTL for tariff cache refresh (7 days). */
export const TARIFF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ruleValidator = v.object({
  ruleId: v.string(),
  name: v.string(),
  description: v.string(),
  severity: v.string(),
  enabled: v.boolean(),
  source: v.string(),
  triggerScope: v.object({
    commodityPrefixes: v.optional(v.array(v.string())),
    originCountries: v.optional(v.array(v.string())),
    excludedOriginCountries: v.optional(v.array(v.string())),
    requiresPreferenceClaim: v.optional(v.boolean()),
    dispatchCountries: v.optional(v.array(v.string())),
  }),
  effects: v.object({
    requiredDocuments: v.optional(v.array(v.object({
      code: v.string(),
      alternatives: v.optional(v.array(v.string())),
      reason: v.optional(v.string()),
    }))),
  }),
  metadata: v.optional(v.object({
    measureId: v.optional(v.string()),
    measureTypeId: v.optional(v.string()),
    measureTypeDescription: v.optional(v.string()),
    geographicalAreaId: v.optional(v.string()),
    geographicalAreaDescription: v.optional(v.string()),
    effectiveStartDate: v.optional(v.string()),
    effectiveEndDate: v.optional(v.string()),
  })),
});

// Upsert the tariff_cache row and the parsed rule_definitions in one
// transaction. Disables any previously-derived rule for this commodity that
// no longer appears in the new fetch — guards against stale rules surviving
// a tariff change.
export const upsertCacheAndRules = internalMutation({
  args: {
    commodityCode: v.string(),
    sourceUrl: v.string(),
    rawResponse: v.any(),
    derivedRuleIds: v.array(v.string()),
    rules: v.array(ruleValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existingCache = await ctx.db
      .query("tariff_cache")
      .withIndex("by_commodity", (q) => q.eq("commodityCode", args.commodityCode))
      .first();

    const previousRuleIds: string[] = existingCache?.derivedRuleIds || [];

    if (existingCache) {
      await ctx.db.patch(existingCache._id, {
        fetchedAt: now,
        sourceUrl: args.sourceUrl,
        rawResponse: args.rawResponse,
        derivedRuleIds: args.derivedRuleIds,
      });
    } else {
      await ctx.db.insert("tariff_cache", {
        commodityCode: args.commodityCode,
        fetchedAt: now,
        sourceUrl: args.sourceUrl,
        rawResponse: args.rawResponse,
        derivedRuleIds: args.derivedRuleIds,
      });
    }

    // Disable any previously-derived rule that didn't reappear in this
    // fetch. We don't delete: keeping the row preserves audit history of
    // rules that USED to apply.
    const stillActive = new Set(args.derivedRuleIds);
    for (const oldRuleId of previousRuleIds) {
      if (stillActive.has(oldRuleId)) continue;
      const oldRule = await ctx.db
        .query("rule_definitions")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", oldRuleId))
        .first();
      if (oldRule) {
        await ctx.db.patch(oldRule._id, { enabled: false, updatedAt: now });
      }
    }

    let inserted = 0;
    let updated = 0;
    for (const rule of args.rules) {
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
    }
    return { inserted, updated, deactivated: previousRuleIds.length - args.rules.length };
  },
});

export const getCache = query({
  args: { commodityCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tariff_cache")
      .withIndex("by_commodity", (q) => q.eq("commodityCode", args.commodityCode))
      .first();
  },
});

export const listCommodityCodesInUse = internalQuery({
  args: { itemLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const items = await ctx.db.query("goods_items").take(args.itemLimit ?? 5000);
    const codes = new Set<string>();
    for (const item of items) {
      const code = String(item.commodityCode || "").trim();
      if (/^\d{10}$/.test(code)) codes.add(code);
    }
    return Array.from(codes).sort();
  },
});

export const listStaleCommodityCodes = internalQuery({
  args: {
    ttlMs: v.optional(v.number()),
    limit: v.optional(v.number()),
    itemLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ttlMs = args.ttlMs ?? TARIFF_CACHE_TTL_MS;
    const limit = args.limit ?? 20;
    const cutoff = Date.now() - ttlMs;
    const items = await ctx.db.query("goods_items").take(args.itemLimit ?? 5000);
    const codes = new Set<string>();
    for (const item of items) {
      const code = String(item.commodityCode || "").trim();
      if (/^\d{10}$/.test(code)) codes.add(code);
    }

    const stale: string[] = [];
    for (const code of Array.from(codes).sort()) {
      const cache = await ctx.db
        .query("tariff_cache")
        .withIndex("by_commodity", (q) => q.eq("commodityCode", code))
        .first();
      if (!cache || cache.fetchedAt < cutoff) stale.push(code);
      if (stale.length >= limit) break;
    }
    return stale;
  },
});
