import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const preferenceCountries = new Set(["BD", "PK", "LK", "KE", "GH", "NG", "TZ", "UG", "ZM", "ZW"]);
const hsDutyRateByPrefix: Record<string, number> = {
  "61": 0.12,
  "62": 0.12,
  "64": 0.08,
  "84": 0.035,
  "85": 0.03,
  "87": 0.1,
  "90": 0.025,
};

function parseNumberish(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getHistoricalRateMap(ctx: any, userId: string) {
  const rows = await ctx.db
    .query("historical_declarations")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const rateMap: Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }> = {};
  for (const row of rows) {
    const commodityCode = String(row.commodityCode || "");
    const prefix = commodityCode.substring(0, 2);
    if (!prefix) continue;

    const customsValue = parseNumberish(row.itemCustomsValue);
    const taxAmount = parseNumberish(row.taxLineTotalAmount);
    if (!customsValue || !taxAmount) continue;

    if (!rateMap[prefix]) {
      rateMap[prefix] = { dutyTotal: 0, vatTotal: 0, customsTotal: 0 };
    }
    if (String(row.taxType || "").toUpperCase().includes("A00")) {
      rateMap[prefix].dutyTotal += taxAmount;
      rateMap[prefix].customsTotal += customsValue;
    }
    if (String(row.taxType || "").toUpperCase().includes("B00")) {
      rateMap[prefix].vatTotal += taxAmount;
      rateMap[prefix].customsTotal += customsValue;
    }
  }
  return rateMap;
}

function resolveRates(item: any, historicalRates: Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>) {
  const code = String(item?.commodityCode || "");
  const prefix = code.substring(0, 2);
  const historical = historicalRates[prefix];

  const historicalDutyRate =
    historical && historical.customsTotal > 0
      ? historical.dutyTotal / historical.customsTotal
      : null;
  const historicalVatRate =
    historical && historical.customsTotal > 0
      ? historical.vatTotal / historical.customsTotal
      : null;

  const baseDutyRate = historicalDutyRate ?? hsDutyRateByPrefix[prefix] ?? 0.06;
  const originCountry = String(item?.originCountry || "").toUpperCase();
  const effectiveDutyRate = preferenceCountries.has(originCountry) ? 0 : baseDutyRate;
  const vatRate = historicalVatRate ?? 0.2;

  return { dutyRate: effectiveDutyRate, vatRate };
}

function hmrcStatusForDeclaration(decl: any, notifications: any[]) {
  if (decl?.status === "Draft") return { score: 0, status: "Draft" };
  const latestType = notifications[0]?.notificationType;
  if (latestType === "DMSCLE") return { score: 100, status: "Clean" };
  if (latestType === "DMSACC") return { score: 90, status: "Warning" };
  if (latestType === "DMSROG") return { score: 55, status: "Action Required" };
  if (latestType === "DMSREJ") return { score: 20, status: "Action Required" };
  if (latestType === "DMSINV") return { score: 15, status: "Action Required" };
  if (latestType === "DMSUB") return { score: 75, status: "Warning" };

  if (decl.status === "Cleared") return { score: 100, status: "Clean" };
  if (decl.status === "Accepted") return { score: 90, status: "Warning" };
  if (decl.status === "Rejected" || decl.status === "Invalid" || decl.status === "Action Required") return { score: 20, status: "Action Required" };
  return { score: 70, status: "Warning" };
}

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
    const historicalRates = await getHistoricalRateMap(ctx, args.userId);
    
    const hsCodeDutyMap: Record<string, number> = {};
    const recentDeclarations = [];
    const overpayments: Array<{ title: string; subtitle: string; amount: number }> = [];

    for (const decl of decls) {
      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .collect();

      let declValue = 0;
      let declDuty = 0;
      let declOverpayment = 0;

      for (const item of items) {
        const val = item.valueAmount || 0;
        const { dutyRate } = resolveRates(item, historicalRates);
        const duty = val * dutyRate;
        const baselineDuty = val * (hsDutyRateByPrefix[String(item?.commodityCode || "").substring(0, 2)] ?? 0.06);
        declOverpayment += Math.max(0, baselineDuty - duty);
        
        declValue += val;
        declDuty += duty;
        totalDuty += duty;
        importValue += val;

        if (item.commodityCode) {
          const code = item.commodityCode.substring(0, 4);
          hsCodeDutyMap[code] = (hsCodeDutyMap[code] || 0) + duty;
        }
      }

      if (declOverpayment > 0) {
        overpayments.push({
          title: `Potential preference relief (${decl.mrn || "Draft"})`,
          subtitle: `${items.length} item${items.length === 1 ? "" : "s"} affected`,
          amount: Number(declOverpayment.toFixed(2)),
        });
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
      overpayments: overpayments.sort((a, b) => b.amount - a.amount).slice(0, 5),
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

    const historicalRates = await getHistoricalRateMap(ctx, args.userId);
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
        const { dutyRate, vatRate } = resolveRates(item, historicalRates);
        const duty = val * dutyRate;
        const vat = (val + duty) * vatRate;
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
      const declarationNotifications = await ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("declarationId"), decl._id))
        .collect();
      declarationNotifications.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      const hmrcStatus = hmrcStatusForDeclaration(decl, declarationNotifications);

      reports.push({
        id: decl._id,
        mrn: decl.mrn || "Draft",
        date: new Date(decl.created || Date.now()).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }),
        broker: decl.eori || "Unknown Broker",
        score: hmrcStatus.score,
        status: hmrcStatus.status,
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

    const historicalRates = await getHistoricalRateMap(ctx, args.userId);
    const records = [];
    for (const decl of decls) {
      if (decl.status === "Draft" || !decl.mrn) continue;

      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .collect();
      
      let declValue = 0;
      let duty = 0;
      let vat = 0;
      for (const item of items) {
        const itemValue = item.valueAmount || 0;
        const { dutyRate, vatRate } = resolveRates(item, historicalRates);
        const itemDuty = itemValue * dutyRate;
        const itemVat = (itemValue + itemDuty) * vatRate;
        declValue += itemValue;
        duty += itemDuty;
        vat += itemVat;
      }
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
          calculationMethod: `Tariff-derived rates by HS/origin over customs value £${declValue.toFixed(2)}`,
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
          calculationMethod: `VAT derived from customs value + duty for £${declValue.toFixed(2)}`,
          natureOfTransaction: "11 (Outright Purchase)",
        });
      }
    }
    return records;
  }
});
