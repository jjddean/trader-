import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  assertAssessmentAccess,
  canAccessAssessment,
  canAccessDeclaration,
  listAssessmentsForTenant,
  resolveOrgIdForNewRecord,
} from "./lib/org_access";

function buildReference(now = Date.now()) {
  const year = new Date(now).getFullYear();
  const suffix = Math.floor(Math.random() * 90000 + 10000);
  return `EC-${year}-${suffix}`;
}

async function getAssessmentOrThrow(ctx: any, userId: string, assessmentId: Id<"export_assessments">) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) throw new Error("Assessment not found");
  await assertAssessmentAccess(ctx, userId, assessment);
  return assessment;
}

async function logExportAction(
  ctx: any,
  userId: string,
  action: string,
  assessmentId: Id<"export_assessments">,
  metadata?: Record<string, unknown>,
) {
  try {
    await ctx.db.insert("auditLogs", {
      userId,
      action,
      details: { assessmentId, ...metadata },
      timestamp: Date.now(),
      archived: false,
    });
  } catch {
    // Non-fatal
  }
}

export const listAssessments = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await listAssessmentsForTenant(ctx, identity.subject);
  },
});

export const getAssessment = query({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) return null;
    if (!(await canAccessAssessment(ctx, identity.subject, assessment))) {
      throw new Error("Unauthorized");
    }

    const products = await ctx.db
      .query("export_products")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const productsWithSpecs = await Promise.all(
      products.map(async (product) => {
        const specs = await ctx.db
          .query("export_product_specs")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .collect();
        return { ...product, specs };
      }),
    );

    const screenings = await ctx.db
      .query("sanctions_screenings")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const expertRequests = await ctx.db
      .query("expert_requests")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const licences = await ctx.db
      .query("export_licences")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const classificationRuns = await ctx.db
      .query("export_classification_runs")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const runsByProduct = new Map<string, typeof classificationRuns>();
    for (const run of classificationRuns.sort((a, b) => b.createdAt - a.createdAt)) {
      const key = run.productId as string;
      if (!runsByProduct.has(key)) runsByProduct.set(key, []);
      runsByProduct.get(key)!.push(run);
    }

    return {
      assessment,
      products: productsWithSpecs.map((product) => ({
        ...product,
        classificationRuns: runsByProduct.get(product._id as string) ?? [],
      })),
      screenings,
      expertRequests,
      licences,
      classificationRuns,
    };
  },
});

export const getProductForClassification = query({
  args: { productId: v.id("export_products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    await getAssessmentOrThrow(ctx, identity.subject, product.assessmentId);

    const specs = await ctx.db
      .query("export_product_specs")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    return { ...product, specs };
  },
});

export const createAssessment = mutation({
  args: {
    declarationId: v.optional(v.id("declarations")),
    destinationCountry: v.optional(v.string()),
    originJurisdiction: v.optional(v.union(v.literal("GB"), v.literal("NI"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw new Error("Unauthorized");
      }
    }

    const now = Date.now();
    const orgId = await resolveOrgIdForNewRecord(ctx, identity.subject);

    const assessmentId = await ctx.db.insert("export_assessments", {
      userId: identity.subject,
      orgId,
      declarationId: args.declarationId,
      reference: buildReference(now),
      status: "draft",
      originJurisdiction: args.originJurisdiction,
      destinationCountry: args.destinationCountry,
      createdAt: now,
      updatedAt: now,
    });

    await logExportAction(ctx, identity.subject, "export_assessment_created", assessmentId);
    return assessmentId;
  },
});

export const updateAssessment = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("clear"),
        v.literal("flagged"),
        v.literal("review_required"),
      ),
    ),
    originJurisdiction: v.optional(v.union(v.literal("GB"), v.literal("NI"))),
    destinationCountry: v.optional(v.string()),
    consignee: v.optional(v.any()),
    endUser: v.optional(v.any()),
    intendedUse: v.optional(v.string()),
    submissionRoute: v.optional(
      v.union(v.literal("lite"), v.literal("spire"), v.literal("otsi"), v.literal("none")),
    ),
    controlListVersion: v.optional(v.string()),
    sanctionsVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assessment = await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);
    const { assessmentId, ...patch } = args;

    await ctx.db.patch(assessmentId, {
      ...patch,
      updatedAt: Date.now(),
    });

    await logExportAction(ctx, identity.subject, "export_assessment_updated", assessmentId, {
      fields: Object.keys(patch),
      priorStatus: assessment.status,
    });
    return assessmentId;
  },
});

export const addProduct = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    name: v.string(),
    manufacturer: v.optional(v.string()),
    modelNo: v.optional(v.string()),
    partNo: v.optional(v.string()),
    quantity: v.optional(v.number()),
    valueGbp: v.optional(v.number()),
    techDescription: v.optional(v.string()),
    sourceDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);
    const now = Date.now();

    return await ctx.db.insert("export_products", {
      assessmentId: args.assessmentId,
      name: args.name,
      manufacturer: args.manufacturer,
      modelNo: args.modelNo,
      partNo: args.partNo,
      quantity: args.quantity,
      valueGbp: args.valueGbp,
      techDescription: args.techDescription,
      sourceDocumentId: args.sourceDocumentId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addProductSpec = mutation({
  args: {
    productId: v.id("export_products"),
    key: v.string(),
    valueRaw: v.string(),
    valueNum: v.optional(v.number()),
    unit: v.optional(v.string()),
    sourceDocId: v.optional(v.id("documents")),
    sourcePage: v.optional(v.number()),
    sourceQuote: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    await getAssessmentOrThrow(ctx, identity.subject, product.assessmentId);

    return await ctx.db.insert("export_product_specs", {
      productId: args.productId,
      key: args.key,
      valueRaw: args.valueRaw,
      valueNum: args.valueNum,
      unit: args.unit,
      sourceDocId: args.sourceDocId,
      sourcePage: args.sourcePage,
      sourceQuote: args.sourceQuote,
      confidence: args.confidence,
      createdAt: Date.now(),
    });
  },
});

/** Append-only — classification runs are never updated or deleted. */
export const recordClassificationRun = mutation({
  args: {
    productId: v.id("export_products"),
    candidates: v.optional(v.any()),
    finalControlEntry: v.optional(v.string()),
    confidence: v.optional(v.number()),
    requiresReview: v.boolean(),
    controlListVersion: v.optional(v.string()),
    sanctionsVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    modelVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    await getAssessmentOrThrow(ctx, identity.subject, product.assessmentId);

    return await ctx.db.insert("export_classification_runs", {
      productId: args.productId,
      assessmentId: product.assessmentId,
      candidates: args.candidates,
      finalControlEntry: args.finalControlEntry,
      confidence: args.confidence,
      requiresReview: args.requiresReview,
      controlListVersion: args.controlListVersion,
      sanctionsVersion: args.sanctionsVersion,
      promptVersion: args.promptVersion,
      modelVersion: args.modelVersion,
      createdAt: Date.now(),
    });
  },
});

/** Human reviewer records decision on a classification run. */
export const reviewClassificationRun = mutation({
  args: {
    runId: v.id("export_classification_runs"),
    finalControlEntry: v.optional(v.string()),
    approved: v.boolean(),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Classification run not found");
    await getAssessmentOrThrow(ctx, identity.subject, run.assessmentId);

    await ctx.db.patch(args.runId, {
      finalControlEntry: args.approved ? args.finalControlEntry : undefined,
      requiresReview: !args.approved,
    });

    await logExportAction(ctx, identity.subject, "classification_run_reviewed", run.assessmentId, {
      runId: args.runId,
      approved: args.approved,
      finalControlEntry: args.finalControlEntry,
      reviewNote: args.reviewNote,
    });

    return args.runId;
  },
});

export const recordSanctionsScreening = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    subjectType: v.union(
      v.literal("exporter"),
      v.literal("consignee"),
      v.literal("end_user"),
      v.literal("intermediary"),
      v.literal("vessel"),
    ),
    subjectName: v.string(),
    matchedUniqueId: v.optional(v.string()),
    score: v.optional(v.number()),
    matchReason: v.optional(v.string()),
    scoreBreakdown: v.optional(v.any()),
    sanctionsVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);

    return await ctx.db.insert("sanctions_screenings", {
      assessmentId: args.assessmentId,
      subjectType: args.subjectType,
      subjectName: args.subjectName,
      matchedUniqueId: args.matchedUniqueId,
      score: args.score,
      matchReason: args.matchReason,
      scoreBreakdown: args.scoreBreakdown,
      sanctionsVersion: args.sanctionsVersion,
      reviewStatus: "pending",
      createdAt: Date.now(),
    });
  },
});

export const reviewSanctionsScreening = mutation({
  args: {
    screeningId: v.id("sanctions_screenings"),
    reviewStatus: v.union(v.literal("confirmed"), v.literal("dismissed")),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const screening = await ctx.db.get(args.screeningId);
    if (!screening) throw new Error("Screening not found");
    await getAssessmentOrThrow(ctx, identity.subject, screening.assessmentId);

    await ctx.db.patch(args.screeningId, {
      reviewStatus: args.reviewStatus,
      reviewedBy: identity.subject,
      reviewNote: args.reviewNote,
    });

    await logExportAction(ctx, identity.subject, "sanctions_screening_reviewed", screening.assessmentId, {
      screeningId: args.screeningId,
      reviewStatus: args.reviewStatus,
    });
  },
});

export const createExpertRequest = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    reasonCode: v.string(),
    slaDueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assessment = await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);
    const now = Date.now();

    const detail = await ctx.db
      .query("export_products")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const requestId = await ctx.db.insert("expert_requests", {
      assessmentId: args.assessmentId,
      requestedBy: identity.subject,
      reasonCode: args.reasonCode,
      slaDueAt: args.slaDueAt,
      status: "pending",
      assessmentSnapshot: { assessment, productCount: detail.length, frozenAt: now },
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.assessmentId, {
      status: "review_required",
      updatedAt: now,
    });

    await logExportAction(ctx, identity.subject, "expert_request_created", args.assessmentId, {
      requestId,
      reasonCode: args.reasonCode,
    });
    return requestId;
  },
});

export const recordExportLicence = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    licenceType: v.union(v.literal("siel"), v.literal("f680"), v.literal("other")),
    applicationRef: v.optional(v.string()),
    licenceRef: v.optional(v.string()),
    route: v.optional(
      v.union(v.literal("lite"), v.literal("spire"), v.literal("otsi"), v.literal("none")),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);

    const licenceId = await ctx.db.insert("export_licences", {
      assessmentId: args.assessmentId,
      licenceType: args.licenceType,
      applicationRef: args.applicationRef,
      licenceRef: args.licenceRef,
      route: args.route,
      recordedBy: identity.subject,
      recordedAt: Date.now(),
    });

    await logExportAction(ctx, identity.subject, "export_licence_recorded", args.assessmentId, {
      licenceId,
      licenceType: args.licenceType,
    });
    return licenceId;
  },
});

const productSpecValidator = v.object({
  key: v.string(),
  valueRaw: v.string(),
  valueNum: v.optional(v.number()),
  unit: v.optional(v.string()),
  sourcePage: v.optional(v.number()),
  sourceQuote: v.optional(v.string()),
  confidence: v.optional(v.number()),
});

const productValidator = v.object({
  name: v.string(),
  manufacturer: v.optional(v.string()),
  modelNo: v.optional(v.string()),
  partNo: v.optional(v.string()),
  quantity: v.optional(v.number()),
  valueGbp: v.optional(v.number()),
  techDescription: v.optional(v.string()),
  specs: v.optional(v.array(productSpecValidator)),
});

/** Persist export-facts extraction batch onto an assessment. */
export const persistExtraction = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    destinationCountry: v.optional(v.string()),
    consignee: v.optional(v.any()),
    endUser: v.optional(v.any()),
    intendedUse: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    products: v.array(productValidator),
    sourceDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);
    const now = Date.now();

    await ctx.db.patch(args.assessmentId, {
      destinationCountry: args.destinationCountry,
      consignee: args.consignee,
      endUser: args.endUser,
      intendedUse: args.intendedUse,
      promptVersion: args.promptVersion,
      updatedAt: now,
    });

    const productIds: Id<"export_products">[] = [];
    for (const product of args.products) {
      const productId = await ctx.db.insert("export_products", {
        assessmentId: args.assessmentId,
        name: product.name,
        manufacturer: product.manufacturer,
        modelNo: product.modelNo,
        partNo: product.partNo,
        quantity: product.quantity,
        valueGbp: product.valueGbp,
        techDescription: product.techDescription,
        sourceDocumentId: args.sourceDocumentId,
        createdAt: now,
        updatedAt: now,
      });
      productIds.push(productId);

      for (const spec of product.specs ?? []) {
        await ctx.db.insert("export_product_specs", {
          productId,
          key: spec.key,
          valueRaw: spec.valueRaw,
          valueNum: spec.valueNum,
          unit: spec.unit,
          sourceDocId: args.sourceDocumentId,
          sourcePage: spec.sourcePage,
          sourceQuote: spec.sourceQuote,
          confidence: spec.confidence,
          createdAt: now,
        });
      }
    }

    await logExportAction(ctx, identity.subject, "export_extraction_persisted", args.assessmentId, {
      productCount: productIds.length,
    });

    return { productIds };
  },
});
