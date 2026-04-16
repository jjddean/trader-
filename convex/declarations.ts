import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

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
    .take(2000);

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
  if (latestType === "DMSACC") return { score: 85, status: "Warning" };
  if (latestType === "DMSROG") return { score: 60, status: "Action Required" };
  if (latestType === "DMSREJ") return { score: 0, status: "Action Required" };
  if (latestType === "DMSINV") return { score: 0, status: "Action Required" };
  if (latestType === "DMSUB") return { score: 50, status: "Warning" };

  if (decl.status === "Cleared") return { score: 100, status: "Clean" };
  if (decl.status === "Accepted") return { score: 85, status: "Warning" };
  if (decl.status === "Rejected" || decl.status === "Invalid" || decl.status === "Action Required") return { score: 0, status: "Action Required" };
  if (decl.status === "Submitted") return { score: 50, status: "Warning" };
  return { score: 0, status: "Warning" };
}

function isReviewStatus(status: string | undefined) {
  return status === "Action Required" || status === "Rejected" || status === "Invalid";
}

async function recomputeDashboardSummaryByUser(ctx: any, userId: string) {
  const previews = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);

  let reviewCount = 0;
  let totalValue = 0;
  for (const preview of previews) {
    if (isReviewStatus(preview.status)) reviewCount += 1;
    totalValue += Number(preview.totalValue || 0);
  }

  const existing = await ctx.db
    .query("dashboard_summary")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  const next = {
    userId,
    totalDeclarations: previews.length,
    reviewCount,
    totalValue,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, next);
  } else {
    await ctx.db.insert("dashboard_summary", next);
  }
}

async function upsertDeclarationPreviewByDeclaration(ctx: any, declarationId: any) {
  const declaration = await ctx.db.get(declarationId);
  const existingPreview = await ctx.db
    .query("declaration_preview")
    .withIndex("by_declarationId", (q: any) => q.eq("declarationId", declarationId))
    .first();

  if (!declaration) {
    if (existingPreview) await ctx.db.delete(existingPreview._id);
    return;
  }

  const declarationUserId = typeof declaration.userId === "string" ? declaration.userId : "";
  const items = await ctx.db
    .query("goods_items")
    .withIndex("by_declaration", (q: any) => q.eq("declarationId", declarationId))
    .take(2000);

  const totalItems = items.length;
  let totalValue = 0;
  for (const item of items) {
    totalValue += parseNumberish(item.valueAmount);
  }

  const nextPreview = {
    declarationId,
    userId: declarationUserId,
    status: String(declaration.status || "Draft"),
    totalItems,
    totalValue,
    mrn: declaration.mrn ? String(declaration.mrn) : undefined,
    eori: declaration.eori ? String(declaration.eori) : undefined,
    declarationType: declaration.declarationType ? String(declaration.declarationType) : undefined,
    lastUpdated: Date.now(),
  };

  if (existingPreview) {
    await ctx.db.patch(existingPreview._id, nextPreview);
  } else {
    await ctx.db.insert("declaration_preview", nextPreview);
  }

  if (declarationUserId) {
    await recomputeDashboardSummaryByUser(ctx, declarationUserId);
  }
}

export const recomputeDashboardSummary = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await recomputeDashboardSummaryByUser(ctx, args.userId);
  },
});

export const upsertDeclarationPreview = internalMutation({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    await upsertDeclarationPreviewByDeclaration(ctx, args.declarationId);
  },
});

async function getItemsByDeclarationForUser(ctx: any, userId: string, declarationIds: string[]) {
  if (declarationIds.length === 0) return new Map<string, any[]>();

  const allOwnedItems = await ctx.db
    .query("goods_items")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", userId))
    .take(3000);

  const idSet = new Set(declarationIds.map((id) => String(id)));
  const grouped = new Map<string, any[]>();
  for (const item of allOwnedItems) {
    const key = String(item.declarationId || "");
    if (!idSet.has(key)) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const missingIds = declarationIds.filter((id) => !grouped.has(String(id)));
  if (missingIds.length > 0) {
    const legacyItems = await Promise.all(
      missingIds.map((id) =>
        ctx.db
          .query("goods_items")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", id))
          .take(500),
      ),
    );

    for (let i = 0; i < missingIds.length; i++) {
      const declId = String(missingIds[i]);
      const items = legacyItems[i] || [];
      grouped.set(declId, items);
    }
  }

  return grouped;
}

export const getLane = query({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.id);
    if (!declaration || declaration.userId !== identity.subject) {
      throw new Error("Unauthorized: You do not own this declaration.");
    }
    return declaration;
  },
});

// Debug-only: list declarations for a userId without a Clerk session (same pattern as getToken).
export const listForDebug = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject || args.userId;
    if (!effectiveUserId) return [];
    return await ctx.db
      .query("declarations")
      .withIndex("by_user", (q: any) => q.eq("userId", effectiveUserId))
      .order("desc")
      .take(20);
  },
});

// Debug-only query: used by test-evidence/debug-payload.js to fetch a declaration
// without a Clerk browser session. Falls back to args.userId (same pattern as hmrc.getToken).
// Still enforces ownership — only returns if userId matches the declaration owner.
export const getForDebug = query({
  args: { id: v.id("declarations"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject || args.userId;
    if (!effectiveUserId) return null;

    const declaration = await ctx.db.get(args.id);
    if (!declaration) return null;
    if (String(declaration.userId ?? "") !== effectiveUserId) return null;
    return declaration;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const { initialItem, ...declarationArgs } = args;
    const declarationId = await ctx.db.insert("declarations", {
      ...declarationArgs,
      userId: identity.subject, // Override argument with identity
      created: Date.now(),
      lastUpdated: Date.now(),
    });

    if (initialItem) {
      await ctx.db.insert("goods_items", {
        ownerId: identity.subject,
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

    await upsertDeclarationPreviewByDeclaration(ctx, declarationId);

    return declarationId;
  },
});

export const deleteDeclaration = mutation({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Unauthorized: You do not own this declaration.");
    }

    // 1. Delete associated goods items
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.id))
      .take(1000);
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    // 2. Delete the declaration itself
    await ctx.db.delete(args.id);

    const existingPreview = await ctx.db
      .query("declaration_preview")
      .withIndex("by_declarationId", (q) => q.eq("declarationId", args.id))
      .first();
    if (existingPreview) {
      await ctx.db.delete(existingPreview._id);
    }
    await recomputeDashboardSummaryByUser(ctx, identity.subject);
  },
});

export const updateDeclarationStatus = mutation({
  args: {
    id: v.id("declarations"),
    status: v.string(),
    conversationId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const patchObj: any = {
      status: args.status,
      lastUpdated: Date.now(),
    };
    if (args.conversationId) patchObj.conversationId = args.conversationId;

    await ctx.db.patch(args.id, patchObj);
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const updateDeclarationDetails = mutation({
  args: {
    id: v.id("declarations"),
    eori: v.string(),
    declarationType: v.string(),
    route: v.string(),
    dispatchCountry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, {
      eori: args.eori,
      declarationType: args.declarationType,
      route: args.route,
      ...(args.dispatchCountry !== undefined ? { dispatchCountry: args.dispatchCountry } : {}),
      lastUpdated: Date.now(),
    });
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const populateDemoData = mutation({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

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
      .take(1);

    if (existingItems.length === 0) {
      await ctx.db.insert("goods_items", {
        ownerId: identity.subject,
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

    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const getAllDecls = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Unauthorized access to global declaration data.");
    }
    const limit = Math.min(Math.max(args.limit ?? 300, 1), 1000);
    return await ctx.db.query("declarations").order("desc").take(limit);
  }
});

export const getMyDeclarations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(200);
  }
});

export const getMyDeclarationCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { total: 0, reviewCount: 0 };

    const summary = await ctx.db
      .query("dashboard_summary")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!summary) {
      return { total: 0, reviewCount: 0 };
    }

    return { total: summary.totalDeclarations, reviewCount: summary.reviewCount };
  },
});

export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const summary = await ctx.db
      .query("dashboard_summary")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (summary) return summary;

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(200);

    let reviewCount = 0;
    for (const declaration of declarations) {
      if (isReviewStatus(String(declaration.status || "Draft"))) {
        reviewCount += 1;
      }
    }

    return {
      userId: identity.subject,
      totalDeclarations: declarations.length,
      reviewCount,
      totalValue: 0,
      updatedAt: Date.now(),
    };
  },
});

export const getDeclarationPreviews = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const previews = await ctx.db
      .query("declaration_preview")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(20);

    if (previews.length > 0) {
      return previews;
    }

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(20);

    return declarations.map((declaration) => ({
      declarationId: declaration._id,
      userId: identity.subject,
      status: String(declaration.status || "Draft"),
      totalItems: 0,
      totalValue: 0,
      mrn: declaration.mrn ? String(declaration.mrn) : undefined,
      eori: declaration.eori ? String(declaration.eori) : undefined,
      declarationType: declaration.declarationType ? String(declaration.declarationType) : undefined,
      lastUpdated: Number(declaration.lastUpdated || declaration.created || declaration._creationTime || Date.now()),
    }));
  },
});

export const rebuildMyReadModels = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(5000);

    for (const declaration of declarations) {
      await upsertDeclarationPreviewByDeclaration(ctx, declaration._id);
    }

    await recomputeDashboardSummaryByUser(ctx, identity.subject);

    return {
      declarationCount: declarations.length,
      rebuiltAt: Date.now(),
    };
  },
});

export const getDashboardStats = query({
  args: { userId: v.optional(v.string()) }, // userId is now optional and ignored in favor of identity
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decls = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(120);

    let totalDuty = 0;
    let importValue = 0;
    const historicalRates = await getHistoricalRateMap(ctx, identity.subject);
    
    const hsCodeDutyMap: Record<string, number> = {};
    const recentDeclarations = [];
    const overpayments: Array<{ title: string; subtitle: string; amount: number }> = [];

    const declarationIds = decls.map((decl) => String(decl._id));
    const itemsByDeclaration = await getItemsByDeclarationForUser(ctx, identity.subject, declarationIds);

    for (const decl of decls) {
      const items = itemsByDeclaration.get(String(decl._id)) || [];

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
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decls = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(150);

    const historicalRates = await getHistoricalRateMap(ctx, identity.subject);
    const reports = [];
    const declarationIds = decls.map((decl) => String(decl._id));
    const itemsByDeclaration = await getItemsByDeclarationForUser(ctx, identity.subject, declarationIds);
    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(400);
    const notificationsByDeclaration = new Map<string, any[]>();
    for (const notification of allNotifications) {
      const declarationId = String(notification.declarationId || "");
      if (!declarationId) continue;
      if (!notificationsByDeclaration.has(declarationId)) {
        notificationsByDeclaration.set(declarationId, []);
      }
      notificationsByDeclaration.get(declarationId)!.push(notification);
    }

    for (const decl of decls) {
      const items = itemsByDeclaration.get(String(decl._id)) || [];
      
      let totalValue = 0;
      let totalDutyAndVat = 0;
      const mappedItems = items.slice(0, 50).map((item, idx) => {
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
      const declarationNotifications = notificationsByDeclaration.get(String(decl._id)) || [];
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
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decls = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(200);

    const historicalRates = await getHistoricalRateMap(ctx, identity.subject);
    const records = [];
    const declarationIds = decls.map((decl) => String(decl._id));
    const itemsByDeclaration = await getItemsByDeclarationForUser(ctx, identity.subject, declarationIds);
    for (const decl of decls) {
      if (decl.status === "Draft" || !decl.mrn) continue;

      const items = itemsByDeclaration.get(String(decl._id)) || [];
      
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
