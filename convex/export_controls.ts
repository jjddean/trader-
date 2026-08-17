import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  assertAssessmentAccess,
  canAccessAssessment,
  canAccessDeclaration,
  listAssessmentsForTenant,
  resolveOrgIdForNewRecord,
} from "./lib/org_access";
import { resolveSubmissionRoute } from "./lib/export_routing";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

function buildReference(now = Date.now()) {
  const year = new Date(now).getFullYear();
  const suffix = Math.floor(Math.random() * 90000 + 10000);
  return `EC-${year}-${suffix}`;
}

async function getAssessmentOrThrow(ctx: any, userId: string, assessmentId: Id<"export_assessments">) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) throw userError("assessment_not_found", "Assessment not found");
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

async function collectApprovedControlEntries(ctx: any, assessmentId: Id<"export_assessments">) {
  const products = await ctx.db
    .query("export_products")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  const entries: string[] = [];
  for (const product of products) {
    const runs = await ctx.db
      .query("export_classification_runs")
      .withIndex("by_product", (q: any) => q.eq("productId", product._id))
      .collect();
    const latest = runs.sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)[0];
    if (latest && latest.requiresReview === false) {
      entries.push(latest.finalControlEntry ?? "");
    }
  }
  return entries;
}

async function refreshSubmissionRouteForAssessment(ctx: any, assessmentId: Id<"export_assessments">) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) return null;

  const approvedControlEntries = await collectApprovedControlEntries(ctx, assessmentId);
  const routing = resolveSubmissionRoute({
    originJurisdiction: assessment.originJurisdiction,
    destinationCountry: assessment.destinationCountry,
    approvedControlEntries,
  });

  const patch: Record<string, unknown> = {
    submissionRoute: routing.route,
    updatedAt: Date.now(),
  };

  if (routing.niReviewRequired && assessment.status === "clear") {
    patch.status = "review_required";
  }

  await ctx.db.patch(assessmentId, patch);
  return routing;
}

/** Evidence rows with a resolved download URL + file metadata for the DBT bundle. */
export async function collectEvidenceWithUrls(ctx: any, assessmentId: Id<"export_assessments">) {
  const rows = await ctx.db
    .query("export_evidence")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  return await Promise.all(
    rows
      .sort((a: Doc<"export_evidence">, b: Doc<"export_evidence">) => b.addedAt - a.addedAt)
      .map(async (row: Doc<"export_evidence">) => {
        let fileName: string | undefined;
        let fileSize: number | undefined;
        let downloadUrl: string | undefined;

        if (row.documentId) {
          const document = await ctx.db.get(row.documentId);
          if (document) {
            fileName = typeof document.fileName === "string" ? document.fileName : undefined;
            fileSize = document.fileSize;
            if (document.fileId) {
              downloadUrl = (await ctx.storage.getUrl(document.fileId)) ?? undefined;
            }
          }
        }

        return {
          _id: row._id,
          kind: row.kind,
          label: row.label,
          note: row.note,
          url: row.url,
          productId: row.productId,
          addedAt: row.addedAt,
          fileName,
          fileSize,
          downloadUrl,
        };
      }),
  );
}

export const addExportEvidence = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    kind: v.union(
      v.literal("technical_description"),
      v.literal("datasheet"),
      v.literal("brochure"),
      v.literal("web_page"),
      v.literal("commercial_invoice"),
      v.literal("eusu_signed"),
      v.literal("other"),
    ),
    label: v.string(),
    documentId: v.optional(v.id("documents")),
    url: v.optional(v.string()),
    note: v.optional(v.string()),
    productId: v.optional(v.id("export_products")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const assessment = await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);

    const label = args.label.trim();
    if (!label) throw userError("label_is_required", "Label is required");

    const url = args.url?.trim() || undefined;
    if (!args.documentId && !url) {
      throw userError("attach_an_uploaded_document_or_provide", "Attach an uploaded document or provide a web page URL");
    }
    if (url && !/^https?:\/\//i.test(url)) {
      throw userError("url_must_start_with_http_or", "URL must start with http:// or https://");
    }

    const evidenceId = await ctx.db.insert("export_evidence", {
      assessmentId: args.assessmentId,
      orgId: assessment.orgId,
      kind: args.kind,
      label,
      documentId: args.documentId,
      url,
      note: args.note?.trim() || undefined,
      productId: args.productId,
      addedBy: identity.subject,
      addedAt: Date.now(),
    });

    await logExportAction(ctx, identity.subject, "export_evidence_added", args.assessmentId, {
      evidenceId,
      kind: args.kind,
    });
    return evidenceId;
  },
});

export const removeExportEvidence = mutation({
  args: { evidenceId: v.id("export_evidence") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const row = await ctx.db.get(args.evidenceId);
    if (!row) throw userError("evidence_not_found", "Evidence not found");
    await getAssessmentOrThrow(ctx, identity.subject, row.assessmentId);

    await ctx.db.delete(args.evidenceId);
    await logExportAction(ctx, identity.subject, "export_evidence_removed", row.assessmentId, {
      evidenceId: args.evidenceId,
    });
  },
});

/** Documents the user can attach as evidence (org / user scoped). */
export const listAttachableDocuments = query({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment || !(await canAccessAssessment(ctx, identity.subject, assessment))) return [];

    const byOrg = assessment.orgId
      ? await ctx.db
          .query("documents")
          .withIndex("by_org", (q) => q.eq("orgId", assessment.orgId))
          .collect()
      : [];
    const byUser = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const seen = new Set<string>();
    return [...byOrg, ...byUser]
      .filter((doc) => {
        const key = doc._id as string;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .slice(0, 50)
      .map((doc) => ({
        _id: doc._id,
        fileName: typeof doc.fileName === "string" ? doc.fileName : "Untitled document",
        fileType: typeof doc.fileType === "string" ? doc.fileType : undefined,
        fileSize: doc.fileSize,
      }));
  },
});

export const listAssessments = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    return await listAssessmentsForTenant(ctx, identity.subject);
  },
});

export const getAssessment = query({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) return null;
    if (!(await canAccessAssessment(ctx, identity.subject, assessment))) {
      throw forbiddenError();
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

    const evidence = await collectEvidenceWithUrls(ctx, args.assessmentId);

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
      evidence,
    };
  },
});

/**
 * Full audit trail for one assessment, including actions taken by third parties
 * (consultant sign-off, end-user EUSU submission) which are logged under their
 * own userId rather than the assessment owner's.
 */
export const getAssessmentAuditLogs = query({
  args: {
    assessmentId: v.id("export_assessments"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) return [];
    if (!(await canAccessAssessment(ctx, identity.subject, assessment))) {
      throw forbiddenError();
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_details_assessment", (q) =>
        q.eq("details.assessmentId", args.assessmentId),
      )
      .order("desc")
      .take(args.limit ?? 200);

    return logs.map((log) => ({
      _id: log._id,
      action: typeof log.action === "string" ? log.action : "unknown",
      actor: typeof log.userId === "string" ? log.userId : undefined,
      timestamp: typeof log.timestamp === "number" ? log.timestamp : log._creationTime,
      details:
        log.details && typeof log.details === "object" && !Array.isArray(log.details)
          ? (log.details as Record<string, unknown>)
          : {},
    }));
  },
});

export const getProductForClassification = query({
  args: { productId: v.id("export_products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

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
    if (!identity) throw unauthenticatedError();

    let clientId: Id<"clients"> | undefined;
    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw forbiddenError();
      }
      if (declaration.clientId) clientId = declaration.clientId;
    }

    const now = Date.now();
    const orgId = await resolveOrgIdForNewRecord(ctx, identity.subject);

    const assessmentId = await ctx.db.insert("export_assessments", {
      userId: identity.subject,
      orgId,
      declarationId: args.declarationId,
      clientId,
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
    clientId: v.optional(v.id("clients")),
    declarationId: v.optional(v.id("declarations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const assessment = await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);
    const { assessmentId, ...patch } = args;

    // If linking a declaration, inherit its clientId when not explicitly set.
    if (patch.declarationId && patch.clientId === undefined) {
      const declaration = await ctx.db.get(patch.declarationId);
      if (declaration?.clientId) patch.clientId = declaration.clientId;
    }

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
    if (!identity) throw unauthenticatedError();

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
    if (!identity) throw unauthenticatedError();

    const product = await ctx.db.get(args.productId);
    if (!product) throw userError("product_not_found", "Product not found");
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
    if (!identity) throw unauthenticatedError();

    const product = await ctx.db.get(args.productId);
    if (!product) throw userError("product_not_found", "Product not found");
    await getAssessmentOrThrow(ctx, identity.subject, product.assessmentId);

    const runId = await ctx.db.insert("export_classification_runs", {
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

    await refreshSubmissionRouteForAssessment(ctx, product.assessmentId);

    return runId;
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
    if (!identity) throw unauthenticatedError();

    const run = await ctx.db.get(args.runId);
    if (!run) throw userError("classification_run_not_found", "Classification run not found");
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

    await refreshSubmissionRouteForAssessment(ctx, run.assessmentId);

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
    if (!identity) throw unauthenticatedError();

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
    if (!identity) throw unauthenticatedError();

    const screening = await ctx.db.get(args.screeningId);
    if (!screening) throw userError("screening_not_found", "Screening not found");
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
    if (!identity) throw unauthenticatedError();

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
    licenceType: v.union(
      v.literal("siel"),
      v.literal("sitcl"),
      v.literal("sitl"),
      v.literal("f680"),
      v.literal("oiel"),
      v.literal("oitcl"),
      v.literal("ogel"),
      v.literal("otsi"),
      v.literal("other"),
    ),
    applicationRef: v.optional(v.string()),
    licenceRef: v.optional(v.string()),
    route: v.optional(
      v.union(v.literal("lite"), v.literal("spire"), v.literal("otsi"), v.literal("none")),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

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
    if (!identity) throw unauthenticatedError();

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

    const existingProducts = await ctx.db
      .query("export_products")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const existingByKey = new Map<string, Doc<"export_products">>();
    for (const product of existingProducts) {
      const key = `${String(product.sourceDocumentId ?? "")}::${product.name.toLowerCase()}`;
      existingByKey.set(key, product);
    }

    const productIds: Id<"export_products">[] = [];
    for (const product of args.products) {
      const key = `${String(args.sourceDocumentId ?? "")}::${product.name.toLowerCase()}`;
      const existing = args.sourceDocumentId ? existingByKey.get(key) : undefined;

      const productId = existing
        ? existing._id
        : await ctx.db.insert("export_products", {
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
      if (existing) {
        await ctx.db.patch(productId, {
          manufacturer: product.manufacturer,
          modelNo: product.modelNo,
          partNo: product.partNo,
          quantity: product.quantity,
          valueGbp: product.valueGbp,
          techDescription: product.techDescription,
          updatedAt: now,
        });
      }
      productIds.push(productId);

      const existingSpecs = await ctx.db
        .query("export_product_specs")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .collect();
      const specKeys = new Set(existingSpecs.map((s) => `${s.key}::${s.valueRaw}`));

      for (const spec of product.specs ?? []) {
        const specKey = `${spec.key}::${spec.valueRaw}`;
        if (specKeys.has(specKey)) continue;
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
        specKeys.add(specKey);
      }
    }

    await logExportAction(ctx, identity.subject, "export_extraction_persisted", args.assessmentId, {
      productCount: productIds.length,
    });

    await refreshSubmissionRouteForAssessment(ctx, args.assessmentId);

    return { productIds };
  },
});

export const refreshSubmissionRoute = mutation({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    await getAssessmentOrThrow(ctx, identity.subject, args.assessmentId);
    return await refreshSubmissionRouteForAssessment(ctx, args.assessmentId);
  },
});
