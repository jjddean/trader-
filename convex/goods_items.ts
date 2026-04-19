import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const getOwnerId = (doc: unknown): string | null => {
  if (!doc || typeof doc !== "object") return null;
  const userId = (doc as { userId?: unknown }).userId;
  return typeof userId === "string" ? userId : null;
};

function parseNumberish(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Applies only a totalValue delta to dashboard_summary — no full rescan needed for item mutations
// because item changes never affect totalDeclarations or reviewCount.
async function applyValueDeltaToSummary(ctx: any, userId: string, valueDelta: number) {
  if (valueDelta === 0) return;
  const existing = await ctx.db
    .query("dashboard_summary")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!existing) return; // not yet bootstrapped; getDashboardSummary fallback will handle it
  await ctx.db.patch(existing._id, {
    totalValue: Math.max(0, (existing.totalValue || 0) + valueDelta),
    updatedAt: Date.now(),
  });
}

async function refreshReadModels(ctx: any, declarationId: any) {
  const declaration = await ctx.db.get(declarationId);
  const existingPreview = await ctx.db
    .query("declaration_preview")
    .withIndex("by_declarationId", (q: any) => q.eq("declarationId", declarationId))
    .first();

  if (!declaration) {
    if (existingPreview) {
      const userId = existingPreview.userId;
      const oldValue = existingPreview.totalValue || 0;
      await ctx.db.delete(existingPreview._id);
      if (userId) await applyValueDeltaToSummary(ctx, userId, -oldValue);
    }
    return;
  }

  const declarationUserId = typeof declaration.userId === "string" ? declaration.userId : "";
  const items = await ctx.db
    .query("goods_items")
    .withIndex("by_declaration", (q: any) => q.eq("declarationId", declarationId))
    .take(2000);

  let totalValue = 0;
  for (const item of items) totalValue += parseNumberish(item.valueAmount);

  const oldTotalValue = existingPreview?.totalValue || 0;
  const valueDelta = totalValue - oldTotalValue;

  const nextPreview = {
    declarationId,
    userId: declarationUserId,
    status: String(declaration.status || "Draft"),
    totalItems: items.length,
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
    await applyValueDeltaToSummary(ctx, declarationUserId, valueDelta);
  }
}

export const getItems = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || getOwnerId(declaration) !== identity.subject) {
      return [];
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

// One-shot backfill: patches ownerId onto legacy goods_items that pre-date the by_owner index.
// Run once via the Convex dashboard — eliminates the N+1 fallback in getItemsByDeclarationForUser.
export const backfillItemOwnership = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Walk items without ownerId via the by_declaration index (no ownerId filter available).
    const items = await ctx.db.query("goods_items").take(5000);
    const toFix = items.filter((item) => !item.ownerId && item.declarationId);
    if (toFix.length === 0) return { patched: 0 };

    const declIds = [...new Set(toFix.map((i) => i.declarationId))];
    const decls = await Promise.all(declIds.map((id) => ctx.db.get(id as any)));
    const ownerById = new Map<string, string>();
    for (const decl of decls) {
      if (decl && "userId" in decl) ownerById.set(String(decl._id), String((decl as any).userId));
    }

    await Promise.all(
      toFix.map((item) => {
        const owner = ownerById.get(String(item.declarationId));
        return owner ? ctx.db.patch(item._id, { ownerId: owner }) : Promise.resolve();
      }),
    );

    return { patched: toFix.length };
  },
});
