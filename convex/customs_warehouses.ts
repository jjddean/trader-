/**
 * Customs warehouse master records and their HMRC authorisations.
 *
 * Spec: `docs/hmrc/customs-warehousing/IMPLEMENTATION_SPEC.md` §4
 * Approval context: `docs/hmrc/customs-warehousing/duty-management/approval.md`
 *
 * One row per authorised warehouse, not per organisation: an operator holding
 * both GB and NI authorisations has two, because HMRC requires a separate
 * application for each.
 *
 * The three declaration data elements that identify a warehouse are stored
 * together and validated as one object, because a mismatch between them is
 * rejected by CDS:
 *
 *   DE 2/7   warehouseTypeCode + warehouseIdentifier
 *   DE 3/39  authorisationTypeCode + authorisationHolderEori
 *   DE 2/3   documentCode + authorisationNumber
 */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { canAccessDeclaration, resolveOrgIdForNewRecord } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

/** DE 2/7 type → DE 3/39 authorisation type → DE 2/3 document code. */
const WAREHOUSE_AUTHORISATION_MAP: Record<
  string,
  { authorisationTypeCode: string; documentCode: string; meaning: string }
> = {
  U: { authorisationTypeCode: "CWP", documentCode: "C517", meaning: "private customs warehouse" },
  R: { authorisationTypeCode: "CW1", documentCode: "C518", meaning: "public customs warehouse type 1" },
  S: { authorisationTypeCode: "CW2", documentCode: "C519", meaning: "public customs warehouse type 2" },
};

/** Types barred from a GB or XI identifier (Appendix 1, procedure 71). */
const TYPES_BARRED_FROM_GB_XI = new Set(["S", "T"]);

function identifierCountry(identifier: string): string {
  const m = identifier.trim().toUpperCase().match(/([A-Z]{2})$/);
  return m ? m[1] : "";
}

/**
 * Validate the warehouse identity chain.
 *
 * Runs at configuration time rather than at submission, so a misconfigured
 * warehouse cannot silently produce rejected declarations later.
 */
function assertWarehouseIdentity(args: {
  warehouseTypeCode: string;
  warehouseIdentifier: string;
  authorisationTypeCode?: string;
}) {
  const type = args.warehouseTypeCode.trim().toUpperCase();
  const identifier = args.warehouseIdentifier.trim().toUpperCase();

  if (!["R", "S", "T", "U"].includes(type)) {
    throw userError(
      "cw_warehouse_type_invalid",
      `Warehouse type ${type || "(blank)"} is not valid for customs warehousing. Use R, S, T or U — Y and Z are not customs warehouses.`,
    );
  }

  const country = identifierCountry(identifier);
  if (!country) {
    throw userError(
      "cw_warehouse_identifier_invalid",
      "The warehouse identifier must end with the authorising country code, for example 1234567GB.",
    );
  }
  if (TYPES_BARRED_FROM_GB_XI.has(type) && ["GB", "XI"].includes(country)) {
    throw userError(
      "cw_warehouse_type_country",
      `Warehouse type ${type} may not be used with a ${country} identifier.`,
    );
  }

  const expected = WAREHOUSE_AUTHORISATION_MAP[type];
  const authType = (args.authorisationTypeCode ?? "").trim().toUpperCase();
  if (expected && authType && authType !== expected.authorisationTypeCode) {
    throw userError(
      "cw_authorisation_type_mismatch",
      `A ${expected.meaning} (type ${type}) uses authorisation type ${expected.authorisationTypeCode}, not ${authType}.`,
    );
  }
  if (authType === "CW2" && ["GB", "XI"].includes(country)) {
    throw userError("cw_cw2_not_gb_xi", "Authorisation type CW2 cannot be used with GB or XI.");
  }
}

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
  if (!identity) throw unauthenticatedError();
  return identity;
}

export const createCustomsWarehouse = mutation({
  args: {
    name: v.string(),
    /** DE 2/7 */
    warehouseTypeCode: v.string(),
    warehouseIdentifier: v.string(),
    /** DE 3/39 + DE 2/3 */
    authorisationTypeCode: v.optional(v.string()),
    authorisationNumber: v.optional(v.string()),
    authorisationHolderEori: v.string(),
    /** DE 5/27 — from the authorisation letter */
    supervisingCustomsOffice: v.optional(v.string()),
    /** DE 5/23 */
    goodsLocationCode: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    city: v.optional(v.string()),
    postcode: v.optional(v.string()),
    country: v.optional(v.string()),
    /**
     * Real time is the HMRC standard. `closing_balance` is permitted only where
     * the warehousekeeper is authorised to run a duty management system in
     * support of a commercial system, and then updates must land before
     * midnight of the following warehouse operation day.
     */
    stockUpdateMode: v.optional(v.union(v.literal("real_time"), v.literal("closing_balance"))),
    /** EIDR for warehouse removals requires real-time stock records. */
    eidrAuthorised: v.optional(v.boolean()),
    permittedCommodityCodes: v.optional(v.array(v.string())),
    permittedProcedureCodes: v.optional(v.array(v.string())),
    coStorageApproved: v.optional(v.boolean()),
    commonStorageApproved: v.optional(v.boolean()),
    fifoApproved: v.optional(v.boolean()),
    ufhApproved: v.optional(v.boolean()),
    guaranteeReference: v.optional(v.string()),
    aeoStatus: v.optional(v.boolean()),
    authorisationValidFrom: v.optional(v.number()),
    authorisationValidTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    const type = args.warehouseTypeCode.trim().toUpperCase();
    const identifier = args.warehouseIdentifier.trim().toUpperCase();
    assertWarehouseIdentity({
      warehouseTypeCode: type,
      warehouseIdentifier: identifier,
      authorisationTypeCode: args.authorisationTypeCode,
    });

    // The DE 2/7 pair must be unique: two records for one warehouse would let
    // two stock accounts drift apart for the same physical goods.
    const clash = await ctx.db
      .query("customs_warehouses")
      .withIndex("by_identifier", (q) => q.eq("warehouseIdentifier", identifier))
      .first();
    if (clash) {
      throw userError(
        "cw_warehouse_duplicate",
        `A warehouse with identifier ${identifier} already exists.`,
      );
    }

    // HMRC: EIDR for warehouse removals is only permitted where stock records
    // are maintained by real-time processing. Forced rather than validated, so
    // the combination cannot exist.
    const stockUpdateMode = args.eidrAuthorised ? "real_time" : args.stockUpdateMode ?? "real_time";

    const derived = WAREHOUSE_AUTHORISATION_MAP[type];
    const now = Date.now();

    return await ctx.db.insert("customs_warehouses", {
      userId: identity.subject,
      orgId: await resolveOrgIdForNewRecord(ctx, identity.subject),
      name: args.name.trim(),
      warehouseTypeCode: type,
      warehouseIdentifier: identifier,
      authorisationTypeCode:
        (args.authorisationTypeCode ?? "").trim().toUpperCase() || derived?.authorisationTypeCode,
      documentCode: derived?.documentCode,
      authorisationNumber: args.authorisationNumber?.trim(),
      authorisationHolderEori: args.authorisationHolderEori.trim().toUpperCase(),
      supervisingCustomsOffice: args.supervisingCustomsOffice?.trim().toUpperCase(),
      goodsLocationCode: args.goodsLocationCode?.trim().toUpperCase(),
      addressLine: args.addressLine,
      city: args.city,
      postcode: args.postcode,
      country: args.country,
      stockUpdateMode,
      eidrAuthorised: args.eidrAuthorised ?? false,
      permittedCommodityCodes: args.permittedCommodityCodes,
      permittedProcedureCodes: args.permittedProcedureCodes,
      coStorageApproved: args.coStorageApproved ?? false,
      commonStorageApproved: args.commonStorageApproved ?? false,
      fifoApproved: args.fifoApproved ?? false,
      ufhApproved: args.ufhApproved ?? false,
      guaranteeReference: args.guaranteeReference,
      aeoStatus: args.aeoStatus ?? false,
      authorisationValidFrom: args.authorisationValidFrom,
      authorisationValidTo: args.authorisationValidTo,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCustomsWarehouse = mutation({
  args: {
    id: v.id("customs_warehouses"),
    name: v.optional(v.string()),
    supervisingCustomsOffice: v.optional(v.string()),
    goodsLocationCode: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    city: v.optional(v.string()),
    postcode: v.optional(v.string()),
    country: v.optional(v.string()),
    stockUpdateMode: v.optional(v.union(v.literal("real_time"), v.literal("closing_balance"))),
    eidrAuthorised: v.optional(v.boolean()),
    permittedCommodityCodes: v.optional(v.array(v.string())),
    permittedProcedureCodes: v.optional(v.array(v.string())),
    coStorageApproved: v.optional(v.boolean()),
    commonStorageApproved: v.optional(v.boolean()),
    fifoApproved: v.optional(v.boolean()),
    ufhApproved: v.optional(v.boolean()),
    guaranteeReference: v.optional(v.string()),
    aeoStatus: v.optional(v.boolean()),
    authorisationValidTo: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("revoked"))),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw forbiddenError();
    }

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }

    // The DE 2/7 pair is deliberately not patchable — changing it would
    // silently re-point existing stock at a different warehouse. Create a new
    // record instead.
    const eidr = args.eidrAuthorised ?? existing.eidrAuthorised;
    if (eidr) patch.stockUpdateMode = "real_time";

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const listCustomsWarehouses = query({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return [];
    const rows = await ctx.db.query("customs_warehouses").order("desc").take(200);
    const visible = [];
    for (const row of rows) {
      if (await canAccessDeclaration(ctx, identity.subject, row)) visible.push(row);
    }
    return visible;
  },
});

export const getCustomsWarehouse = query({
  args: { id: v.id("customs_warehouses") },
  handler: async (ctx, args) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return null;
    const row = await ctx.db.get(args.id);
    if (!row || !(await canAccessDeclaration(ctx, identity.subject, row))) return null;
    return row;
  },
});
