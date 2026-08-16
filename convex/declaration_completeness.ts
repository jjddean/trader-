import { v } from "convex/values";
import { query } from "./_generated/server";
import { evaluateCompleteness } from "./lib/declaration_completeness";
import type { RuleDefinition } from "./lib/rule_engine";
import { canAccessDeclaration } from "./lib/org_access";
import { forbiddenError, unauthenticatedError } from "./lib/user_errors";

// Live completeness state for a declaration.
//
// SINGLE SOURCE OF TRUTH: convex/lib/rule_engine.ts evaluateRules.
// This query loads enabled rules from rule_definitions, runs the engine,
// and returns the failures translated into the {field, reason} shape the
// UI consumes. No field rules live here — adding a check = adding a row
// to rule_definitions (or seeding via convex/rule_seed.ts).
export const getStatus = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration) {
      return { ready: false, missing: [{ field: "declaration", reason: "Declaration not found.", ruleId: "system:not-found" }] };
    }
    if (!(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(2000);

    const rules = (await ctx.db
      .query("rule_definitions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect()) as unknown as RuleDefinition[];

    return evaluateCompleteness({
      rules,
      declaration: declaration as Record<string, unknown>,
      items: items as Array<Record<string, unknown>>,
    });
  },
});
