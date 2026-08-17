import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getActiveOrgId, listDeclarationsForTenant } from "./lib/org_access";
import { buildTenantDeclarationMrnLinks } from "./lib/tre_links";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

const treRowValidator = v.object({
  reportKind: v.string(),
  entryIdentifierMrn: v.string(),
  sourceRowHash: v.string(),
  sourceLineNumber: v.number(),
  itemNumber: v.optional(v.string()),
  declarantEori: v.optional(v.string()),
  importerEori: v.optional(v.string()),
  commodityCode: v.optional(v.string()),
  countryOfOriginCode: v.optional(v.string()),
  countryOfDispatchCode: v.optional(v.string()),
  destinationCountryCode: v.optional(v.string()),
  preferenceCode: v.optional(v.string()),
  itemCustomsValue: v.optional(v.number()),
  taxLineTotalAmount: v.optional(v.number()),
  methodOfPaymentCode: v.optional(v.string()),
  customsProcedureCodeCpc: v.optional(v.string()),
  taxType: v.optional(v.string()),
  dutyRatePercent: v.optional(v.number()),
  acceptanceDate: v.optional(v.string()),
  goodsDescription: v.optional(v.string()),
  netMassKg: v.optional(v.number()),
  documentCodes: v.optional(v.string()),
  invoiceTotalGbp: v.optional(v.number()),
  transportCostGbp: v.optional(v.number()),
  totalDutyGbp: v.optional(v.number()),
  totalVatGbp: v.optional(v.number()),
  goodsDepartureDate: v.optional(v.string()),
});

const TRE_MAX_ROWS = 1000;

export const listImports = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const orgId = await getActiveOrgId(ctx, identity.subject);
    if (orgId) {
      return await ctx.db
        .query("tre_imports")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(50);
    }

    return await ctx.db
      .query("tre_imports")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(50);
  },
});

export const listImportRows = query({
  args: { importId: v.id("tre_imports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const record = await ctx.db.get(args.importId);
    if (!record) throw userError("import_not_found", "Import not found");

    const orgId = await getActiveOrgId(ctx, identity.subject);
    if (orgId) {
      if (record.orgId !== orgId) throw forbiddenError();
    } else if (record.userId !== identity.subject) {
      throw forbiddenError();
    }

    const rows = await ctx.db
      .query("historical_declarations")
      .withIndex("by_import", (q) => q.eq("importId", args.importId))
      .take(1000);

    const tenantDeclarations = await listDeclarationsForTenant(ctx, identity.subject, 1000);
    const mrnLinks = buildTenantDeclarationMrnLinks(tenantDeclarations);

    return rows.map((row) => {
      const mrn = String(row.entryIdentifierMrn ?? "");
      return {
        id: row._id,
        mrn: mrn || "—",
        reportKind: row.reportKind ? String(row.reportKind) : "—",
        commodityCode: row.commodityCode ? String(row.commodityCode) : "—",
        origin: row.countryOfOriginCode ? String(row.countryOfOriginCode) : "—",
        dispatch: row.countryOfDispatchCode ? String(row.countryOfDispatchCode) : "—",
        preferenceCode: row.preferenceCode ? String(row.preferenceCode) : "—",
        taxType: row.taxType ? String(row.taxType) : "—",
        amount: row.taxLineTotalAmount ?? null,
        customsValue: row.itemCustomsValue ?? null,
        declarantEori: row.declarantEori ? String(row.declarantEori) : "—",
        acceptanceDate: row.acceptanceDate ? String(row.acceptanceDate) : "—",
        description: row.goodsDescription ? String(row.goodsDescription) : "—",
        linkedDeclarationId: mrnLinks.get(mrn) ?? null,
      };
    });
  },
});

export const commitImport = mutation({
  args: {
    filename: v.string(),
    reportFormat: v.string(),
    checksum: v.string(),
    rowCount: v.number(),
    warnings: v.array(v.string()),
    rows: v.array(treRowValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const orgId = await getActiveOrgId(ctx, identity.subject);
    if (!orgId) {
      throw userError("select_an_organisation_workspace_before_importing", "Select an organisation workspace before importing TRE data.");
    }

    if (args.rows.length > TRE_MAX_ROWS) {
      throw userError("maximum_rows_per_import", `Maximum ${TRE_MAX_ROWS} rows per import.`);
    }

    if (args.rows.length === 0) {
      throw userError("no_importable_rows_found_in_csv", "No importable rows found in CSV.");
    }

    const importId = await ctx.db.insert("tre_imports", {
      orgId,
      userId: identity.subject,
      filename: args.filename,
      reportFormat: args.reportFormat,
      rowCount: args.rowCount,
      lineItemsStored: 0,
      lineItemsSkipped: 0,
      status: "processing",
      warnings: args.warnings,
      checksum: args.checksum,
      createdAt: Date.now(),
    });

    let lineItemsStored = 0;
    let lineItemsSkipped = 0;
    const now = Date.now();

    for (const row of args.rows) {
      const existing = await ctx.db
        .query("historical_declarations")
        .withIndex("by_org_row_hash", (q) =>
          q.eq("orgId", orgId).eq("sourceRowHash", row.sourceRowHash),
        )
        .first();

      if (existing) {
        lineItemsSkipped++;
        continue;
      }

      await ctx.db.insert("historical_declarations", {
        userId: identity.subject,
        orgId,
        importId,
        sourceRowHash: row.sourceRowHash,
        reportKind: row.reportKind,
        entryIdentifierMrn: row.entryIdentifierMrn,
        declarantEori: row.declarantEori,
        importerEori: row.importerEori,
        countryOfOriginCode: row.countryOfOriginCode,
        countryOfDispatchCode: row.countryOfDispatchCode,
        destinationCountryCode: row.destinationCountryCode,
        preferenceCode: row.preferenceCode,
        itemCustomsValue: row.itemCustomsValue,
        taxLineTotalAmount: row.taxLineTotalAmount,
        methodOfPaymentCode: row.methodOfPaymentCode,
        customsProcedureCodeCpc: row.customsProcedureCodeCpc,
        taxType: row.taxType,
        commodityCode: row.commodityCode,
        dutyRatePercent: row.dutyRatePercent,
        acceptanceDate: row.acceptanceDate,
        goodsDescription: row.goodsDescription,
        netMassKg: row.netMassKg,
        documentCodes: row.documentCodes,
        invoiceTotalGbp: row.invoiceTotalGbp,
        transportCostGbp: row.transportCostGbp,
        totalDutyGbp: row.totalDutyGbp,
        totalVatGbp: row.totalVatGbp,
        goodsDepartureDate: row.goodsDepartureDate,
        createdAt: now,
      });
      lineItemsStored++;
    }

    await ctx.db.patch(importId, {
      status: "completed",
      lineItemsStored,
      lineItemsSkipped,
      completedAt: Date.now(),
    });

    await ctx.runMutation(internal.declarations.refreshRateCache, {
      orgId,
      userId: identity.subject,
    });

    try {
      await ctx.runMutation(internal.audit.logAction, {
        userId: identity.subject,
        action: "tre_import_completed",
        entityId: String(importId),
        metadata: {
          orgId,
          filename: args.filename,
          reportFormat: args.reportFormat,
          lineItemsStored,
          lineItemsSkipped,
          rowCount: args.rowCount,
        },
      });
    } catch {
      // Audit failure must not block import.
    }

    return {
      importId,
      lineItemsStored,
      lineItemsSkipped,
      rowCount: args.rowCount,
      warnings: args.warnings,
    };
  },
});
