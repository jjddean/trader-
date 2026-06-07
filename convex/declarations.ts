import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { evaluateCompleteness } from "./lib/declaration_completeness";
import { replayDeclarationStatus } from "./lib/replay_declaration_status";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";
import { resolveDeclarationCdsBadge } from "./lib/cds_badge";
import type { RuleDefinition } from "./lib/rule_engine";

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
  const cached = await ctx.db
    .query("rate_cache")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (cached) return cached.rateMap as Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>;

  // Cold path — no cache yet (before first ingest). Build from raw rows.
  const rows = await ctx.db
    .query("historical_declarations")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(2000);

  return buildRateMap(rows);
}

function buildRateMap(rows: any[]) {
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

const HMRC_CONFIRMED_NOTIFICATION_TYPES = new Set(["DMSCLE", "DMSACC", "DMSROG", "DMSREJ", "DMSINV"]);
const HMRC_CONFIRMED_DECLARATION_STATUSES = new Set(["Cleared", "Accepted", "Rejected", "Invalid", "Action Required"]);

function isHmrcConfirmedDeclaration(decl: any, notifications: any[]) {
  const latestType = String(notifications[0]?.notificationType || "").toUpperCase();
  if (HMRC_CONFIRMED_NOTIFICATION_TYPES.has(latestType)) return true;
  return HMRC_CONFIRMED_DECLARATION_STATUSES.has(String(decl?.status || ""));
}

function parseRawPayload(rawPayload: any): any | null {
  if (!rawPayload) return null;
  if (typeof rawPayload === "object") return rawPayload;
  if (typeof rawPayload === "string") {
    try {
      return JSON.parse(rawPayload);
    } catch {
      return null;
    }
  }
  return null;
}

function findNumericByKeyPattern(input: any, regex: RegExp): number | null {
  const stack = [input];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (typeof node !== "object") continue;
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") {
        stack.push(value);
      } else if (regex.test(String(key))) {
        const num = Number(value);
        if (Number.isFinite(num)) return num;
      }
    }
  }
  return null;
}

function extractConfirmedFinancials(notifications: any[]) {
  for (const notification of notifications) {
    const payload = parseRawPayload(notification?.rawPayload);
    if (!payload) continue;
    const duty = findNumericByKeyPattern(payload, /(duty|a00).*(amount|paid|total)|^(duty|a00)$/i);
    const vat = findNumericByKeyPattern(payload, /(vat|b00).*(amount|paid|total)|^(vat|b00)$/i);
    if ((duty && duty > 0) || (vat && vat > 0)) {
      return {
        duty: duty || 0,
        vat: vat || 0,
      };
    }
  }
  return null;
}

function isReviewStatus(status: string | undefined) {
  return status === "Action Required" || status === "Rejected" || status === "Invalid";
}

type DeclarationStatusSource = Pick<Doc<"declarations">, "status" | "mrn">;

async function effectiveDeclarationStatus(
  ctx: Pick<QueryCtx, "db">,
  declarationId: Id<"declarations">,
  declaration: DeclarationStatusSource & { conversationId?: string | null },
): Promise<string> {
  const notificationRows = await collectDeclarationNotifications(ctx.db, {
    declarationId,
    conversationId: declaration.conversationId,
    mrn: declaration.mrn,
  });

  return replayDeclarationStatus(
    String(declaration.status ?? "Draft"),
    declaration.mrn,
    notificationRows,
  );
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

async function upsertDeclarationPreviewByDeclaration(
  ctx: MutationCtx,
  declarationId: Id<"declarations">,
) {
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

  let totalValue = 0;
  for (const item of items) totalValue += parseNumberish(item.valueAmount);

  // Single source of truth: rule engine. evaluateCompleteness is just the
  // translator from ValidationResult[] to {field, reason}. Persist only the
  // summary (ready + count) on the preview row; the dashboard subscribes to
  // declaration_completeness:getStatus when the user opens the declaration
  // and gets the full missing[] list.
  const rules = (await ctx.db
    .query("rule_definitions")
    .withIndex("by_enabled", (q: any) => q.eq("enabled", true))
    .collect()) as unknown as RuleDefinition[];
  const completeness = evaluateCompleteness({
    rules,
    declaration: declaration as Record<string, unknown>,
    items: items as Array<Record<string, unknown>>,
  });

  const replayedStatus = await effectiveDeclarationStatus(ctx, declarationId, {
    status: declaration.status,
    mrn: declaration.mrn,
    conversationId: declaration.conversationId,
  });

  const nextPreview = {
    declarationId,
    userId: declarationUserId,
    status: replayedStatus,
    totalItems: items.length,
    totalValue,
    mrn: declaration.mrn ? String(declaration.mrn) : undefined,
    eori: declaration.eori ? String(declaration.eori) : undefined,
    declarationType: declaration.declarationType ? String(declaration.declarationType) : undefined,
    completenessReady: completeness.ready,
    missingCount: completeness.missing.length,
    lastUpdated: Date.now(),
  };

  const isNew = !existingPreview;
  if (existingPreview) {
    await ctx.db.patch(existingPreview._id, nextPreview);
  } else {
    await ctx.db.insert("declaration_preview", nextPreview);
  }

  if (!declarationUserId) return;

  const summary = await ctx.db
    .query("dashboard_summary")
    .withIndex("by_user", (q: any) => q.eq("userId", declarationUserId))
    .first();

  if (!summary) {
    // Bootstrap on first write — full scan runs once per user, never again on hot paths.
    await recomputeDashboardSummaryByUser(ctx, declarationUserId);
    return;
  }

  const countDelta = isNew ? 1 : 0;
  const oldReview = isReviewStatus(existingPreview?.status);
  const newReview = isReviewStatus(nextPreview.status);
  const reviewDelta = (newReview ? 1 : 0) - (oldReview ? 1 : 0);
  const valueDelta = totalValue - (existingPreview?.totalValue || 0);

  if (countDelta !== 0 || reviewDelta !== 0 || valueDelta !== 0) {
    await ctx.db.patch(summary._id, {
      totalDeclarations: Math.max(0, (summary.totalDeclarations || 0) + countDelta),
      reviewCount: Math.max(0, (summary.reviewCount || 0) + reviewDelta),
      totalValue: Math.max(0, (summary.totalValue || 0) + valueDelta),
      updatedAt: Date.now(),
    });
  }
}

export const getStuckProcessingDeclarations = internalQuery({
  args: { olderThanMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.olderThanMs;
    const rows = await ctx.db
      .query("declarations")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "Processing"),
          q.lt(q.field("lastUpdated"), cutoff),
        )
      )
      .take(50);
    return rows.map((r) => ({
      _id: r._id as string,
      userId: String(r.userId ?? ""),
      conversationId: r.conversationId as string | null | undefined,
    }));
  },
});

export const getHmrcTokenForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return token ? { accessToken: String(token.accessToken ?? "") } : null;
  },
});

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

export const refreshRateCache = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .take(2000);
    const rateMap = buildRateMap(rows);
    const existing = await ctx.db
      .query("rate_cache")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { rateMap, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("rate_cache", { userId: args.userId, rateMap, updatedAt: Date.now() });
    }
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

    const notificationRows = await collectDeclarationNotifications(ctx.db, {
      declarationId: args.id,
      conversationId: declaration.conversationId,
      mrn: declaration.mrn,
    });

    const status = replayDeclarationStatus(
      String(declaration.status ?? "Draft"),
      declaration.mrn,
      notificationRows,
    );

    const cdsBadge = resolveDeclarationCdsBadge(status, notificationRows);

    return { ...declaration, status, cdsBadgeLabel: cdsBadge.label, cdsBadgeTone: cdsBadge.tone };
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

    // Read preview before deletion to capture delta values
    const existingPreview = await ctx.db
      .query("declaration_preview")
      .withIndex("by_declarationId", (q) => q.eq("declarationId", args.id))
      .first();

    // Delete associated goods items in parallel
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.id))
      .take(1000);
    await Promise.all(items.map((item) => ctx.db.delete(item._id)));

    await ctx.db.delete(args.id);
    if (existingPreview) await ctx.db.delete(existingPreview._id);

    // Apply delta to dashboard_summary instead of full rescan
    const summary = await ctx.db
      .query("dashboard_summary")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (summary) {
      const reviewDelta = isReviewStatus(existingPreview?.status) ? -1 : 0;
      const valueDelta = -(existingPreview?.totalValue || 0);
      await ctx.db.patch(summary._id, {
        totalDeclarations: Math.max(0, (summary.totalDeclarations || 0) - 1),
        reviewCount: Math.max(0, (summary.reviewCount || 0) + reviewDelta),
        totalValue: Math.max(0, (summary.totalValue || 0) + valueDelta),
        updatedAt: Date.now(),
      });
    }
  },
});

export const updateDeclarationStatus = mutation({
  args: {
    id: v.id("declarations"),
    status: v.string(),
    conversationId: v.optional(v.string()),
    mrn: v.optional(v.string()),
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
    if (args.status === "Processing" && args.conversationId) patchObj.submittedAt = Date.now();
    // Clearing the MRN on re-submit (mrn: "") is intentional — HMRC assigns a
    // fresh MRN via DMSACC, so an empty string must overwrite the old value.
    if (args.mrn !== undefined) patchObj.mrn = args.mrn;

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
    destinationCountry: v.optional(v.string()),
    importerEori: v.optional(v.string()),
    presentationOffice: v.optional(v.string()),
    locationId: v.optional(v.string()),
    goodsLocationKind: v.optional(v.string()),
    goodsLocationTypeCode: v.optional(v.string()),
    goodsLocationQualifier: v.optional(v.string()),
    invoiceCurrency: v.optional(v.string()),
    invoiceTotal: v.optional(v.union(v.number(), v.null())),
    incoterms: v.optional(v.string()),
    incotermLocation: v.optional(v.string()),
    transportMode: v.optional(v.string()),
    transportId: v.optional(v.string()),
    transportIdType: v.optional(v.string()),
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
      ...(args.destinationCountry !== undefined ? { destinationCountry: args.destinationCountry } : {}),
      ...(args.importerEori !== undefined ? { importerEori: args.importerEori } : {}),
      ...(args.presentationOffice !== undefined ? { presentationOffice: args.presentationOffice } : {}),
      ...(args.locationId !== undefined ? { locationId: args.locationId } : {}),
      ...(args.goodsLocationKind !== undefined ? { goodsLocationKind: args.goodsLocationKind } : {}),
      ...(args.goodsLocationTypeCode !== undefined ? { goodsLocationTypeCode: args.goodsLocationTypeCode } : {}),
      ...(args.goodsLocationQualifier !== undefined ? { goodsLocationQualifier: args.goodsLocationQualifier } : {}),
      ...(args.invoiceCurrency !== undefined ? { invoiceCurrency: args.invoiceCurrency } : {}),
      ...(args.invoiceTotal !== undefined ? { invoiceTotal: args.invoiceTotal } : {}),
      ...(args.incoterms !== undefined ? { incoterms: args.incoterms } : {}),
      ...(args.incotermLocation !== undefined ? { incotermLocation: args.incotermLocation } : {}),
      ...(args.transportMode !== undefined ? { transportMode: args.transportMode } : {}),
      ...(args.transportId !== undefined ? { transportId: args.transportId } : {}),
      ...(args.transportIdType !== undefined ? { transportIdType: args.transportIdType } : {}),
      ...(args.destinationCountry !== undefined ? { destinationCountry: args.destinationCountry } : {}),
      ...(args.importerEori !== undefined ? { importerEori: args.importerEori } : {}),
      ...(args.invoiceCurrency !== undefined ? { invoiceCurrency: args.invoiceCurrency } : {}),
      ...(args.invoiceTotal !== undefined ? { invoiceTotal: args.invoiceTotal } : {}),
      ...(args.locationId !== undefined ? { locationId: args.locationId } : {}),
      ...(args.presentationOffice !== undefined ? { presentationOffice: args.presentationOffice } : {}),
      lastUpdated: Date.now(),
    });
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const setDeclarationMode = mutation({
  args: {
    id: v.id("declarations"),
    mode: v.union(v.literal("minimal"), v.literal("enriched")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { mode: args.mode, lastUpdated: Date.now() });
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
    return { mode: args.mode };
  },
});

// One-off backfill for transport (DE 7/4, 7/7, 7/9) + lane mode. Used when a
// declaration was created before these fields existed on the form. Runs as
// internal so we can invoke it from `npx convex run` without auth juggling.
export const backfillTransportAndMode = internalMutation({
  args: {
    id: v.id("declarations"),
    transportMode: v.optional(v.string()),
    transportId: v.optional(v.string()),
    transportIdType: v.optional(v.string()),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error(`Declaration ${args.id} not found`);
    const patch: Record<string, unknown> = { lastUpdated: Date.now() };
    if (args.transportMode !== undefined) patch.transportMode = args.transportMode;
    if (args.transportId !== undefined) patch.transportId = args.transportId;
    if (args.transportIdType !== undefined) patch.transportIdType = args.transportIdType;
    if (args.mode !== undefined) patch.mode = args.mode;
    await ctx.db.patch(args.id, patch);
    return { id: args.id, applied: patch };
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

    const previews = await ctx.db
      .query("declaration_preview")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(500);

    if (previews.length === 0) {
      const summary = await ctx.db
        .query("dashboard_summary")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .first();
      if (!summary) return { total: 0, reviewCount: 0 };
      return { total: summary.totalDeclarations, reviewCount: summary.reviewCount };
    }

    let reviewCount = 0;
    for (const preview of previews) {
      const declaration = await ctx.db.get(preview.declarationId);
      if (!declaration) continue;
      const status = await effectiveDeclarationStatus(ctx, preview.declarationId, {
        status: declaration.status,
        mrn: declaration.mrn,
        conversationId: declaration.conversationId,
      });
      if (isReviewStatus(status)) reviewCount += 1;
    }

    return { total: previews.length, reviewCount };
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
      updatedAt: 0,
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
      .take(200);

    const enrichPreview = async (preview: (typeof previews)[number]) => {
      const declaration = await ctx.db.get(preview.declarationId);
      if (!declaration) return preview;
      const status = await effectiveDeclarationStatus(ctx, preview.declarationId, {
        status: declaration.status,
        mrn: declaration.mrn,
        conversationId: declaration.conversationId,
      });
      return { ...preview, status };
    };

    if (previews.length > 0) {
      return Promise.all(previews.map(enrichPreview));
    }

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(200);

    return Promise.all(
      declarations.map(async (declaration) => {
        const status = await effectiveDeclarationStatus(ctx, declaration._id, {
          status: declaration.status,
          mrn: declaration.mrn,
          conversationId: declaration.conversationId,
        });
        return {
          declarationId: declaration._id,
          userId: identity.subject,
          status,
          totalItems: 0,
          totalValue: 0,
          mrn: declaration.mrn ? String(declaration.mrn) : undefined,
          eori: declaration.eori ? String(declaration.eori) : undefined,
          declarationType: declaration.declarationType
            ? String(declaration.declarationType)
            : undefined,
          lastUpdated: Number(
            declaration.lastUpdated || declaration.created || declaration._creationTime || 0,
          ),
        };
      }),
    );
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

    await Promise.all(declarations.map((d) => upsertDeclarationPreviewByDeclaration(ctx, d._id)));

    await recomputeDashboardSummaryByUser(ctx, identity.subject);

    return {
      declarationCount: declarations.length,
      rebuiltAt: Date.now(),
    };
  },
});

// Debug-only: rebuild declaration previews + dashboard summary for a known user
// without requiring an interactive Clerk session in the terminal.
export const rebuildReadModelsForDebug = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(5000);

    await Promise.all(declarations.map((d) => upsertDeclarationPreviewByDeclaration(ctx, d._id)));
    await recomputeDashboardSummaryByUser(ctx, args.userId);

    return {
      declarationCount: declarations.length,
      rebuiltAt: Date.now(),
      userId: args.userId,
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
      const isAuthoritative = isHmrcConfirmedDeclaration(decl, declarationNotifications);

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
        provenance: isAuthoritative ? "hmrc_confirmed" : "derived",
        provenanceLabel: isAuthoritative
          ? "HMRC-confirmed declaration status data"
          : "Derived from declaration preview data",
        isAuthoritative,
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
    for (const bucket of notificationsByDeclaration.values()) {
      bucket.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    }
    for (const decl of decls) {
      if (decl.status === "Draft" || !decl.mrn) continue;

      const items = itemsByDeclaration.get(String(decl._id)) || [];
      const declarationNotifications = notificationsByDeclaration.get(String(decl._id)) || [];
      const confirmedFinancials = extractConfirmedFinancials(declarationNotifications);
      const hasConfirmedFinancials = !!confirmedFinancials && (confirmedFinancials.duty > 0 || confirmedFinancials.vat > 0);

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
      if (hasConfirmedFinancials) {
        duty = confirmedFinancials!.duty;
        vat = confirmedFinancials!.vat;
      }
      const dateStr = new Date(decl.created || Date.now()).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
      const provenance = hasConfirmedFinancials ? "hmrc_confirmed" : "derived";
      const provenanceLabel = hasConfirmedFinancials
        ? "HMRC-confirmed settlement figures"
        : "Derived from declaration preview data";

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
          calculationMethod: hasConfirmedFinancials
            ? "Value sourced from HMRC-confirmed notification payload"
            : `Tariff-derived rates by HS/origin over customs value £${declValue.toFixed(2)}`,
          natureOfTransaction: "11 (Outright Purchase)",
          provenance,
          provenanceLabel,
          isAuthoritative: hasConfirmedFinancials,
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
          calculationMethod: hasConfirmedFinancials
            ? "Value sourced from HMRC-confirmed notification payload"
            : `VAT derived from customs value + duty for £${declValue.toFixed(2)}`,
          natureOfTransaction: "11 (Outright Purchase)",
          provenance,
          provenanceLabel,
          isAuthoritative: hasConfirmedFinancials,
        });
      }
    }
    return records;
  }
});
