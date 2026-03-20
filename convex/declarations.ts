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

export const getDashboardStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const decls = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    let totalDuty = 0;
    let importValue = 0;
    
    // Group duty by HS Code
    const hsCodeDutyMap: Record<string, number> = {};
    
    // Enrich top 7 recent declarations
    const recentDeclarations = [];

    for (const decl of decls) {
      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .collect();

      let declValue = 0;
      let declDuty = 0;

      for (const item of items) {
        const val = item.valueAmount || 0;
        const duty = val * 0.1; // Flat 10% duty estimate for Dashboard
        
        declValue += val;
        declDuty += duty;
        totalDuty += duty;
        importValue += val;

        if (item.commodityCode) {
          const code = item.commodityCode.substring(0, 4);
          hsCodeDutyMap[code] = (hsCodeDutyMap[code] || 0) + duty;
        }
      }

      if (recentDeclarations.length < 7) {
        recentDeclarations.push({
          id: decl._id,
          date: new Date(decl.created || Date.now()).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' }),
          mrn: decl.mrn || "Draft",
          status: decl.status || "Draft",
          value: declValue,
          duty: declDuty,
        });
      }
    }

    const chartData = Object.entries(hsCodeDutyMap)
      .map(([code, duty]) => ({ code, duty }))
      .sort((a, b) => b.duty - a.duty)
      .slice(0, 6);

    return {
      kpis: {
        totalDuty,
        importValue,
        declarationsCount: decls.length,
        avgDuty: decls.length > 0 ? totalDuty / decls.length : 0,
      },
      chartData,
      recentDeclarations,
    };
  },
});
