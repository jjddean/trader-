import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const saveCompany = mutation({
  args: {
    companyName: v.string(),
    country: v.string(),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const userId = identity.subject;

    // Check if already saved
    const existing = await ctx.db
      .query("saved_companies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("companyName"), args.companyName))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("saved_companies", {
      userId,
      companyName: args.companyName,
      country: args.country,
      category: args.category,
      notes: args.notes,
      timestamp: Date.now(),
    });
  },
});

export const removeSavedCompany = mutation({
  args: { id: v.id("saved_companies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.delete(args.id);
  },
});

export const getSavedCompanies = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("saved_companies")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});
