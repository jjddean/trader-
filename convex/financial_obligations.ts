import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { listFinancialObligationsForTenant } from "./lib/org_access";

/** FO smoke: list persisted obligation rows for the signed-in tenant (terminal / dashboard run). */
export const listForCurrentTenant = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { ok: false as const, error: "Unauthenticated" };
    }

    const take = Math.min(Math.max(args.limit ?? 50, 1), 500);
    const rows = await listFinancialObligationsForTenant(ctx, identity.subject, take);

    return {
      ok: true as const,
      count: rows.length,
      rows: rows.map((row) => ({
        declarationId: String(row.declarationId),
        mrn: row.mrn ?? null,
        obligationType: row.obligationType,
        amount: row.amount,
        currency: row.currency,
        authority: row.authority,
        status: row.status,
        updatedAt: row.updatedAt,
      })),
    };
  },
});

/** Dev/CI: list recent rows without Clerk (npx convex run internal/financial_obligations:debugListRecent). */
export const debugListRecent = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const take = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const rows = await ctx.db.query("financial_obligations").order("desc").take(take);
    return {
      count: rows.length,
      rows: rows.map((row) => ({
        declarationId: String(row.declarationId),
        mrn: row.mrn ?? null,
        obligationType: row.obligationType,
        amount: row.amount,
        authority: row.authority,
        status: row.status,
        orgId: row.orgId ?? null,
        userId: row.userId,
      })),
    };
  },
});
