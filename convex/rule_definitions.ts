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
