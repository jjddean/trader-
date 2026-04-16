import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

export const getLatestDataset = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referenceDatasets")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .order("desc")
      .first();
  },
});

export const updateDatasetVersion = internalMutation({
  args: {
    name: v.string(),
    version: v.string(),
    storagePath: v.string(),
    storageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Typically called by a GitHub Action or a scheduled job after uploading to R2
    return await ctx.db.insert("referenceDatasets", {
      ...args,
      lastUpdated: Date.now(),
    });
  },
});

export const listAllDatasets = query({
  handler: async (ctx) => {
    return await ctx.db.query("referenceDatasets").order("desc").take(200);
  },
});
