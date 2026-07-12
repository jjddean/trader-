import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertAssessmentAccess, canAccessAssessment } from "./lib/org_access";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getValidReviewToken(ctx: any, reviewToken: string) {
  const row = await ctx.db
    .query("export_review_tokens")
    .withIndex("by_token", (q: any) => q.eq("token", reviewToken.trim()))
    .unique();
  if (!row || row.revoked || row.expiresAt < Date.now()) return null;
  return row;
}

async function getValidEndUserToken(ctx: any, token: string) {
  const row = await ctx.db
    .query("export_end_user_tokens")
    .withIndex("by_token", (q: any) => q.eq("token", token.trim()))
    .unique();
  if (!row || row.revoked || row.expiresAt < Date.now()) return null;
  return row;
}

async function insertEndUserToken(
  ctx: any,
  args: {
    assessmentId: Id<"export_assessments">;
    reviewTokenId?: Id<"export_review_tokens">;
    recipientEmail: string;
    senderNote?: string;
    createdBy: string;
  },
) {
  const email = args.recipientEmail.trim();
  if (!email) throw new Error("Recipient email required");

  const now = Date.now();
  const token = generateToken();
  const expiresAt = now + TOKEN_TTL_MS;
  const tokenId = await ctx.db.insert("export_end_user_tokens", {
    assessmentId: args.assessmentId,
    reviewTokenId: args.reviewTokenId,
    token,
    recipientEmail: email,
    senderNote: args.senderNote?.trim() || undefined,
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
      recipientEmail: email,
    },
    timestamp: now,
    archived: false,
  });

  return { token, recipientEmail: email, expiresAt };
}

/** Public path — secured by consultant review token. */
export const createEndUserDispatch = mutation({
  args: {
    reviewToken: v.string(),
    recipientEmail: v.string(),
    senderNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const review = await getValidReviewToken(ctx, args.reviewToken);
    if (!review) throw new Error("Review link expired or invalid");

    return insertEndUserToken(ctx, {
      assessmentId: review.assessmentId,
      reviewTokenId: review._id,
      recipientEmail: args.recipientEmail,
      senderNote: args.senderNote,
      createdBy: review.consultantEmail,
    });
  },
});

/** App path — authenticated assessment owner / org member. */
export const createEndUserDispatchFromAssessment = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    recipientEmail: v.string(),
    senderNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw new Error("Assessment not found");
    await assertAssessmentAccess(ctx, identity.subject, assessment);

    return insertEndUserToken(ctx, {
      assessmentId: args.assessmentId,
      recipientEmail: args.recipientEmail,
      senderNote: args.senderNote,
      createdBy: identity.subject,
    });
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

    const active = tokens
      .filter((t) => !t.revoked && !t.completedAt && t.expiresAt > Date.now())
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    const latest = tokens
      .filter((t) => !t.revoked)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    return {
      activeToken: active ?? null,
      latestToken: latest ?? null,
      statement: (assessment as Doc<"export_assessments">).endUserStatement ?? null,
    };
  },
});

export const getEndUserFormByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await getValidEndUserToken(ctx, args.token);
    if (!row) return null;

    const assessment = await ctx.db.get(row.assessmentId);
    if (!assessment) return null;
    const exportAssessment = assessment as Doc<"export_assessments">;

    const products = await ctx.db
      .query("export_products")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", row.assessmentId))
      .collect();

    return {
      token: row.token,
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
      recipientEmail: row.recipientEmail,
      senderNote: row.senderNote,
      assessment: {
        reference: exportAssessment.reference,
        destinationCountry: exportAssessment.destinationCountry,
        consignee: exportAssessment.consignee,
        endUser: exportAssessment.endUser,
        intendedUse: exportAssessment.intendedUse,
        endUserStatement: exportAssessment.endUserStatement,
      },
      products: products.map((p) => ({
        name: p.name,
        techDescription: p.techDescription,
        quantity: p.quantity,
      })),
    };
  },
});

export const submitEndUserStatement = mutation({
  args: {
    token: v.string(),
    endUserName: v.string(),
    endUserAddress: v.string(),
    endUserCountry: v.string(),
    contactName: v.string(),
    contactEmail: v.optional(v.string()),
    intendedUse: v.string(),
    noProhibitedEndUse: v.boolean(),
    noDiversion: v.boolean(),
    signedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await getValidEndUserToken(ctx, args.token);
    if (!row) throw new Error("Link expired or invalid");
    if (row.completedAt) throw new Error("This form was already submitted");

    const endUserName = args.endUserName.trim();
    const intendedUse = args.intendedUse.trim();
    const signedBy = args.signedBy.trim();
    if (!endUserName || !intendedUse || !signedBy) {
      throw new Error("End user name, intended use, and signature are required");
    }
    if (!args.noProhibitedEndUse || !args.noDiversion) {
      throw new Error("Both undertakings must be confirmed");
    }

    const now = Date.now();
    const statement = {
      endUserName,
      endUserAddress: args.endUserAddress.trim(),
      endUserCountry: args.endUserCountry.trim(),
      contactName: args.contactName.trim(),
      contactEmail: args.contactEmail?.trim() || undefined,
      intendedUse,
      noProhibitedEndUse: true,
      noDiversion: true,
      signedBy,
      signedAt: now,
      tokenId: row._id,
    };

    await ctx.db.patch(row.assessmentId, {
      endUser: {
        name: endUserName,
        address: args.endUserAddress.trim(),
        country: args.endUserCountry.trim(),
      },
      intendedUse,
      endUserStatement: statement,
      updatedAt: now,
    });

    await ctx.db.patch(row._id, { completedAt: now });

    await ctx.db.insert("auditLogs", {
      userId: args.contactEmail?.trim() || signedBy,
      action: "end_user_statement_submitted",
      details: {
        assessmentId: row.assessmentId,
        tokenId: row._id,
      },
      timestamp: now,
      archived: false,
    });

    return { assessmentId: row.assessmentId };
  },
});

export const markEndUserTokenOpened = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await getValidEndUserToken(ctx, args.token);
    if (!row || row.openedAt) return;
    await ctx.db.patch(row._id, { openedAt: Date.now() });
  },
});

export const getLatestEndUserTokenForReview = query({
  args: { reviewToken: v.string() },
  handler: async (ctx, args) => {
    const review = await getValidReviewToken(ctx, args.reviewToken);
    if (!review) return null;

    const tokens = await ctx.db
      .query("export_end_user_tokens")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", review.assessmentId))
      .collect();

    return (
      tokens
        .filter((t) => !t.revoked)
        .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
    );
  },
});
