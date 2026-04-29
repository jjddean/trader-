import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// Look up a single code in a list. Returns null when not present.
export const lookupCode = query({
  args: { listName: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const normalised = args.value.trim().toUpperCase();
    if (!normalised) return null;
    return await ctx.db
      .query("cds_code_lists")
      .withIndex("by_list_value", (q) =>
        q.eq("listName", args.listName).eq("value", normalised),
      )
      .first();
  },
});

// Bulk-validate a set of codes against a list. Returns the values that are
// missing — used by the dry-run preflight to fail early.
export const validateCodes = query({
  args: {
    listName: v.string(),
    values: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const missing: string[] = [];
    for (const raw of args.values) {
      const normalised = raw.trim().toUpperCase();
      if (!normalised) continue;
      const found = await ctx.db
        .query("cds_code_lists")
        .withIndex("by_list_value", (q) =>
          q.eq("listName", args.listName).eq("value", normalised),
        )
        .first();
      if (!found) missing.push(normalised);
    }
    return { missing };
  },
});

export const listCodes = query({
  args: { listName: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cds_code_lists")
      .withIndex("by_list", (q) => q.eq("listName", args.listName))
      .take(args.limit ?? 1000);
  },
});

// Additive insert — used to extend a list with codes that wco-dec doesn't
// publish but CDS empirically requires (e.g. D006/D028/D031/360 for live
// import lanes). Idempotent on (listName, value): existing rows are
// skipped, missing rows are inserted with the supplied description.
export const appendToList = internalMutation({
  args: {
    listName: v.string(),
    entries: v.array(
      v.object({
        value: v.string(),
        description: v.string(),
        metadata: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let skipped = 0;
    for (const entry of args.entries) {
      const value = entry.value.trim().toUpperCase();
      if (!value) {
        skipped++;
        continue;
      }
      const existing = await ctx.db
        .query("cds_code_lists")
        .withIndex("by_list_value", (q) =>
          q.eq("listName", args.listName).eq("value", value),
        )
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("cds_code_lists", {
        listName: args.listName,
        value,
        description: entry.description,
        metadata: entry.metadata,
        updatedAt: now,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

// Replace a list wholesale. Called by the seed action after fetching the
// authoritative HMRC source. Wipes prior rows for the list before inserting
// so stale codes can't survive a refresh.
export const replaceList = internalMutation({
  args: {
    listName: v.string(),
    entries: v.array(
      v.object({
        value: v.string(),
        description: v.string(),
        metadata: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cds_code_lists")
      .withIndex("by_list", (q) => q.eq("listName", args.listName))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    const now = Date.now();
    for (const entry of args.entries) {
      await ctx.db.insert("cds_code_lists", {
        listName: args.listName,
        value: entry.value.trim().toUpperCase(),
        description: entry.description,
        metadata: entry.metadata,
        updatedAt: now,
      });
    }
    return { inserted: args.entries.length };
  },
});
