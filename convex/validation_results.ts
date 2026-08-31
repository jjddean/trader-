import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { evaluateRules, scenarioInputFromRecords, type RuleDefinition } from "./lib/rule_engine";
import { canAccessDeclaration, orgIdFromDeclaration } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";
import { notify } from "./lib/notify";

export const listForDeclaration = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw userError("declaration_not_found", "Declaration not found");
    if (!(await canAccessDeclaration(ctx, identity.subject, decl))) throw forbiddenError();
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
    if (!identity) throw unauthenticatedError();
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw userError("declaration_not_found", "Declaration not found");
    if (!(await canAccessDeclaration(ctx, identity.subject, decl))) throw forbiddenError();
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
    if (!identity) throw unauthenticatedError();
    const decl = await ctx.db.get(args.declarationId);
    if (!decl) throw userError("declaration_not_found", "Declaration not found");
    if (!(await canAccessDeclaration(ctx, identity.subject, decl))) throw forbiddenError();

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();

    const rules = (await ctx.db
      .query("rule_definitions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect()) as unknown as RuleDefinition[];

    const input = scenarioInputFromRecords(
      decl as unknown as Record<string, unknown>,
      items as unknown as Array<Record<string, unknown>>,
    );

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

    // Transition-only. `recompute` runs after every item edit, so emitting on
    // state rather than on change would make this the loudest source in the app
    // by an order of magnitude. Only crossing the blocked/unblocked boundary is
    // worth telling anyone about.
    const wasBlocked = previous.some((r) => r.status === "fail" && r.severity === "blocking");
    const isBlocked = blockingFails.length > 0;
    if (wasBlocked !== isBlocked) {
      await notify(ctx, {
        event: isBlocked ? "validation.blocking_failure" : "validation.cleared",
        userId: String(decl.userId || identity.subject),
        orgId: orgIdFromDeclaration(decl),
        title: isBlocked
          ? `${blockingFails.length} blocking validation ${blockingFails.length === 1 ? "failure" : "failures"}`
          : "Validation passed",
        body: isBlocked
          ? blockingFails.slice(0, 2).map((r) => r.ruleName).join("; ")
          : undefined,
        href: `/dashboard/declarations/${args.declarationId}`,
        declarationId: args.declarationId,
        // One standing row per declaration: the latest verdict replaces the last.
        dedupeKey: `validation:${args.declarationId}`,
      });
    }

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
    if (!decl) throw userError("declaration_not_found", "Declaration not found");
    if (String(decl.userId ?? "") !== args.userId) throw forbiddenError();

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();

    const rules = (await ctx.db
      .query("rule_definitions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect()) as unknown as RuleDefinition[];

    const input = scenarioInputFromRecords(
      decl as unknown as Record<string, unknown>,
      items as unknown as Array<Record<string, unknown>>,
    );

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
