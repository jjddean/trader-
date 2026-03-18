import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getLanes = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getLane = query({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createDeclaration = mutation({
  args: {
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    eori: v.optional(v.string()),
    route: v.optional(v.string()),
    declarationType: v.string(), // "H1", "B1" etc
    status: v.string(),
    initialItem: v.optional(v.object({
      originCountry: v.string(),
      hsCode: v.string(),
      description: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const { initialItem, ...declarationArgs } = args;
    const declarationId = await ctx.db.insert("declarations", {
      ...declarationArgs,
      created: Date.now(),
      lastUpdated: Date.now(),
    });

    if (initialItem) {
      await ctx.db.insert("goods_items", {
        declarationId: declarationId,
        sequenceNumber: 1,
        commodityCode: initialItem.hsCode,
        description: initialItem.description,
        originCountry: initialItem.originCountry,
        procedureCode: "4000",
        valueAmount: 0,
        valueCurrency: "GBP",
      });
    }

    return declarationId;
  },
});

export const updateDeclarationStatus = mutation({
  args: {
    id: v.id("declarations"),
    status: v.string(),
    conversationId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const patchObj: any = {
      status: args.status,
      lastUpdated: Date.now(),
    };
    if (args.conversationId) patchObj.conversationId = args.conversationId;

    await ctx.db.patch(args.id, patchObj);
  },
});

export const updateDeclarationDetails = mutation({
  args: {
    id: v.id("declarations"),
    eori: v.string(),
    declarationType: v.string(),
    route: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      eori: args.eori,
      declarationType: args.declarationType,
      route: args.route,
      lastUpdated: Date.now(),
    });
  },
});

export const populateDemoData = mutation({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    // 1. Update header to satisfy validation
    await ctx.db.patch(args.id, {
      eori: "GB664653557000",
      declarationType: "IM",
      route: "Route 1",
    });

    // 2. Check if items exist, if not, add the dummy invoice item
    const existingItems = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.id))
      .collect();

    if (existingItems.length === 0) {
      await ctx.db.insert("goods_items", {
        declarationId: args.id,
        sequenceNumber: 1,
        commodityCode: "6109100010",
        description: "Men's knitted cotton t-shirts",
        originCountry: "GB",
        procedureCode: "4000",
        valueAmount: 12500.0,
        valueCurrency: "GBP",
        grossWeightKg: 150,
        netWeightKg: 145,
      });
    }
  },
});

export const getAllDecls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("declarations").collect();
  }
});
