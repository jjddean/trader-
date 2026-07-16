import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { canAccessDeclaration, orgIdFromDeclaration } from "./lib/org_access";

type Ctx = QueryCtx | MutationCtx;

type ApprovalStatus = {
  approvalRequired: boolean;
  approved: boolean;
  approvalCurrent: boolean;
  approval: Doc<"declaration_approvals"> | null;
  reason?: string;
};

function representationType(declaration: Doc<"declarations">) {
  return declaration.representationType ?? "self";
}

function declarationVersion(declaration: Doc<"declarations">) {
  return Number(declaration.lastUpdated || declaration.created || declaration._creationTime || 0);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function fingerprint(value: unknown): string {
  const input = stableStringify(value);
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function materialDeclarationFields(declaration: Doc<"declarations">) {
  const { representationUpdatedAt: _representationUpdatedAt, ...representation } = representationSnapshot(declaration);
  return {
    eori: declaration.eori,
    importerEori: declaration.importerEori,
    declarationType: declaration.declarationType,
    dispatchCountry: declaration.dispatchCountry,
    destinationCountry: declaration.destinationCountry,
    invoiceCurrency: declaration.invoiceCurrency,
    invoiceTotal: declaration.invoiceTotal,
    incoterms: declaration.incoterms,
    incotermLocation: declaration.incotermLocation,
    transactionNatureCode: declaration.transactionNatureCode,
    defermentAccountNumber: declaration.defermentAccountNumber,
    paymentMethodCode: declaration.paymentMethodCode,
    exporterName: declaration.exporterName,
    exporterCity: declaration.exporterCity,
    exporterLine: declaration.exporterLine,
    exporterPostcode: declaration.exporterPostcode,
    exporterEori: declaration.exporterEori,
    ...representation,
  };
}

function materialItemFields(item: Doc<"goods_items">) {
  return {
    id: item._id,
    sequenceNumber: item.sequenceNumber,
    commodityCode: item.commodityCode,
    description: item.description,
    originCountry: item.originCountry,
    procedureCode: item.procedureCode,
    additionalProcedureCode: item.additionalProcedureCode,
    valueAmount: item.valueAmount,
    valueCurrency: item.valueCurrency,
    grossWeightKg: item.grossWeightKg,
    netWeightKg: item.netWeightKg,
    additionalDocuments: item.additionalDocuments,
    supplementaryUnitQty: item.supplementaryUnitQty,
    supplementaryUnitCode: item.supplementaryUnitCode,
    packageCount: item.packageCount,
    packageType: item.packageType,
  };
}

async function materialApprovalFingerprint(ctx: Ctx, declaration: Doc<"declarations">) {
  const items = await ctx.db
    .query("goods_items")
    .withIndex("by_declaration", (q) => q.eq("declarationId", declaration._id))
    .take(500);
  return fingerprint({
    declaration: materialDeclarationFields(declaration),
    items: items.map(materialItemFields).sort((a, b) => String(a.id).localeCompare(String(b.id))),
  });
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function normalizeOptionalTimestamp(value: number | null | undefined) {
  if (value == null) return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function representationSnapshot(declaration: Doc<"declarations">) {
  return {
    representationType: representationType(declaration),
    representativeEori: declaration.representativeEori,
    representativeName: declaration.representativeName,
    representativeAddressLine: declaration.representativeAddressLine,
    representativeCity: declaration.representativeCity,
    representativePostcode: declaration.representativePostcode,
    representativeCountry: declaration.representativeCountry,
    authorityVerified: declaration.authorityVerified ?? false,
    authorityValidFrom: declaration.authorityValidFrom,
    authorityValidTo: declaration.authorityValidTo,
    representationUpdatedAt: declaration.representationUpdatedAt,
  };
}

async function latestApprovedApproval(ctx: Ctx, declarationId: Id<"declarations">) {
  return await ctx.db
    .query("declaration_approvals")
    .withIndex("by_declaration_and_status", (q) =>
      q.eq("declarationId", declarationId).eq("status", "approved"),
    )
    .order("desc")
    .first();
}

export async function getIndirectRepresentationApprovalStatus(
  ctx: Ctx,
  declaration: Doc<"declarations">,
): Promise<ApprovalStatus> {
  const requiresApproval = representationType(declaration) === "indirect";
  if (!requiresApproval) {
    return {
      approvalRequired: false,
      approved: true,
      approvalCurrent: true,
      approval: null,
    };
  }

  const approval = await latestApprovedApproval(ctx, declaration._id);
  if (!approval) {
    return {
      approvalRequired: true,
      approved: false,
      approvalCurrent: false,
      approval: null,
      reason: "Indirect representation requires internal approval before HMRC submission.",
    };
  }

  const currentFingerprint = await materialApprovalFingerprint(ctx, declaration);
  const approvalCurrent = approval.materialFingerprint
    ? approval.materialFingerprint === currentFingerprint
    : Number(approval.declarationLastUpdatedAt || 0) >= declarationVersion(declaration);

  return {
    approvalRequired: true,
    approved: true,
    approvalCurrent,
    approval,
    reason: approvalCurrent
      ? undefined
      : "Material declaration details changed after indirect representation approval; re-approval is required.",
  };
}

export const getStatus = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      return null;
    }

    const status = await getIndirectRepresentationApprovalStatus(ctx, declaration);
    return {
      representation: representationSnapshot(declaration),
      approvalRequired: status.approvalRequired,
      approved: status.approved,
      approvalCurrent: status.approvalCurrent,
      reason: status.reason,
      approval: status.approval
        ? {
          id: status.approval._id,
          approverName: status.approval.approverName,
          approverEmail: status.approval.approverEmail,
          approvedAt: status.approval.approvedAt,
          reason: status.approval.reason,
          riskScore: status.approval.riskScore,
          exposureAmount: status.approval.exposureAmount,
          exposureCurrency: status.approval.exposureCurrency,
        }
        : null,
    };
  },
});

export const listApprovals = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      return [];
    }

    return await ctx.db
      .query("declaration_approvals")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("desc")
      .take(20);
  },
});

export const setRepresentationDetails = mutation({
  args: {
    declarationId: v.id("declarations"),
    representationType: v.union(v.literal("self"), v.literal("direct"), v.literal("indirect")),
    representativeEori: v.optional(v.union(v.string(), v.null())),
    representativeName: v.optional(v.union(v.string(), v.null())),
    representativeAddressLine: v.optional(v.union(v.string(), v.null())),
    representativeCity: v.optional(v.union(v.string(), v.null())),
    representativePostcode: v.optional(v.union(v.string(), v.null())),
    representativeCountry: v.optional(v.union(v.string(), v.null())),
    authorityVerified: v.optional(v.boolean()),
    authorityValidFrom: v.optional(v.union(v.number(), v.null())),
    authorityValidTo: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const patch = args.representationType === "self"
      ? {
        representationType: "self" as const,
        representativeEori: undefined,
        representativeName: undefined,
        representativeAddressLine: undefined,
        representativeCity: undefined,
        representativePostcode: undefined,
        representativeCountry: undefined,
        authorityVerified: false,
        authorityValidFrom: undefined,
        authorityValidTo: undefined,
        representationUpdatedAt: now,
        lastUpdated: now,
      }
      : {
        representationType: args.representationType,
        representativeEori: normalizeOptionalString(args.representativeEori),
        representativeName: normalizeOptionalString(args.representativeName),
        representativeAddressLine: normalizeOptionalString(args.representativeAddressLine),
        representativeCity: normalizeOptionalString(args.representativeCity),
        representativePostcode: normalizeOptionalString(args.representativePostcode),
        representativeCountry: normalizeOptionalString(args.representativeCountry)?.toUpperCase(),
        authorityVerified: args.authorityVerified ?? false,
        authorityValidFrom: normalizeOptionalTimestamp(args.authorityValidFrom),
        authorityValidTo: normalizeOptionalTimestamp(args.authorityValidTo),
        representationUpdatedAt: now,
        lastUpdated: now,
      };

    await ctx.db.patch(args.declarationId, patch);
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "representation_details_updated",
      details: {
        declarationId: args.declarationId,
        representationType: args.representationType,
        hasRepresentativeEori: Boolean(normalizeOptionalString(args.representativeEori)),
        authorityVerified: args.authorityVerified ?? false,
      },
      timestamp: now,
      archived: false,
    });

    return { ok: true, updatedAt: now };
  },
});

export const approveIndirectRepresentation = mutation({
  args: {
    declarationId: v.id("declarations"),
    reason: v.string(),
    riskScore: v.number(),
    exposureAmount: v.optional(v.union(v.number(), v.null())),
    exposureCurrency: v.optional(v.union(v.string(), v.null())),
    exposureReason: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw new Error("Unauthorized");
    }

    if (representationType(declaration) !== "indirect") {
      throw new Error("Only indirect representation declarations require this approval.");
    }

    const reason = args.reason.trim();
    if (reason.length < 5) throw new Error("Approval reason must be at least 5 characters.");
    if (!Number.isFinite(args.riskScore) || args.riskScore < 0 || args.riskScore > 100) {
      throw new Error("Risk score must be between 0 and 100.");
    }
    if (!declaration.authorityVerified) {
      throw new Error("Authority documents must be verified before indirect representation approval.");
    }
    if (!declaration.representativeEori && !declaration.representativeName) {
      throw new Error("Representative EORI or representative name is required before approval.");
    }
    if (declaration.authorityValidTo && declaration.authorityValidTo < Date.now()) {
      throw new Error("Representative authority has expired.");
    }

    const now = Date.now();
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(500);
    const exposureAmount = args.exposureAmount == null ? undefined : args.exposureAmount;
    const exposureCurrency = normalizeOptionalString(args.exposureCurrency)?.toUpperCase() ?? "GBP";
    const exposureReason = normalizeOptionalString(args.exposureReason);
    const materialFingerprint = await materialApprovalFingerprint(ctx, declaration);
    const record = {
      declarationId: args.declarationId,
      userId: identity.subject,
      orgId: orgIdFromDeclaration(declaration),
      approverName: identity.name ?? identity.email ?? identity.subject,
      approverEmail: identity.email,
      approvedAt: now,
      reason,
      riskScore: args.riskScore,
      exposureAmount,
      exposureCurrency: exposureAmount == null ? undefined : exposureCurrency,
      exposureReason,
      declarationLastUpdatedAt: declarationVersion(declaration),
      materialFingerprint,
      declarationSnapshot: declaration,
      itemsSnapshot: items,
      representationSnapshot: representationSnapshot(declaration),
      approvalMethod: "manual_button",
      status: "approved" as const,
      createdAt: now,
    };

    const approvalId = await ctx.db.insert("declaration_approvals", record);

    if (exposureAmount != null) {
      await ctx.db.insert("financial_exposures", {
        declarationId: args.declarationId,
        userId: identity.subject,
        orgId: orgIdFromDeclaration(declaration),
        exposureAmount,
        currency: exposureCurrency,
        exposureReason,
        sourceApprovalId: approvalId,
        createdBy: identity.subject,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "indirect_representation_approved",
      details: {
        declarationId: args.declarationId,
        approvalId,
        riskScore: args.riskScore,
        exposureAmount,
        exposureCurrency: exposureAmount == null ? undefined : exposureCurrency,
      },
      timestamp: now,
      archived: false,
    });

    return { approvalId, approvedAt: now };
  },
});

export const revokeApproval = mutation({
  args: {
    approvalId: v.id("declaration_approvals"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval not found");

    const declaration = await ctx.db.get(approval.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw new Error("Unauthorized");
    }

    const reason = args.reason.trim();
    if (reason.length < 5) throw new Error("Revocation reason must be at least 5 characters.");

    const now = Date.now();
    await ctx.db.patch(args.approvalId, {
      status: "revoked",
      revokedAt: now,
      revokedBy: identity.subject,
      revocationReason: reason,
    });
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "indirect_representation_approval_revoked",
      details: {
        declarationId: approval.declarationId,
        approvalId: args.approvalId,
        reason,
      },
      timestamp: now,
      archived: false,
    });

    return { ok: true, revokedAt: now };
  },
});