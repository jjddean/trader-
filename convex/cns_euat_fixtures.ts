import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * EUAT test fixture helpers — CNS inventory-linked testing only.
 *
 * Internal-only and never referenced by application code. These exist so an
 * EUAT test declaration can be built from a declaration HMRC has ALREADY
 * accepted, changing only the fields the CNS inventory pre-check matches on.
 * That way a rejection points at the inventory linking, not at unrelated
 * declaration data that was never proven.
 *
 * No values are invented here: every override is supplied by the caller from
 * the CNS-issued fixture table.
 */

/** Set the DE 4/1 incoterm fields on an EUAT test declaration. */
export const setIncoterms = internalMutation({
  args: {
    declarationId: v.id("declarations"),
    incoterms: v.string(),
    incotermLocation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.declarationId, {
      incoterms: args.incoterms.trim().toUpperCase(),
      incotermLocation: args.incotermLocation.trim(),
      lastUpdated: Date.now(),
    });
    return null;
  },
});

/**
 * Declaration + items for an offline XML dry run, so the generated payload can
 * be inspected without a browser session or any call to CNS.
 */
export const getDeclarationForDryRun = internalQuery({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const lane = await ctx.db.get(args.declarationId);
    if (!lane) throw new Error("Declaration not found.");
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(100);
    return { lane, items };
  },
});

/**
 * Clone an existing declaration and its goods items, applying CNS overrides.
 *
 * The clone is deliberately a NEW declaration rather than a mutation of the
 * original: the source is an accepted TDR declaration with a live MRN and must
 * not be disturbed.
 */
export const cloneDeclarationForCns = internalMutation({
  args: {
    sourceDeclarationId: v.id("declarations"),
    cnsUcn: v.string(),
    containerNumber: v.string(),
    goodsLocationCode: v.string(),
    packageCount: v.number(),
    grossWeightKg: v.number(),
  },
  returns: v.object({
    declarationId: v.id("declarations"),
    itemCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceDeclarationId);
    if (!source) throw new Error("Source declaration not found.");

    // Strip system fields and anything tying the clone to the original
    // submission — a fresh declaration must not inherit an MRN, a conversation
    // id or a prior status.
    const {
      _id: _sourceId,
      _creationTime: _sourceCreated,
      mrn: _mrn,
      conversationId: _conversationId,
      status: _status,
      submissionTransport: _transport,
      cnsCspId: _cspId,
      cnsTransportState: _transportState,
      cnsInventoryState: _inventoryState,
      ...carried
    } = source;

    const now = Date.now();
    const declarationId = await ctx.db.insert("declarations", {
      ...carried,
      status: "Draft",
      created: now,
      lastUpdated: now,
      // CNS inventory linking
      locationId: args.goodsLocationCode,
      goodsLocationKind: "port",
      containerNumber: args.containerNumber,
      cnsUcn: args.cnsUcn,
    });

    const sourceItems = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.sourceDeclarationId))
      .take(100);

    let itemCount = 0;
    for (const item of sourceItems) {
      const { _id: _itemId, _creationTime: _itemCreated, ...itemCarried } = item;
      await ctx.db.insert("goods_items", {
        ...itemCarried,
        declarationId,
        // Matched to the CNS inventory record. A single-item declaration carries
        // the whole consignment quantity; multi-item would need apportioning,
        // which is why this helper refuses below.
        packageCount: args.packageCount,
        grossWeightKg: args.grossWeightKg,
        netWeightKg: args.grossWeightKg,
      });
      itemCount += 1;
    }

    if (itemCount !== 1) {
      throw new Error(
        `Source declaration has ${itemCount} goods items. This helper only handles single-item declarations, because package count and gross weight must total the inventory record exactly.`,
      );
    }

    return { declarationId, itemCount };
  },
});
