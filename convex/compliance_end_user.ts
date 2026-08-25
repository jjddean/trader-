import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dispatchIsOpen } from "./compliance_consultant";
import { assertNoOpenConsultantDispatch } from "./lib/consultant_dispatch_guard";
import {
  findReviewCredential,
  type ReviewCredentialInput,
} from "./lib/consultant_review_credentials";
import { assertAssessmentAccess, canAccessAssessment } from "./lib/org_access";
import { assertConsultantPartnerSecret } from "./lib/secret_compare";
import { unauthenticatedError, userError } from "./lib/user_errors";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EndUserCredentialInput {
  tokenHash: string;
  partnerSecret: string;
}

function requestRejected(): never {
  throw userError("request_not_accepted", "Request not accepted");
}

function normalizedHash(value: string): string {
  const hash = value.trim().toLowerCase();
  if (!HASH_PATTERN.test(hash)) requestRejected();
  return hash;
}

function normalizedEmail(value: string): string {
  const email = value.trim();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) requestRejected();
  return email;
}

function optionalEmail(value: string | undefined): string | undefined {
  if (value === undefined || !value.trim()) return undefined;
  return normalizedEmail(value);
}

function requiredText(value: string, maxLength: number): string {
  const text = value.trim();
  if (!text || text.length > maxLength) requestRejected();
  return text;
}

function optionalText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (text.length > maxLength) requestRejected();
  return text || undefined;
}

async function getValidReviewToken(ctx: any, credential: ReviewCredentialInput) {
  const row = await findReviewCredential(ctx, credential);
  const now = Date.now();
  if (!row || row.revoked || row.completedAt || row.expiresAt <= now) return null;
  const request = await ctx.db.get(row.expertRequestId);
  if (!request || !dispatchIsOpen(request, now)) return null;
  return row;
}

async function findEndUserCredential(ctx: any, credential: EndUserCredentialInput) {
  assertConsultantPartnerSecret(credential.partnerSecret);
  const tokenHash = normalizedHash(credential.tokenHash);
  return await ctx.db
    .query("export_end_user_tokens")
    .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash))
    .unique();
}

async function getValidEndUserCredential(ctx: any, credential: EndUserCredentialInput) {
  const row = await findEndUserCredential(ctx, credential);
  if (!row || row.revoked || row.completedAt || row.expiresAt <= Date.now()) return null;
  return row;
}

async function insertEndUserToken(
  ctx: any,
  args: {
    assessmentId: Id<"export_assessments">;
    reviewTokenId?: Id<"export_review_tokens">;
    redemptionCodeHash: string;
    recipientEmail: string;
    notifyEmail?: string;
    senderNote?: string;
    createdBy: string;
  },
) {
  const recipientEmail = normalizedEmail(args.recipientEmail);
  const notifyEmail = optionalEmail(args.notifyEmail);
  const senderNote = optionalText(args.senderNote, 2_000);
  const redemptionCodeHash = normalizedHash(args.redemptionCodeHash);

  const duplicate = await ctx.db
    .query("export_end_user_tokens")
    .withIndex("by_redemption_code_hash", (q: any) =>
      q.eq("redemptionCodeHash", redemptionCodeHash),
    )
    .unique();
  if (duplicate) requestRejected();

  const assessment = await ctx.db.get(args.assessmentId);
  if (!assessment) throw userError("assessment_not_found", "Assessment not found");

  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const tokenId = await ctx.db.insert("export_end_user_tokens", {
    assessmentId: args.assessmentId,
    reviewTokenId: args.reviewTokenId,
    redemptionCodeHash,
    recipientEmail,
    notifyEmail,
    senderNote,
    expiresAt,
    createdBy: args.createdBy,
    createdAt: now,
  });

  await ctx.db.insert("auditLogs", {
    userId: args.createdBy,
    action: "end_user_dispatch_created",
    details: {
      assessmentId: args.assessmentId,
      tokenId,
      recipientEmail,
      reviewTokenId: args.reviewTokenId,
    },
    timestamp: now,
    archived: false,
  });

  const products = await ctx.db
    .query("export_products")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", args.assessmentId))
    .collect();
  const exportAssessment = assessment as Doc<"export_assessments">;

  return {
    tokenId,
    recipientEmail,
    expiresAt,
    emailContext: {
      reference: exportAssessment.reference,
      destinationCountry: exportAssessment.destinationCountry,
      productNames: products.map((product: { name: string }) => product.name),
    },
  };
}

/** Server-only consultant path, gated by the consultant's hashed cookie session. */
export const createEndUserDispatch = mutation({
  args: {
    reviewToken: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    partnerSecret: v.optional(v.string()),
    redemptionCodeHash: v.string(),
    recipientEmail: v.string(),
    senderNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const review = await getValidReviewToken(ctx, {
      token: args.reviewToken,
      tokenHash: args.tokenHash,
      partnerSecret: args.partnerSecret,
    });
    if (!review) throw userError("review_unavailable", "Review unavailable");

    return insertEndUserToken(ctx, {
      assessmentId: review.assessmentId,
      reviewTokenId: review._id,
      redemptionCodeHash: args.redemptionCodeHash,
      recipientEmail: args.recipientEmail,
      notifyEmail: review.consultantEmail,
      senderNote: args.senderNote,
      createdBy:
        review.consultantEmail ||
        (review.partnerSlug && review.consultantExternalId
          ? `${review.partnerSlug}:${review.consultantExternalId}`
          : "consultant"),
    });
  },
});

/** Authenticated assessment-owner path. */
export const createEndUserDispatchFromAssessment = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    redemptionCodeHash: v.string(),
    recipientEmail: v.string(),
    notifyEmail: v.optional(v.string()),
    senderNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw userError("assessment_not_found", "Assessment not found");
    await assertAssessmentAccess(ctx, identity.subject, assessment);
    await assertNoOpenConsultantDispatch(ctx, args.assessmentId);

    return insertEndUserToken(ctx, {
      assessmentId: args.assessmentId,
      redemptionCodeHash: args.redemptionCodeHash,
      recipientEmail: args.recipientEmail,
      notifyEmail:
        args.notifyEmail ??
        (typeof identity.email === "string" ? identity.email : undefined),
      senderNote: args.senderNote,
      createdBy: identity.subject,
    });
  },
});

/** Revoke a code that could not be delivered by email. */
export const revokeUndeliveredEndUserDispatch = mutation({
  args: {
    tokenId: v.id("export_end_user_tokens"),
    partnerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertConsultantPartnerSecret(args.partnerSecret);
    const row = await ctx.db.get(args.tokenId);
    if (!row || row.completedAt || row.redeemedAt) return;
    const now = Date.now();
    await ctx.db.patch(args.tokenId, {
      redemptionCodeHash: undefined,
      tokenHash: undefined,
      revoked: true,
      revokedAt: row.revokedAt ?? now,
    });
  },
});

/** Consume the email code once and bind a separate cookie-session hash. */
export const redeemEndUserCode = mutation({
  args: {
    codeHash: v.string(),
    tokenHash: v.string(),
    partnerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertConsultantPartnerSecret(args.partnerSecret);
    const codeHash = normalizedHash(args.codeHash);
    const tokenHash = normalizedHash(args.tokenHash);
    const row = await ctx.db
      .query("export_end_user_tokens")
      .withIndex("by_redemption_code_hash", (q) =>
        q.eq("redemptionCodeHash", codeHash),
      )
      .unique();
    const now = Date.now();
    if (
      !row ||
      row.revoked ||
      row.completedAt ||
      row.redeemedAt ||
      row.tokenHash ||
      row.expiresAt <= now
    ) {
      throw userError("review_unavailable", "Review unavailable");
    }

    const duplicateSession = await ctx.db
      .query("export_end_user_tokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (duplicateSession) requestRejected();

    await ctx.db.patch(row._id, {
      redemptionCodeHash: undefined,
      tokenHash,
      redeemedAt: now,
    });
    return { expiresAt: row.expiresAt };
  },
});

export const getEndUserDispatchStatus = query({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment || !(await canAccessAssessment(ctx, identity.subject, assessment))) {
      return null;
    }

    const tokens = await ctx.db
      .query("export_end_user_tokens")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const newestFirst = [...tokens].sort((a, b) => b.createdAt - a.createdAt);
    const active = newestFirst.find(
      (token) => !token.revoked && !token.completedAt && token.expiresAt > Date.now(),
    );
    const latest = newestFirst[0];
    const latestCompleted = newestFirst.find(
      (token) => token.completedAt != null && token.submittedStatement != null,
    );

    return {
      activeToken: active
        ? {
            _id: active._id,
            recipientEmail: active.recipientEmail,
            senderNote: active.senderNote,
            expiresAt: active.expiresAt,
            createdAt: active.createdAt,
            redeemedAt: active.redeemedAt,
            openedAt: active.openedAt,
            completedAt: active.completedAt,
          }
        : null,
      latestToken: latest
        ? {
            _id: latest._id,
            recipientEmail: latest.recipientEmail,
            senderNote: latest.senderNote,
            expiresAt: latest.expiresAt,
            createdAt: latest.createdAt,
            redeemedAt: latest.redeemedAt,
            openedAt: latest.openedAt,
            completedAt: latest.completedAt,
            notifiedAt: latest.notifiedAt,
            revoked: latest.revoked,
          }
        : null,
      statement:
        latestCompleted?.submittedStatement ??
        (assessment as Doc<"export_assessments">).endUserStatement ??
        null,
    };
  },
});

export const getEndUserForm = query({
  args: { tokenHash: v.string(), partnerSecret: v.string() },
  handler: async (ctx, args) => {
    const row = await getValidEndUserCredential(ctx, args);
    if (!row) return null;
    const assessment = await ctx.db.get(row.assessmentId);
    if (!assessment) return null;
    const exportAssessment = assessment as Doc<"export_assessments">;
    const products = await ctx.db
      .query("export_products")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", row.assessmentId))
      .collect();

    return {
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
      recipientEmail: row.recipientEmail,
      senderNote: row.senderNote,
      submittedStatement: row.submittedStatement,
      assessment: {
        reference: exportAssessment.reference,
        destinationCountry: exportAssessment.destinationCountry,
        consignee: exportAssessment.consignee,
        endUser: exportAssessment.endUser,
        intendedUse: exportAssessment.intendedUse,
      },
      products: products.map((product) => ({
        name: product.name,
        techDescription: product.techDescription,
        quantity: product.quantity,
      })),
    };
  },
});

const eusuDetailsValidator = v.object({
  roles: v.object({
    consignee: v.boolean(),
    endUser: v.boolean(),
    intermediateUser: v.boolean(),
    ultimateEndUser: v.boolean(),
    stockistNoOrders: v.boolean(),
    stockistConfirmed: v.boolean(),
  }),
  exporterName: v.optional(v.string()),
  exporterLicenceRef: v.optional(v.string()),
  items: v.optional(v.array(v.object({
    description: v.string(),
    quantity: v.optional(v.string()),
    unit: v.optional(v.string()),
  }))),
  consigneeName: v.optional(v.string()),
  consigneeAddress: v.optional(v.string()),
  endUserWebsite: v.optional(v.string()),
  armedForces: v.optional(v.boolean()),
  incorporation: v.optional(v.boolean()),
  soleUser: v.optional(v.boolean()),
  otherSupportingInfo: v.optional(v.string()),
  intermediateUserDetails: v.optional(v.string()),
  intermediateUse: v.optional(v.string()),
  newProductDescription: v.optional(v.string()),
  ultimateEndUserDetails: v.optional(v.string()),
  signatureSection: v.optional(v.union(v.literal("end_user"), v.literal("stockist"))),
  signedJobRole: v.optional(v.string()),
  stockistReExport: v.optional(v.union(v.literal("no_reexport"), v.literal("likely_exports"))),
  stockistLikelyExports: v.optional(v.string()),
});

type EusuDetailsInput = {
  roles: {
    consignee: boolean;
    endUser: boolean;
    intermediateUser: boolean;
    ultimateEndUser: boolean;
    stockistNoOrders: boolean;
    stockistConfirmed: boolean;
  };
  exporterName?: string;
  exporterLicenceRef?: string;
  items?: Array<{ description: string; quantity?: string; unit?: string }>;
  consigneeName?: string;
  consigneeAddress?: string;
  endUserWebsite?: string;
  armedForces?: boolean;
  incorporation?: boolean;
  soleUser?: boolean;
  otherSupportingInfo?: string;
  intermediateUserDetails?: string;
  intermediateUse?: string;
  newProductDescription?: string;
  ultimateEndUserDetails?: string;
  signatureSection?: "end_user" | "stockist";
  signedJobRole?: string;
  stockistReExport?: "no_reexport" | "likely_exports";
  stockistLikelyExports?: string;
};

function sanitizedEusu(input: EusuDetailsInput) {
  if (!Object.values(input.roles).some(Boolean)) requestRejected();
  if ((input.items?.length ?? 0) > 100) requestRejected();
  const items = input.items?.map((item) => ({
    description: requiredText(item.description, 2_000),
    quantity: optionalText(item.quantity, 100),
    unit: optionalText(item.unit, 100),
  }));
  const endUserWebsite = optionalText(input.endUserWebsite, 2_048);
  if (endUserWebsite) {
    try {
      const url = new URL(endUserWebsite);
      if (url.protocol !== "https:" && url.protocol !== "http:") requestRejected();
    } catch {
      requestRejected();
    }
  }

  return {
    roles: input.roles,
    exporterName: optionalText(input.exporterName, 300),
    exporterLicenceRef: optionalText(input.exporterLicenceRef, 160),
    items,
    consigneeName: optionalText(input.consigneeName, 300),
    consigneeAddress: optionalText(input.consigneeAddress, 2_000),
    endUserWebsite,
    armedForces: input.armedForces,
    incorporation: input.incorporation,
    soleUser: input.soleUser,
    otherSupportingInfo: optionalText(input.otherSupportingInfo, 5_000),
    intermediateUserDetails: optionalText(input.intermediateUserDetails, 5_000),
    intermediateUse: optionalText(input.intermediateUse, 5_000),
    newProductDescription: optionalText(input.newProductDescription, 5_000),
    ultimateEndUserDetails: optionalText(input.ultimateEndUserDetails, 5_000),
    signatureSection: input.signatureSection,
    signedJobRole: optionalText(input.signedJobRole, 300),
    stockistReExport: input.stockistReExport,
    stockistLikelyExports: optionalText(input.stockistLikelyExports, 5_000),
  };
}

export const submitEndUserStatement = mutation({
  args: {
    tokenHash: v.string(),
    partnerSecret: v.string(),
    endUserName: v.string(),
    endUserAddress: v.string(),
    endUserCountry: v.string(),
    contactName: v.string(),
    contactEmail: v.optional(v.string()),
    intendedUse: v.string(),
    noProhibitedEndUse: v.boolean(),
    noDiversion: v.boolean(),
    signedBy: v.string(),
    eusu: eusuDetailsValidator,
  },
  handler: async (ctx, args) => {
    const row = await getValidEndUserCredential(ctx, args);
    if (!row) throw userError("review_unavailable", "Review unavailable");
    if (!args.noProhibitedEndUse || !args.noDiversion) requestRejected();

    const endUserName = requiredText(args.endUserName, 300);
    const endUserAddress = optionalText(args.endUserAddress, 2_000) ?? "";
    const endUserCountry = optionalText(args.endUserCountry, 120) ?? "";
    const contactName = requiredText(args.contactName, 300);
    const contactEmail = optionalEmail(args.contactEmail);
    const intendedUse = requiredText(args.intendedUse, 5_000);
    const signedBy = requiredText(args.signedBy, 300);
    const eusu = sanitizedEusu(args.eusu);
    const now = Date.now();
    const statement = {
      endUserName,
      endUserAddress,
      endUserCountry,
      contactName,
      contactEmail,
      intendedUse,
      noProhibitedEndUse: true,
      noDiversion: true,
      signedBy,
      signedAt: now,
      tokenId: row._id,
      eusu,
    };

    await ctx.db.patch(row.assessmentId, {
      endUser: { name: endUserName, address: endUserAddress, country: endUserCountry },
      intendedUse,
      endUserStatement: statement,
      updatedAt: now,
    });
    await ctx.db.patch(row._id, {
      completedAt: now,
      revoked: true,
      revokedAt: now,
      redemptionCodeHash: undefined,
      submittedStatement: statement,
    });
    await ctx.db.insert("auditLogs", {
      userId: contactEmail || signedBy,
      action: "end_user_statement_submitted",
      details: {
        assessmentId: row.assessmentId,
        tokenId: row._id,
        endUserName,
        signedBy,
        endUserCountry: endUserCountry || undefined,
      },
      timestamp: now,
      archived: false,
    });
    return { assessmentId: row.assessmentId, statement };
  },
});

/** Resolve notification metadata after submission; the cookie session is the gate. */
export const getEusuNotifyTarget = query({
  args: { tokenHash: v.string(), partnerSecret: v.string() },
  handler: async (ctx, args) => {
    const row = await findEndUserCredential(ctx, args);
    if (!row || !row.completedAt || row.notifiedAt || !row.tokenHash || !row.notifyEmail) {
      return null;
    }
    const assessment = await ctx.db.get(row.assessmentId);
    if (!assessment) return null;
    const statement = row.submittedStatement as
      | { endUserName?: string; signedBy?: string }
      | undefined;
    return {
      notifyEmail: row.notifyEmail,
      reference: (assessment as Doc<"export_assessments">).reference,
      destinationCountry: (assessment as Doc<"export_assessments">).destinationCountry,
      endUserName: statement?.endUserName,
      signedBy: statement?.signedBy,
    };
  },
});

/** Record the notification outcome and destroy the remaining session hash. */
export const markEusuNotified = mutation({
  args: { tokenHash: v.string(), partnerSecret: v.string(), sent: v.boolean() },
  handler: async (ctx, args) => {
    const row = await findEndUserCredential(ctx, args);
    if (!row || !row.completedAt) return;
    const now = Date.now();
    await ctx.db.patch(row._id, {
      tokenHash: undefined,
      redemptionCodeHash: undefined,
      revoked: true,
      revokedAt: row.revokedAt ?? now,
      notifiedAt: args.sent ? row.notifiedAt ?? now : row.notifiedAt,
    });
  },
});

export const markEndUserTokenOpened = mutation({
  args: { tokenHash: v.string(), partnerSecret: v.string() },
  handler: async (ctx, args) => {
    const row = await getValidEndUserCredential(ctx, args);
    if (!row || row.openedAt) return;
    await ctx.db.patch(row._id, { openedAt: Date.now() });
  },
});

export const getLatestEndUserTokenForReview = query({
  args: {
    reviewToken: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    partnerSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const review = await getValidReviewToken(ctx, {
      token: args.reviewToken,
      tokenHash: args.tokenHash,
      partnerSecret: args.partnerSecret,
    });
    if (!review) return null;

    const tokens = await ctx.db
      .query("export_end_user_tokens")
      .withIndex("by_review_token", (q) => q.eq("reviewTokenId", review._id))
      .collect();
    const latest = tokens.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!latest) return null;
    return {
      _id: latest._id,
      assessmentId: latest.assessmentId,
      reviewTokenId: latest.reviewTokenId,
      recipientEmail: latest.recipientEmail,
      senderNote: latest.senderNote,
      expiresAt: latest.expiresAt,
      createdAt: latest.createdAt,
      redeemedAt: latest.redeemedAt,
      openedAt: latest.openedAt,
      completedAt: latest.completedAt,
      notifiedAt: latest.notifiedAt,
      revoked: latest.revoked,
      statement: latest.submittedStatement ?? null,
    };
  },
});
