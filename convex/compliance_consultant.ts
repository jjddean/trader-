import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAssessmentAccess, canAccessAssessment } from "./lib/org_access";
import { collectEvidenceWithUrls } from "./export_controls";

const CONSULTANT_ROLE = v.union(
  v.literal("adviser"),
  v.literal("applies_on_behalf"),
  v.literal("eor"),
);

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function generateReviewToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readOrgId(identity: Record<string, unknown>): string {
  const raw = identity.org_id ?? identity.orgId;
  return typeof raw === "string" ? raw.trim() : "";
}

async function loadAssessmentDetail(ctx: any, assessmentId: Id<"export_assessments">) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) return null;

  const products = await ctx.db
    .query("export_products")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  const productsWithSpecs = await Promise.all(
    products.map(async (product: { _id: Id<"export_products"> }) => {
      const specs = await ctx.db
        .query("export_product_specs")
        .withIndex("by_product", (q: any) => q.eq("productId", product._id))
        .collect();
      const runs = await ctx.db
        .query("export_classification_runs")
        .withIndex("by_product", (q: any) => q.eq("productId", product._id))
        .collect();
      return {
        ...product,
        specs,
        classificationRuns: runs.sort(
          (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt,
        ),
      };
    }),
  );

  const screenings = await ctx.db
    .query("sanctions_screenings")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  const licences = await ctx.db
    .query("export_licences")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  const expertRequests = await ctx.db
    .query("expert_requests")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  const evidence = await collectEvidenceWithUrls(ctx, assessmentId);

  return {
    assessment,
    products: productsWithSpecs,
    screenings,
    licences,
    evidence,
    expertRequests: expertRequests.sort(
      (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt,
    ),
  };
}

export const getConsultantDispatchStatus = query({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment || !(await canAccessAssessment(ctx, identity.subject, assessment))) {
      return null;
    }

    const tokens = await ctx.db
      .query("export_review_tokens")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const active = tokens
      .filter((t) => !t.revoked && !t.completedAt && t.expiresAt > Date.now())
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    const latestRequest = (
      await ctx.db
        .query("expert_requests")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
        .collect()
    ).sort((a, b) => b.createdAt - a.createdAt)[0];

    return { activeToken: active ?? null, latestRequest: latestRequest ?? null };
  },
});

export const createConsultantDispatch = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    consultantEmail: v.string(),
    senderNote: v.optional(v.string()),
    consultantName: v.optional(v.string()),
    consultantRole: v.optional(CONSULTANT_ROLE),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw new Error("Assessment not found");
    await assertAssessmentAccess(ctx, identity.subject, assessment);

    const orgId = assessment.orgId ?? readOrgId(identity as Record<string, unknown>);
    const consultantEmail = args.consultantEmail.trim();
    const consultantName = args.consultantName?.trim();
    const consultantRole = args.consultantRole ?? "applies_on_behalf";

    if (!consultantEmail) {
      throw new Error("Consultant email is required");
    }

    const now = Date.now();
    const detail = await loadAssessmentDetail(ctx, args.assessmentId);

    const expertRequestId = await ctx.db.insert("expert_requests", {
      assessmentId: args.assessmentId,
      requestedBy: identity.subject,
      reasonCode: "consultant_dispatch",
      status: "sent",
      assessmentSnapshot: { frozenAt: now, reference: assessment.reference },
      consultantEmail,
      consultantName,
      createdAt: now,
      updatedAt: now,
    });

    const token = generateReviewToken();
    const tokenId = await ctx.db.insert("export_review_tokens", {
      assessmentId: args.assessmentId,
      expertRequestId,
      orgId: orgId || undefined,
      token,
      consultantEmail,
      consultantName,
      consultantRole: consultantRole ?? "applies_on_behalf",
      senderNote: args.senderNote?.trim() || undefined,
      expiresAt: now + TOKEN_TTL_MS,
      createdBy: identity.subject,
      createdAt: now,
    });

    if (assessment.status === "draft") {
      await ctx.db.patch(args.assessmentId, { status: "review_required", updatedAt: now });
    }

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "consultant_dispatch_created",
      details: {
        assessmentId: args.assessmentId,
        tokenId,
        consultantEmail,
        productCount: detail?.products.length ?? 0,
      },
      timestamp: now,
      archived: false,
    });

    return { token, expertRequestId, consultantEmail, consultantName, consultantRole };
  },
});

/** Public — secured by unguessable token only. */
export const getReviewByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("export_review_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .unique();

    if (!row || row.revoked || row.expiresAt < Date.now()) return null;

    const detail = await loadAssessmentDetail(ctx, row.assessmentId);
    if (!detail) return null;

    return {
      token: row.token,
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
      consultantEmail: row.consultantEmail,
      consultantName: row.consultantName,
      consultantRole: row.consultantRole ?? "applies_on_behalf",
      senderNote: row.senderNote,
      ...detail,
    };
  },
});

/** Public — secured by token. */
export const completeConsultantReview = mutation({
  args: {
    token: v.string(),
    advisoryNotes: v.string(),
    outcome: v.union(v.literal("cleared"), v.literal("blocked")),
    applicationRef: v.optional(v.string()),
    licenceRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("export_review_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .unique();

    if (!row || row.revoked || row.expiresAt < Date.now()) {
      throw new Error("Link expired or invalid");
    }
    if (row.completedAt) {
      throw new Error("This review was already completed");
    }

    const notes = args.advisoryNotes.trim();
    if (!notes) throw new Error("Advisory notes are required");

    const now = Date.now();
    const assessment = await ctx.db.get(row.assessmentId);
    if (!assessment) throw new Error("Assessment not found");

    await ctx.db.patch(row.expertRequestId, {
      status: args.outcome === "cleared" ? "completed" : "blocked",
      advisoryNotes: notes,
      outcome: args.outcome,
      applicationRef: args.applicationRef?.trim() || undefined,
      licenceRef: args.licenceRef?.trim() || undefined,
      completedAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(row.assessmentId, {
      status: args.outcome === "cleared" ? "clear" : "flagged",
      updatedAt: now,
    });

    if (args.applicationRef?.trim() || args.licenceRef?.trim()) {
      await ctx.db.insert("export_licences", {
        assessmentId: row.assessmentId,
        licenceType: "siel",
        applicationRef: args.applicationRef?.trim() || undefined,
        licenceRef: args.licenceRef?.trim() || undefined,
        route: assessment.submissionRoute,
        recordedBy: row.consultantEmail,
        recordedAt: now,
      });
    }

    await ctx.db.patch(row._id, { completedAt: now });

    await ctx.db.insert("auditLogs", {
      userId: row.consultantEmail,
      action: "consultant_review_completed",
      details: {
        assessmentId: row.assessmentId,
        outcome: args.outcome,
        tokenId: row._id,
      },
      timestamp: now,
      archived: false,
    });

    return { assessmentId: row.assessmentId, outcome: args.outcome };
  },
});

export const markReviewTokenOpened = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("export_review_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .unique();
    if (!row || row.openedAt) return;
    await ctx.db.patch(row._id, { openedAt: Date.now() });
  },
});
