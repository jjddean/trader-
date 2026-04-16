import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const getOwnerId = (doc: unknown): string | null => {
  if (!doc || typeof doc !== "object") return null;
  const userId = (doc as { userId?: unknown }).userId;
  return typeof userId === "string" ? userId : null;
};

function parseNumberish(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isReviewStatus(status: string | undefined) {
  return status === "Action Required" || status === "Rejected" || status === "Invalid";
}

async function refreshReadModels(ctx: any, declarationId: any) {
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

  if (!declarationUserId) return;

  const previews = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q: any) => q.eq("userId", declarationUserId))
    .take(5000);

  let reviewCount = 0;
  let dashboardTotalValue = 0;
  for (const preview of previews) {
    if (isReviewStatus(preview.status)) reviewCount += 1;
    dashboardTotalValue += parseNumberish(preview.totalValue);
  }

  const existingSummary = await ctx.db
    .query("dashboard_summary")
    .withIndex("by_user", (q: any) => q.eq("userId", declarationUserId))
    .first();

  const summaryPayload = {
    userId: declarationUserId,
    totalDeclarations: previews.length,
    reviewCount,
    totalValue: dashboardTotalValue,
    updatedAt: Date.now(),
  };

  if (existingSummary) {
    await ctx.db.patch(existingSummary._id, summaryPayload);
  } else {
    await ctx.db.insert("dashboard_summary", summaryPayload);
  }
}

export const getItems = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || getOwnerId(declaration) !== identity.subject) {
      return []; // Return empty if not owned
    }

    return await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("asc")
      .take(500);
  },
});

// Debug-only query: used by test-evidence/debug-payload.js without a Clerk session.
// Falls back to args.userId (same pattern as hmrc.getToken). Still enforces ownership.
export const getItemsForDebug = query({
  args: { declarationId: v.id("declarations"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject || args.userId;
    if (!effectiveUserId) return [];

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || String(declaration.userId ?? "") !== effectiveUserId) return [];

    return await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("asc")
      .take(500);
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
    additionalDocuments: v.optional(
      v.array(
        v.object({
          CategoryCode: v.string(),
          TypeCode: v.string(),
          ID: v.string(),
          StatusCode: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || getOwnerId(declaration) !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const itemId = await ctx.db.insert("goods_items", {
      ...args,
      ownerId: identity.subject,
    });
    await refreshReadModels(ctx, args.declarationId);
    return itemId;
  },
});

export const removeItem = mutation({
  args: { id: v.id("goods_items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) return;

    const declaration = await ctx.db.get(existing.declarationId);
    if (!declaration || getOwnerId(declaration) !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const declarationId = existing.declarationId;
    await ctx.db.delete(args.id);
    await refreshReadModels(ctx, declarationId);
  },
});

export const updateItem = mutation({
  args: {
    id: v.id("goods_items"),
    commodityCode: v.optional(v.string()),
    description: v.optional(v.string()),
    originCountry: v.optional(v.string()),
    procedureCode: v.optional(v.string()),
    additionalProcedureCode: v.optional(v.string()),
    valueAmount: v.optional(v.number()),
    valueCurrency: v.optional(v.string()),
    grossWeightKg: v.optional(v.number()),
    netWeightKg: v.optional(v.number()),
    additionalDocuments: v.optional(
      v.array(
        v.object({
          CategoryCode: v.string(),
          TypeCode: v.string(),
          ID: v.string(),
          StatusCode: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Item not found");

    const declaration = await ctx.db.get(existing.declarationId);
    if (!declaration || getOwnerId(declaration) !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      ownerId: identity.subject,
    });
    await refreshReadModels(ctx, existing.declarationId);
  },
});
