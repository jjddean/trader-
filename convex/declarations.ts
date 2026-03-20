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

export const getReports = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const decls = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const reports = [];
    for (const decl of decls) {
      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .collect();
      
      let totalValue = 0;
      let totalDutyAndVat = 0;
      const mappedItems = items.map((item, idx) => {
        const val = item.valueAmount || 0;
        const duty = val * 0.1;
        const vat = val * 0.2;
        totalValue += val;
        totalDutyAndVat += (duty + vat);
        
        return {
          sequence: item.sequenceNumber || (idx + 1),
          commodityCode: item.commodityCode || "Unknown",
          description: item.description || "No description",
          netMass: item.netWeightKg ? `${item.netWeightKg} kg` : "N/A",
          cpc: item.procedureCode || "4000 000",
          itemPrice: `GBP ${val.toFixed(2)}`,
          customsValue: `GBP ${val.toFixed(2)}`,
          dutyPaid: `£${duty.toFixed(2)}`,
          vatAmount: `£${vat.toFixed(2)}`,
        };
      });

      let score = 100;
      let mappedStatus = "Clean";
      if (decl.status === "Rejected" || decl.status === "Action Required") { score = 40; mappedStatus = "Action Required"; }
      else if (decl.status === "Draft") { score = 0; mappedStatus = "Draft"; }
      else if (decl.status === "Accepted") { score = 85; mappedStatus = "Warning"; } 

      reports.push({
        id: decl._id,
        mrn: decl.mrn || "Draft",
        date: new Date(decl.created || Date.now()).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }),
        broker: decl.eori || "Unknown Broker",
        score,
        status: mappedStatus,
        ducr: `1GB${decl.eori || "123456789000"}-${decl._id.substring(0,4)}`,
        lrn: `LRN${decl.created}`,
        importer: `${decl.eori || "Unknown"}`,
        declarant: `${decl.eori || "Unknown"} (Self-filed)`,
        consignor: "N/A",
        dispatchCountry: items[0]?.originCountry || "GB",
        originCountry: items[0]?.originCountry || "GB",
        portCode: decl.route || "GBSOU",
        acceptanceDate: new Date(decl.created || Date.now()).toLocaleString("en-GB"),
        clearanceDate: (decl.status === "Cleared" || decl.status === "Accepted") ? new Date(decl.lastUpdated || Date.now()).toLocaleString("en-GB") : "Pending",
        totalInvoiceValue: `GBP ${totalValue.toFixed(2)}`,
        totalCustomsValue: `GBP ${totalValue.toFixed(2)}`,
        totalDutyAndVat: `GBP ${totalDutyAndVat.toFixed(2)}`,
        items: mappedItems,
      });
    }

    return reports;
  }
});

export const getFinancialRecords = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const decls = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const records = [];
    for (const decl of decls) {
      if (decl.status === "Draft" || !decl.mrn) continue;

      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .collect();
      
      let declValue = 0;
      for (const item of items) {
        declValue += (item.valueAmount || 0);
      }
      
      const duty = declValue * 0.1;
      const vat = declValue * 0.2;
      const dateStr = new Date(decl.created || Date.now()).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });

      if (duty > 0) {
        records.push({
          id: `${decl._id}-duty`,
          mrn: decl.mrn,
          type: "Duty (A00)",
          amount: duty,
          method: "Deferment Account (DAN)",
          date: dateStr,
          accountNumber: "DAN 8931234",
          statementContext: "Monthly Statement",
          paymentLimit: "£1,200,000.00",
          calculationMethod: `Customs Value £${declValue.toFixed(2)} × 10%`,
          natureOfTransaction: "11 (Outright Purchase)",
        });
      }

      if (vat > 0) {
        records.push({
          id: `${decl._id}-vat`,
          mrn: decl.mrn,
          type: "Postponed VAT (B00)",
          amount: vat,
          method: "Postponed VAT Accounting",
          date: dateStr,
          accountNumber: "PVA Declared",
          statementContext: "Monthly PVA Statement",
          paymentLimit: "N/A",
          calculationMethod: `Value £${declValue.toFixed(2)} × 20%`,
          natureOfTransaction: "11 (Outright Purchase)",
        });
      }
    }
    return records;
  }
});
