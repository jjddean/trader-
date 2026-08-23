/**
 * Warehouse entries — a cleared H2 becoming stock under procedure.
 *
 * Spec: `docs/hmrc/customs-warehousing/IMPLEMENTATION_SPEC.md` §5, phase E
 * Handbook: `docs/hmrc/customs-warehousing/operations/receiving.md`
 * Logic: `src/lib/warehouse/receipt.ts`
 *
 * The entry is deliberately separate from the stock lot. One entry can be
 * received short, over or damaged, and HMRC has a distinct reporting duty for
 * each; folding the two together would make partial discharge unrepresentable
 * later.
 *
 * Receipt is the point at which goods become stock under the procedure, so it
 * writes three things in one transaction: the lots, their opening RECEIPT
 * movements, and the entry's new status. A partial write would leave a stock
 * account that does not reconcile, which is the one thing an assurance visit
 * looks for.
 */

import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { canAccessDeclaration, resolveOrgIdForNewRecord } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";
import {
  arrivalDeadline,
  assertTransition,
  classifyReceipt,
  discrepancyDeadline,
  isDiscrepancyNotificationLate,
  isReceiptOverdue,
  planOvershipment,
  planUndershipment,
  quantityToAdmit,
  receiptOutcome,
  statusAfterReceipt,
  validateReceipt,
  type DeclaredLine,
  type WarehouseEntryStatus,
} from "../src/lib/warehouse/receipt";

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
  if (!identity) throw unauthenticatedError();
  return identity;
}

type Ctx = GenericMutationCtx<DataModel>;

async function loadEntry(ctx: Ctx, userId: string, id: Id<"warehouse_entries">) {
  const entry = await ctx.db.get(id);
  if (!entry || !(await canAccessDeclaration(ctx, userId, entry))) throw forbiddenError();
  return entry;
}

async function loadWarehouse(ctx: Ctx, userId: string, id: Id<"customs_warehouses">) {
  const warehouse = await ctx.db.get(id);
  if (!warehouse || !(await canAccessDeclaration(ctx, userId, warehouse))) throw forbiddenError();
  return warehouse;
}

/**
 * The declared lines for an entry.
 *
 * Quantity is taken from the supplementary units where the tariff demands them
 * and falls back to the package count, because that is what the H2 actually
 * carries — there is no separate "warehouse quantity" data element.
 */
async function declaredLinesFor(ctx: Ctx, declarationId: Id<"declarations">): Promise<{
  lines: DeclaredLine[];
  items: Doc<"goods_items">[];
}> {
  const items = await ctx.db
    .query("goods_items")
    .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
    .collect();

  const ordered = [...items].sort(
    (a, b) => Number(a.sequenceNumber ?? 0) - Number(b.sequenceNumber ?? 0),
  );

  const lines = ordered.map((item, index) => ({
    itemNumber: Number(item.sequenceNumber ?? index + 1),
    declaredQuantity: Number(item.supplementaryUnitQty ?? item.packageCount ?? 0),
  }));

  return { lines, items: ordered };
}

function throwIfInvalid(code: string, errors: string[]) {
  if (errors.length > 0) throw userError(code, errors.join(" "));
}

export const createWarehouseEntry = mutation({
  args: {
    customsWarehouseId: v.id("customs_warehouses"),
    declarationId: v.optional(v.id("declarations")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const warehouse = await loadWarehouse(ctx, identity.subject, args.customsWarehouseId);

    if (warehouse.status !== "active") {
      throw userError(
        "cw_warehouse_not_active",
        `The warehouse authorisation is ${warehouse.status}; goods may not be entered to the procedure.`,
      );
    }

    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw forbiddenError();
      }
      const existing = await ctx.db
        .query("warehouse_entries")
        .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
        .first();
      if (existing) {
        throw userError(
          "cw_entry_duplicate",
          "This declaration already has a warehouse entry. One H2 enters goods to the procedure once.",
        );
      }
    }

    const now = Date.now();
    return await ctx.db.insert("warehouse_entries", {
      customsWarehouseId: args.customsWarehouseId,
      declarationId: args.declarationId,
      orgId: await resolveOrgIdForNewRecord(ctx, identity.subject),
      status: "DRAFT",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Move an entry through the pre-receipt lifecycle.
 *
 * Kept as one mutation over a validated transition table rather than a handful
 * of near-identical ones, so the permitted paths are stated in a single place
 * and cannot drift apart.
 *
 * `RELEASED_TO_WAREHOUSING` sets `releasedAt`, which starts the five working
 * day arrival clock, and `CDS_ACCEPTED` sets `enteredAt`, which starts the
 * fourteen day discrepancy clock. They are different dates by design.
 */
export const advanceWarehouseEntry = mutation({
  args: {
    id: v.id("warehouse_entries"),
    to: v.union(
      v.literal("H2_SUBMITTED"),
      v.literal("CDS_ACCEPTED"),
      v.literal("RELEASED_TO_WAREHOUSING"),
      v.literal("AWAITING_RECEIPT"),
      v.literal("REJECTED"),
    ),
    entryMrn: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const entry = await loadEntry(ctx, identity.subject, args.id);

    throwIfInvalid(
      "cw_entry_transition_invalid",
      assertTransition(entry.status as WarehouseEntryStatus, args.to),
    );

    const at = args.occurredAt ?? Date.now();
    const patch: Record<string, unknown> = { status: args.to, updatedAt: Date.now() };

    if (args.entryMrn) patch.entryMrn = args.entryMrn.trim().toUpperCase();
    if (args.notes !== undefined) patch.notes = args.notes;

    // The date of entry to the procedure. The undershipment notification
    // deadline is measured from here, not from the receipt.
    if (args.to === "CDS_ACCEPTED") patch.enteredAt = at;
    // CDS clearance. The five working day arrival expectation runs from here.
    if (args.to === "RELEASED_TO_WAREHOUSING") patch.releasedAt = at;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

/**
 * Receive goods against a cleared entry.
 *
 * Creates one stock lot per declared goods item, each with an opening RECEIPT
 * movement, and leaves the entry in `RECEIVED` or `DISCREPANCY` depending on
 * whether the goods matched the declaration.
 *
 * The lot is credited with the *declared* quantity where the shipment is over,
 * never the received quantity: goods enter the procedure by being declared to
 * it, and the excess is a separate matter handled by the returned plan.
 */
export const recordWarehouseReceipt = mutation({
  args: {
    id: v.id("warehouse_entries"),
    receivedAt: v.optional(v.number()),
    lines: v.array(
      v.object({
        itemNumber: v.number(),
        receivedQuantity: v.number(),
        warehouseLocation: v.optional(v.string()),
        /**
         * DBT-licensable goods may be warehoused without the licence, but the
         * stock record must be noted so discharge to free circulation is
         * blocked until it is produced.
         */
        licenceRequired: v.optional(v.boolean()),
        licenceReference: v.optional(v.string()),
        preferenceClaimIntended: v.optional(v.boolean()),
        preferenceType: v.optional(v.string()),
        /** Endorsed with the stock reference and the date of storage. */
        proofOfOriginRef: v.optional(v.string()),
        quotaOrderNumber: v.optional(v.string()),
      }),
    ),
    /** Required when any line is over-shipped; the two flows differ entirely. */
    overshipmentIntent: v.optional(
      v.union(v.literal("warehouse_the_excess"), v.literal("release_to_free_circulation")),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const entry = await loadEntry(ctx, identity.subject, args.id);
    const warehouse = await loadWarehouse(ctx, identity.subject, entry.customsWarehouseId);

    if (!entry.declarationId) {
      throw userError(
        "cw_entry_no_declaration",
        "This entry has no H2 declaration, so there is nothing to receive against.",
      );
    }

    const existingLots = await ctx.db
      .query("warehouse_stock_lots")
      .withIndex("by_entry", (q) => q.eq("warehouseEntryId", args.id))
      .first();
    if (existingLots) {
      throw userError(
        "cw_receipt_already_recorded",
        "Goods have already been received against this entry. Record a discrepancy or an adjustment instead.",
      );
    }

    const { lines: declared, items } = await declaredLinesFor(ctx, entry.declarationId);

    throwIfInvalid(
      "cw_receipt_invalid",
      validateReceipt({
        entryStatus: entry.status as WarehouseEntryStatus,
        declared,
        received: args.lines,
        overshipmentIntent: args.overshipmentIntent,
        warehouseStatus: warehouse.status,
      }),
    );

    const comparison = classifyReceipt(declared, args.lines);
    const receivedAt = args.receivedAt ?? Date.now();
    const now = Date.now();
    const byItem = new Map(args.lines.map((l) => [l.itemNumber, l]));
    const itemByNumber = new Map(
      items.map((item, index) => [Number(item.sequenceNumber ?? index + 1), item]),
    );

    const lotIds: Id<"warehouse_stock_lots">[] = [];

    for (const line of comparison) {
      const supplied = byItem.get(line.itemNumber);
      const item = itemByNumber.get(line.itemNumber);
      const admitted = quantityToAdmit(line);

      const lotId = await ctx.db.insert("warehouse_stock_lots", {
        customsWarehouseId: entry.customsWarehouseId,
        warehouseEntryId: args.id,
        orgId: entry.orgId,
        entryMrn: entry.entryMrn,
        entryGoodsItemNumber: line.itemNumber,
        procedureCode: item?.procedureCode ? String(item.procedureCode) : undefined,
        commodityCode: item?.commodityCode ? String(item.commodityCode) : undefined,
        description: item?.description ? String(item.description) : undefined,
        originCountry: item?.originCountry ? String(item.originCountry) : undefined,
        packages: item?.packageCount ?? undefined,
        packageType: item?.packageType ?? undefined,
        grossMass: item?.grossWeightKg ? Number(item.grossWeightKg) : undefined,
        quantityEntered: admitted,
        quantityRemaining: admitted,
        statisticalValue: item?.statisticalValue ?? undefined,
        warehouseLocation: supplied?.warehouseLocation,
        licenceRequired: supplied?.licenceRequired ?? false,
        licenceReference: supplied?.licenceReference,
        preferenceClaimIntended: supplied?.preferenceClaimIntended ?? false,
        preferenceType: supplied?.preferenceType,
        proofOfOriginRef: supplied?.proofOfOriginRef,
        quotaOrderNumber: supplied?.quotaOrderNumber,
        // A short line is held until the supervising office has resolved it, so
        // it cannot be discharged as though the goods were all present.
        status: line.outcome === "UNDER_SHIPMENT" ? "BLOCKED" : "UNDER_PROCEDURE",
        enteredAt: entry.enteredAt ?? receivedAt,
        updatedAt: now,
      });

      await ctx.db.insert("warehouse_movements", {
        stockLotId: lotId,
        customsWarehouseId: entry.customsWarehouseId,
        orgId: entry.orgId,
        type: "RECEIPT",
        quantity: admitted,
        balanceAfter: admitted,
        occurredAt: receivedAt,
        recordedAt: now,
        userId: identity.subject,
        declarationRef: entry.entryMrn,
        toLocation: supplied?.warehouseLocation,
        reason:
          line.outcome === "MATCHED"
            ? undefined
            : `Received ${line.receivedQuantity} against ${line.declaredQuantity} declared (${line.outcome}).`,
      });

      lotIds.push(lotId);
    }

    const outcome = receiptOutcome(comparison);
    const nextStatus = statusAfterReceipt(comparison);

    await ctx.db.patch(args.id, {
      receivedAt,
      status: nextStatus,
      discrepancyType: outcome === "MATCHED" ? undefined : outcome,
      updatedAt: now,
    });

    const enteredAt = entry.enteredAt ?? receivedAt;
    const shortTotal = comparison
      .filter((l) => l.outcome === "UNDER_SHIPMENT")
      .reduce((sum, l) => sum + Math.abs(l.variance), 0);
    const excessTotal = comparison
      .filter((l) => l.outcome === "OVER_SHIPMENT")
      .reduce((sum, l) => sum + l.variance, 0);

    return {
      lotIds,
      outcome,
      status: nextStatus,
      overdue: isReceiptOverdue({ releasedAt: entry.releasedAt, receivedAt }),
      arrivalDeadline: entry.releasedAt ? arrivalDeadline(entry.releasedAt) : undefined,
      undershipment: shortTotal > 0 ? planUndershipment(shortTotal, enteredAt) : undefined,
      overshipment:
        excessTotal > 0 && args.overshipmentIntent
          ? planOvershipment(excessTotal, args.overshipmentIntent, enteredAt)
          : undefined,
    };
  },
});

/**
 * Report a discrepancy to the supervising office.
 *
 * Records the notification rather than sending it — HMRC expects contact with
 * the office named in the authorisation letter, by whatever means that office
 * uses. What the product owes is the evidence that it happened, and when.
 */
export const reportWarehouseDiscrepancy = mutation({
  args: {
    id: v.id("warehouse_entries"),
    discrepancyType: v.union(
      v.literal("UNDER_SHIPMENT"),
      v.literal("OVER_SHIPMENT"),
      v.literal("DAMAGE"),
      v.literal("OTHER"),
    ),
    supervisingOfficeRef: v.string(),
    reportedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const entry = await loadEntry(ctx, identity.subject, args.id);

    const current = entry.status as WarehouseEntryStatus;
    if (current !== "DISCREPANCY") {
      throwIfInvalid("cw_entry_transition_invalid", assertTransition(current, "DISCREPANCY"));
    }

    if (!args.supervisingOfficeRef.trim()) {
      throw userError(
        "cw_supervising_office_ref_required",
        "Record the supervising office reference for the notification — it is the evidence the report was made.",
      );
    }

    const reportedAt = args.reportedAt ?? Date.now();

    await ctx.db.patch(args.id, {
      status: "DISCREPANCY",
      discrepancyType: args.discrepancyType,
      discrepancyReportedAt: reportedAt,
      supervisingOfficeRef: args.supervisingOfficeRef.trim(),
      notes: args.notes ?? entry.notes,
      updatedAt: Date.now(),
    });

    const enteredAt = entry.enteredAt;
    return {
      reportedAt,
      deadline: enteredAt ? discrepancyDeadline(enteredAt) : undefined,
      // Reported late is still reported. Surfaced so the warehousekeeper knows
      // the office will ask, not to prevent the record being made.
      late: enteredAt ? isDiscrepancyNotificationLate(enteredAt, reportedAt) : false,
    };
  },
});

/**
 * Close a discrepancy once the supervising office has resolved it.
 *
 * The handbook is explicit that the entry must then be amended, so the
 * amendment reference is required rather than optional — without it there is
 * no trail from the resolved discrepancy to the corrected declaration.
 */
export const resolveWarehouseDiscrepancy = mutation({
  args: {
    id: v.id("warehouse_entries"),
    amendmentRef: v.string(),
    resolvedAt: v.optional(v.number()),
    /** Lots held while the discrepancy was open are released back to stock. */
    releaseBlockedLots: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const entry = await loadEntry(ctx, identity.subject, args.id);

    throwIfInvalid(
      "cw_entry_transition_invalid",
      assertTransition(entry.status as WarehouseEntryStatus, "RECEIVED"),
    );

    if (!args.amendmentRef.trim()) {
      throw userError(
        "cw_amendment_ref_required",
        "An amendment of the entry is required once a discrepancy is resolved. Record its reference.",
      );
    }

    const now = args.resolvedAt ?? Date.now();

    if (args.releaseBlockedLots !== false) {
      const lots = await ctx.db
        .query("warehouse_stock_lots")
        .withIndex("by_entry", (q) => q.eq("warehouseEntryId", args.id))
        .collect();
      for (const lot of lots) {
        if (lot.status === "BLOCKED") {
          await ctx.db.patch(lot._id, {
            status: lot.quantityRemaining > 0 ? "UNDER_PROCEDURE" : "DISCHARGED",
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.patch(args.id, {
      status: "RECEIVED",
      notes: [entry.notes, `Discrepancy resolved; entry amended (${args.amendmentRef.trim()}).`]
        .filter(Boolean)
        .join(" "),
      updatedAt: now,
    });

    return args.id;
  },
});

export const listWarehouseEntries = query({
  args: { customsWarehouseId: v.optional(v.id("customs_warehouses")) },
  handler: async (ctx, args) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return [];

    const rows = args.customsWarehouseId
      ? await ctx.db
          .query("warehouse_entries")
          .withIndex("by_warehouse", (q) => q.eq("customsWarehouseId", args.customsWarehouseId!))
          .order("desc")
          .take(200)
      : await ctx.db.query("warehouse_entries").order("desc").take(200);

    const visible = [];
    for (const row of rows) {
      if (await canAccessDeclaration(ctx, identity.subject, row)) visible.push(row);
    }
    return visible;
  },
});

export const getWarehouseEntry = query({
  args: { id: v.id("warehouse_entries") },
  handler: async (ctx, args) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return null;

    const entry = await ctx.db.get(args.id);
    if (!entry || !(await canAccessDeclaration(ctx, identity.subject, entry))) return null;

    const lots = await ctx.db
      .query("warehouse_stock_lots")
      .withIndex("by_entry", (q) => q.eq("warehouseEntryId", args.id))
      .collect();

    return {
      ...entry,
      lots,
      arrivalDeadline: entry.releasedAt ? arrivalDeadline(entry.releasedAt) : undefined,
      discrepancyDeadline: entry.enteredAt ? discrepancyDeadline(entry.enteredAt) : undefined,
      overdue: isReceiptOverdue({ releasedAt: entry.releasedAt, receivedAt: entry.receivedAt }),
    };
  },
});

/**
 * Entries released to warehousing where the goods have not arrived in time.
 *
 * The handbook puts the duty to explain an unexplained delay on the depositor,
 * so this exists to make the delay visible before the supervising office finds
 * it.
 */
export const listOverdueReceipts = query({
  args: { customsWarehouseId: v.optional(v.id("customs_warehouses")) },
  handler: async (ctx, args) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return [];

    const rows = args.customsWarehouseId
      ? await ctx.db
          .query("warehouse_entries")
          .withIndex("by_warehouse", (q) => q.eq("customsWarehouseId", args.customsWarehouseId!))
          .take(500)
      : await ctx.db.query("warehouse_entries").take(500);

    const now = Date.now();
    const overdue = [];
    for (const row of rows) {
      const awaiting = row.status === "RELEASED_TO_WAREHOUSING" || row.status === "AWAITING_RECEIPT";
      if (!awaiting || !row.releasedAt) continue;
      if (!isReceiptOverdue({ releasedAt: row.releasedAt }, now)) continue;
      if (!(await canAccessDeclaration(ctx, identity.subject, row))) continue;
      overdue.push({ ...row, arrivalDeadline: arrivalDeadline(row.releasedAt) });
    }
    return overdue;
  },
});
