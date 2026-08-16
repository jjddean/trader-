import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { canAccessDeclaration } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

async function refreshReadModels(ctx: any, declarationId: any) {
  await ctx.runMutation(internal.declarations.upsertDeclarationPreview, { declarationId });
}

export const getItems = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
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
    commodityCode: v.optional(v.string()),
    description: v.optional(v.string()),
    originCountry: v.optional(v.string()),
    procedureCode: v.optional(v.string()),
    additionalProcedureCode: v.optional(v.string()),
    valueAmount: v.optional(v.number()),
    valueCurrency: v.optional(v.string()),
    grossWeightKg: v.optional(v.number()),
    netWeightKg: v.optional(v.number()),
    supplementaryUnitQty: v.optional(v.number()),
    supplementaryUnitCode: v.optional(v.string()),
    shippingMarks: v.optional(v.string()),
    packageCount: v.optional(v.number()),
    packageType: v.optional(v.string()),
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
    if (!identity) throw unauthenticatedError();

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    const itemId = await ctx.db.insert("goods_items", {
      ...args,
      valueCurrency: "GBP",
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
    if (!identity) throw unauthenticatedError();

    const existing = await ctx.db.get(args.id);
    if (!existing) return;

    const declaration = existing.declarationId
      ? await ctx.db.get(existing.declarationId as Id<"declarations">)
      : null;
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
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
    supplementaryUnitQty: v.optional(v.number()),
    supplementaryUnitCode: v.optional(v.string()),
    shippingMarks: v.optional(v.string()),
    packageCount: v.optional(v.number()),
    packageType: v.optional(v.string()),
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
    if (!identity) throw unauthenticatedError();

    const existing = await ctx.db.get(args.id);
    if (!existing) throw userError("item_not_found", "Item not found");

    const declaration = existing.declarationId
      ? await ctx.db.get(existing.declarationId as Id<"declarations">)
      : null;
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    const { id, ...updates } = args;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );
    if (args.valueAmount !== undefined) {
      patch.valueCurrency = "GBP";
    }
    await ctx.db.patch(id, {
      ...patch,
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

// One-shot helper for unblocking a curated-rule lane: add document codes to
// every goods_item on a declaration. Each `code` is split into CategoryCode
// (first char) + TypeCode (remainder) — matches CDS AdditionalDocument
// concatenation. Dedupes by Category+Type+ID so re-running is idempotent.
//
// Example:
//   npx convex run goods_items:addDocsToAllItems \
//     '{"declarationId":"kn7ber0a8tds7vs4kd936nv3f584x13h","docs":[
//        {"code":"D006","id":"PENDING-D006","statusCode":"XB"},
//        {"code":"D028","id":"PENDING-D028","statusCode":"XB"},
//        {"code":"D031","id":"PENDING-D031","statusCode":"XB"},
//        {"code":"360","id":"PENDING-360","statusCode":"XB"}
//      ]}'
export const addDocsToAllItems = internalMutation({
  args: {
    declarationId: v.id("declarations"),
    docs: v.array(
      v.object({
        code: v.string(),
        id: v.string(),
        statusCode: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration) throw userError("declaration_not_found", "Declaration not found");

    const newDocs = args.docs.map((d) => {
      const code = d.code.trim().toUpperCase();
      if (code.length < 2) throw userError("doc_code_too_short", `Doc code too short: '${d.code}'`);
      const entry: { CategoryCode: string; TypeCode: string; ID: string; StatusCode?: string } = {
        CategoryCode: code.slice(0, 1),
        TypeCode: code.slice(1),
        ID: d.id.trim(),
      };
      if (d.statusCode && d.statusCode.trim()) entry.StatusCode = d.statusCode.trim().toUpperCase();
      return entry;
    });

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(500);

    let patched = 0;
    for (const item of items) {
      const existing = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
      const existingKeys = new Set(
        existing.map((d: { CategoryCode?: string; TypeCode?: string; ID?: string }) =>
          `${(d.CategoryCode || "").toUpperCase()}|${(d.TypeCode || "").toUpperCase()}|${(d.ID || "").toUpperCase()}`,
        ),
      );
      const toAdd = newDocs.filter(
        (d) =>
          !existingKeys.has(
            `${d.CategoryCode.toUpperCase()}|${d.TypeCode.toUpperCase()}|${d.ID.toUpperCase()}`,
          ),
      );
      if (toAdd.length === 0) continue;
      await ctx.db.patch(item._id, {
        additionalDocuments: [...existing, ...toAdd],
      });
      patched++;
    }

    await refreshReadModels(ctx, args.declarationId);
    return { itemsScanned: items.length, itemsPatched: patched, addedPerItem: newDocs.length };
  },
});

// Inverse of addDocsToAllItems — strip every entry whose Cat+Type matches one
// of the supplied codes, on every item in the declaration. Used to undo a bad
// curated-rule patch without touching the user's own document selections.
export const removeDocsFromAllItems = internalMutation({
  args: {
    declarationId: v.id("declarations"),
    codes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration) throw userError("declaration_not_found", "Declaration not found");

    const targets = new Set(args.codes.map((c) => c.trim().toUpperCase()));

    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(500);

    let patched = 0;
    let removed = 0;
    for (const item of items) {
      const existing = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
      if (existing.length === 0) continue;
      const filtered = existing.filter((d: { CategoryCode?: string; TypeCode?: string }) => {
        const combined = `${(d.CategoryCode || "").toUpperCase()}${(d.TypeCode || "").toUpperCase()}`;
        return !targets.has(combined);
      });
      if (filtered.length === existing.length) continue;
      removed += existing.length - filtered.length;
      await ctx.db.patch(item._id, { additionalDocuments: filtered });
      patched++;
    }

    await refreshReadModels(ctx, args.declarationId);
    return { itemsScanned: items.length, itemsPatched: patched, entriesRemoved: removed };
  },
});
