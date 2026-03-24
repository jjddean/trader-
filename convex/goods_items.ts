import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getItems = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("asc")
      .collect();
  },
});

export const addItem = mutation({
  args: {
    declarationId: v.id("declarations"),
    sequenceNumber: v.number(),
    commodityCode: v.string(),
    description: v.string(),
    originCountry: v.string(),
    procedureCode: v.string(),
    valueAmount: v.number(),
    valueCurrency: v.string(),
    grossWeightKg: v.optional(v.number()),
    netWeightKg: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const itemId = await ctx.db.insert("goods_items", args);
    return itemId;
  },
});

export const removeItem = mutation({
  args: { id: v.id("goods_items") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updateItem = mutation({
  args: {
    id: v.id("goods_items"),
    commodityCode: v.optional(v.string()),
    description: v.optional(v.string()),
    originCountry: v.optional(v.string()),
    procedureCode: v.optional(v.string()),
    valueAmount: v.optional(v.number()),
    valueCurrency: v.optional(v.string()),
    grossWeightKg: v.optional(v.number()),
    netWeightKg: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
