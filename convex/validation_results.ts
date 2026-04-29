import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { evaluateRules, type RuleDefinition, type ScenarioInput } from "./lib/rule_engine";

export const listForDeclaration = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw new Error("Declaration not found");
    if (decl.userId !== identity.subject) throw new Error("Unauthorized");
    return await ctx.db
      .query("validation_results")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();
  },
});

export const blockingFailures = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw new Error("Declaration not found");
    if (decl.userId !== identity.subject) throw new Error("Unauthorized");
    const all = await ctx.db
      .query("validation_results")
      .withIndex("by_declaration_status", (q) =>
        q.eq("declarationId", args.declarationId).eq("status", "fail"),
      )
      .collect();
    return all.filter((r) => r.severity === "blocking");
  },
});

// Re-evaluate every enabled rule against the declaration's current data and
// rewrite the validation_results rows. Idempotent — safe to call after any
// goods_items or declaration write.
export const recompute = mutation({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw new Error("Declaration not found");
    if (decl.userId !== identity.subject) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();

    const rules = (await ctx.db
      .query("rule_definitions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect()) as unknown as RuleDefinition[];

    const input: ScenarioInput = {
      declaration: {
        declarationType: decl.declarationType,
        route: decl.route,
        dispatchCountry: decl.dispatchCountry,
        transportMode: (decl as Record<string, unknown>).transportMode as string | undefined,
        transportId: (decl as Record<string, unknown>).transportId as string | undefined,
        transportIdType: (decl as Record<string, unknown>).transportIdType as string | undefined,
        valuationMethod: (decl as Record<string, unknown>).valuationMethod as string | undefined,
        mode: decl.mode,
        invoiceTotal: (decl as Record<string, unknown>).invoiceTotal as number | string | undefined,
      },
      items: items.map((i) => ({
        commodityCode: i.commodityCode,
        originCountry: i.originCountry,
        procedureCode: i.procedureCode,
        additionalProcedureCode: i.additionalProcedureCode,
        valuationMethod: (i as Record<string, unknown>).valuationMethod as string | undefined,
        // goods_items schema is permissive (v.any() everywhere) — preferenceCode
        // may not exist as a typed field but can still be present on the row.
        preferenceCode: (i as Record<string, unknown>).preferenceCode as string | undefined,
        additionalDocuments: Array.isArray(i.additionalDocuments) ? i.additionalDocuments : [],
      })),
    };

    const results = evaluateRules(rules, input);

    // Wipe previous results and write fresh — simpler than diffing and rules
    // are evaluated on demand, not historically tracked.
    const previous = await ctx.db
      .query("validation_results")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();
    for (const row of previous) await ctx.db.delete(row._id);

    const now = Date.now();
    for (const r of results) {
      await ctx.db.insert("validation_results", {
        declarationId: args.declarationId,
        userId: String(decl.userId || identity.subject),
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        severity: r.severity,
        status: r.status,
        source: r.source,
        measureId: r.measureId,
        field: r.field,
        reason: r.reason,
        evidence: r.evidence,
        evaluatedAt: now,
      });
    }

    const blockingFails = results.filter((r) => r.status === "fail" && r.severity === "blocking");
    return {
      total: results.length,
      blockingFailures: blockingFails.length,
      advisoryFailures: results.filter((r) => r.status === "fail" && r.severity === "advisory").length,
      blocked: blockingFails.length > 0,
    };
  },
});

// Debug variant of `recompute` callable via `npx convex run` (no Clerk session).
// Mirrors getItemsForDebug — still enforces ownership against a passed-in userId.
// Returns the failure list inline so a CLI caller can read it without a follow-up query.
export const recomputeForDebug = internalMutation({
  args: { declarationId: v.id("declarations"), userId: v.string() },
  handler: async (ctx, args) => {
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw new Error("Declaration not found");
    if (String(decl.userId ?? "") !== args.userId) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();

    const rules = (await ctx.db
      .query("rule_definitions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect()) as unknown as RuleDefinition[];

    const input: ScenarioInput = {
      declaration: {
        declarationType: decl.declarationType,
        route: decl.route,
        dispatchCountry: decl.dispatchCountry,
        transportMode: (decl as Record<string, unknown>).transportMode as string | undefined,
        transportId: (decl as Record<string, unknown>).transportId as string | undefined,
        transportIdType: (decl as Record<string, unknown>).transportIdType as string | undefined,
        valuationMethod: (decl as Record<string, unknown>).valuationMethod as string | undefined,
        mode: decl.mode,
        invoiceTotal: (decl as Record<string, unknown>).invoiceTotal as number | string | undefined,
      },
      items: items.map((i) => ({
        commodityCode: i.commodityCode,
        originCountry: i.originCountry,
        procedureCode: i.procedureCode,
        additionalProcedureCode: i.additionalProcedureCode,
        valuationMethod: (i as Record<string, unknown>).valuationMethod as string | undefined,
        preferenceCode: (i as Record<string, unknown>).preferenceCode as string | undefined,
        additionalDocuments: Array.isArray(i.additionalDocuments) ? i.additionalDocuments : [],
      })),
    };

    const results = evaluateRules(rules, input);

    const previous = await ctx.db
      .query("validation_results")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();
    for (const row of previous) await ctx.db.delete(row._id);

    const now = Date.now();
    for (const r of results) {
      await ctx.db.insert("validation_results", {
        declarationId: args.declarationId,
        userId: String(decl.userId || args.userId),
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        severity: r.severity,
        status: r.status,
        source: r.source,
        measureId: r.measureId,
        field: r.field,
        reason: r.reason,
        evidence: r.evidence,
        evaluatedAt: now,
      });
    }

    const blockingFails = results.filter((r) => r.status === "fail" && r.severity === "blocking");
    return {
      total: results.length,
      blockingFailures: blockingFails.length,
      advisoryFailures: results.filter((r) => r.status === "fail" && r.severity === "advisory").length,
      blocked: blockingFails.length > 0,
      // Surface the failure list directly so the CLI caller can act on it.
      failures: results
        .filter((r) => r.status === "fail")
        .map((r) => ({
          ruleId: r.ruleId,
          ruleName: r.ruleName,
          severity: r.severity,
          source: r.source,
          field: r.field,
          reason: r.reason,
        })),
    };
  },
});
