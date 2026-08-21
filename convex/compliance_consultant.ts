import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  assertAssessmentAccess,
  canAccessAssessment,
  documentBelongsToAssessmentTenant,
} from "./lib/org_access";
import { unauthenticatedError, userError } from "./lib/user_errors";
import {
  buildConsultantReviewSnapshot,
  isConsultantReviewSnapshot,
  renderConsultantReviewSnapshot,
} from "./lib/consultant_review_snapshot";
import { applyConsultantCompletion } from "./lib/consultant_completion";
import { closeConsultantCredentials } from "./lib/consultant_credentials";
import { findReviewCredential } from "./lib/consultant_review_credentials";
import {
  enqueuePartnerCaseStatus,
  enqueuePartnerInitialCase,
  retryPartnerInitialCase,
} from "./lib/consultant_partner_outbox";
import { assertNoOpenConsultantDispatch } from "./lib/consultant_dispatch_guard";
import { partnerEndpoint } from "./lib/partner_config";

const CONSULTANT_ROLE = v.union(
  v.literal("adviser"),
  v.literal("applies_on_behalf"),
  v.literal("eor"),
);

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PARTNER_SLUG_LENGTH = 64;
const MAX_CONSULTANT_EMAIL_LENGTH = 254;
const MAX_CONSULTANT_NAME_LENGTH = 160;
const MAX_SENDER_NOTE_LENGTH = 2_000;

/** Reason code that marks an expert_requests row as a consultant dispatch. */
export const CONSULTANT_DISPATCH_REASON = "consultant_dispatch";

/**
 * The consultant dispatch a status panel should show.
 *
 * The old lookup took the newest `expert_requests` row for the assessment
 * whatever it was. `createExpertRequest` writes rows under other reason codes
 * for internal review flags, so one of those landing after a sign-off hid the
 * completed consultant review behind a "pending" state. Only dispatch rows
 * count, and the newest dispatch is authoritative regardless of its state.
 */
export function selectConsultantDispatch<
  T extends {
    reasonCode: string;
    createdAt: number;
    completedAt?: number;
    _creationTime?: number;
  },
>(requests: T[]): T | null {
  const dispatches = requests
    .filter((request) => request.reasonCode === CONSULTANT_DISPATCH_REASON)
    .sort(
      (a, b) =>
        b.createdAt - a.createdAt || (b._creationTime ?? 0) - (a._creationTime ?? 0),
    );
  return dispatches[0] ?? null;
}

/** Whether a dispatch may still be worked on by the consultant. */
export function dispatchIsOpen(
  request: {
    completedAt?: number;
    revokedAt?: number;
    expiresAt?: number;
    deliveryStatus?: string;
  },
  now: number,
): boolean {
  if (request.completedAt != null) return false;
  if (request.revokedAt != null) return false;
  if (request.deliveryStatus === "revoked" || request.deliveryStatus === "expired") return false;
  if (request.expiresAt != null && request.expiresAt <= now) return false;
  return true;
}

/**
 * Evidence for the consultant review page.
 *
 * Deliberately NOT `collectEvidenceWithUrls`, which hands back a Convex storage
 * URL. Those are unauthenticated and effectively permanent: once one reaches a
 * browser it is a standing link to the file for anyone who obtains it, outliving
 * the review, the token and any withdrawal.
 *
 * `downloadUrl` here is a path on our own API, gated by the same review token
 * as the page. The field name and shape are unchanged, so the review form
 * renders exactly as before — only what the href points at has changed.
 */
async function collectEvidenceForReview(
  ctx: any,
  assessmentId: Id<"export_assessments">,
  token?: string,
) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) return [];
  const rows = await ctx.db
    .query("export_evidence")
    .withIndex("by_assessment", (q: any) => q.eq("assessmentId", assessmentId))
    .collect();

  return await Promise.all(
    rows
      .sort((a: { addedAt: number }, b: { addedAt: number }) => b.addedAt - a.addedAt)
      .map(async (row: any) => {
        let fileName: string | undefined;
        let fileSize: number | undefined;
        let downloadUrl: string | undefined;

        if (row.documentId) {
          const document = await ctx.db.get(row.documentId);
          if (document && (await documentBelongsToAssessmentTenant(ctx, document, assessment))) {
            fileName = typeof document.fileName === "string" ? document.fileName : undefined;
            fileSize = document.fileSize;
            if (document.fileId) {
              if (token) {
                downloadUrl = `/api/export-controls/review-evidence/${token}/${row._id}`;
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
              fileType:
                typeof document.fileType === "string"
                  ? document.fileType
                  : "application/octet-stream",
              storageId: document.fileId,
              downloadUrl,
            };
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

async function loadAssessmentDetail(
  ctx: any,
  assessmentId: Id<"export_assessments">,
  token?: string,
) {
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

  const evidence = await collectEvidenceForReview(ctx, assessmentId, token);

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

    const requests = await ctx.db
      .query("expert_requests")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    const now = Date.now();
    const requestById = new Map(requests.map((request) => [String(request._id), request]));
    const active = tokens
      .filter((token) => {
        const request = requestById.get(String(token.expertRequestId));
        return (
          !token.revoked &&
          !token.completedAt &&
          token.expiresAt > now &&
          request != null &&
          dispatchIsOpen(request, now)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    const latestRequest = selectConsultantDispatch(requests);
    const latestRequestStatus = latestRequest
      ? {
          _id: latestRequest._id,
          status: latestRequest.status,
          outcome: latestRequest.outcome,
          deliveryStatus: latestRequest.deliveryStatus,
          deliveredAt: latestRequest.deliveredAt,
          deliveryError: latestRequest.deliveryError,
          expiresAt: latestRequest.expiresAt,
          completedAt: latestRequest.completedAt,
          revokedAt: latestRequest.revokedAt,
          advisoryNotes: latestRequest.advisoryNotes,
          applicationRef: latestRequest.applicationRef,
          licenceRef: latestRequest.licenceRef,
          licenceType: latestRequest.licenceType,
          consultantEmail: latestRequest.consultantEmail,
          consultantName: latestRequest.consultantName,
          consultantRole: latestRequest.consultantRole,
          reviewerSystem: latestRequest.reviewerSystem,
          reviewerEmail: latestRequest.reviewerEmail,
          reviewerVerified: latestRequest.reviewerVerified,
        }
      : null;

    const deliveryRows = latestRequest
      ? await ctx.db
          .query("consultant_partner_status_outbox")
          .withIndex("by_expert_request", (q) => q.eq("expertRequestId", latestRequest._id))
          .collect()
      : [];
    const deliveryEvents = deliveryRows
      .sort(
        (a, b) =>
          (a.sequence ?? Number.MAX_SAFE_INTEGER) -
            (b.sequence ?? Number.MAX_SAFE_INTEGER) ||
          a.createdAt - b.createdAt,
      )
      .map((row) => ({
        eventId: row.eventId ?? String(row._id),
        eventType: row.eventType ?? "consultant.case.status_changed",
        status: row.status,
        state: row.state,
        sequence: row.sequence,
        attempts: row.attempts,
        nextAttemptAt: row.state === "pending" ? row.nextAttemptAt : undefined,
        lastAttemptAt: row.lastAttemptAt,
        lastError: row.lastError,
        deliveredAt: row.deliveredAt,
        occurredAt: row.occurredAt ?? row.createdAt,
      }));
    const partnerDelivery = latestRequest
      ? {
          pending: deliveryRows.some(
            (row) => row.state === "pending" || row.state === "delivering",
          ),
          exhausted: deliveryRows.some((row) => row.state === "exhausted"),
          events: deliveryEvents,
        }
      : null;

    return {
      activeToken: active
        ? {
            _id: active._id,
            expertRequestId: active.expertRequestId,
            consultantEmail: active.consultantEmail,
            consultantName: active.consultantName,
            consultantRole: active.consultantRole,
            expiresAt: active.expiresAt,
            createdAt: active.createdAt,
            openedAt: active.openedAt,
          }
        : null,
      latestRequest: latestRequestStatus,
      partnerDelivery,
      isOpen: latestRequest ? dispatchIsOpen(latestRequest, now) : false,
    };
  },
});

export const createConsultantDispatch = mutation({
  args: {
    assessmentId: v.id("export_assessments"),
    partnerSlug: v.string(),
    consultantEmail: v.optional(v.string()),
    senderNote: v.optional(v.string()),
    consultantName: v.optional(v.string()),
    consultantRole: CONSULTANT_ROLE,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw userError("assessment_not_found", "Assessment not found");
    await assertAssessmentAccess(ctx, identity.subject, assessment);
    await assertNoOpenConsultantDispatch(ctx, args.assessmentId);

    // Optional since delivery is by authenticated partner API, not email. Kept
    // so the record still names a person when the sender has one in mind.
    const consultantEmail = args.consultantEmail?.trim() || undefined;
    const consultantName = args.consultantName?.trim();
    const consultantRole = args.consultantRole;
    const senderNote = args.senderNote?.trim() || undefined;
    const partnerSlug = args.partnerSlug.trim().toLowerCase();
    if (
      !partnerSlug ||
      partnerSlug.length > MAX_PARTNER_SLUG_LENGTH ||
      !/^[a-z0-9][a-z0-9_-]*$/.test(partnerSlug)
    ) {
      throw userError("consultant_partner_required", "Consultant partner required");
    }
    const partner = partnerEndpoint(partnerSlug);
    if (
      !partner?.intakeUrl ||
      !partner.outboundKey ||
      !partner.outboundSigningKey ||
      !partner.keyId ||
      partner.signingConfigurationInvalid
    ) {
      throw userError("consultant_partner_unavailable", "Consultant partner is not configured");
    }
    if (consultantEmail && consultantEmail.length > MAX_CONSULTANT_EMAIL_LENGTH) {
      throw userError("consultant_email_too_long", "Consultant email is too long");
    }
    if (consultantName && consultantName.length > MAX_CONSULTANT_NAME_LENGTH) {
      throw userError("consultant_name_too_long", "Consultant name is too long");
    }
    if (senderNote && senderNote.length > MAX_SENDER_NOTE_LENGTH) {
      throw userError("sender_note_too_long", "Sender note is too long");
    }

    const now = Date.now();
    const expiresAt = now + TOKEN_TTL_MS;
    const detail = await loadAssessmentDetail(ctx, args.assessmentId);
    if (!detail) throw userError("assessment_not_found", "Assessment not found");

    const snapshot = buildConsultantReviewSnapshot({
      assessment: detail.assessment as unknown as Record<string, unknown>,
      products: detail.products as never,
      screenings: detail.screenings as never,
      licences: detail.licences as never,
      evidence: detail.evidence as never,
      senderNote,
      frozenAt: now,
      expiresAt,
    });

    const expertRequestId = await ctx.db.insert("expert_requests", {
      assessmentId: args.assessmentId,
      requestedBy: identity.subject,
      reasonCode: CONSULTANT_DISPATCH_REASON,
      status: "sent",
      assessmentSnapshot: snapshot,
      consultantEmail,
      consultantName,
      consultantRole,
      senderNote,
      externalSystem: partnerSlug,
      deliveryStatus: "pending",
      expiresAt,
      dispatchOpen: true,
      createdAt: now,
      updatedAt: now,
    });

    const initialDeliveryId = await enqueuePartnerInitialCase(ctx, {
      expertRequestId,
      partnerSlug,
      snapshot,
      reviewRole: consultantRole,
      expiresAt,
      now,
    });

    for (const item of detail.evidence) {
      if (!item.storageId || !item.fileName) continue;
      await ctx.db.insert("consultant_review_files", {
        expertRequestId,
        assessmentId: args.assessmentId,
        evidenceId: item._id,
        storageId: item.storageId,
        fileName: item.fileName,
        contentType: item.fileType || "application/octet-stream",
        fileSize: item.fileSize,
        createdAt: now,
      });
    }

    // No review token is minted here. A dispatch used to create a 14-day bearer
    // link up front, which sat in the database as a working credential for the
    // whole review whether or not anyone ever used it. Tokens are now issued
    // only by `consultant_handoff.redeemHandoff`, one per verified consultant,
    // valid for hours rather than weeks.

    if (assessment.status === "draft") {
      await ctx.db.patch(args.assessmentId, { status: "review_required", updatedAt: now });
    }

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "consultant_dispatch_created",
      details: {
        assessmentId: args.assessmentId,
        expertRequestId,
        consultantEmail,
        externalSystem: partnerSlug,
        productCount: snapshot.products.length,
        evidenceCount: snapshot.evidence.length,
        snapshotVersion: snapshot.snapshotVersion,
      },
      timestamp: now,
      archived: false,
    });

    return {
      expertRequestId,
      consultantEmail,
      consultantName,
      consultantRole,
      senderNote,
      externalSystem: partnerSlug,
      expiresAt,
      initialDeliveryId,
      deliveryStatus: "pending" as const,
      snapshot,
    };
  },
});

/**
 * Return the retained, immutable payload for a failed delivery attempt.
 * Delivery state remains failed until the caller records the new outcome.
 */
export const retryConsultantDispatch = mutation({
  args: { expertRequestId: v.id("expert_requests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const request = await ctx.db.get(args.expertRequestId);
    if (!request || request.reasonCode !== CONSULTANT_DISPATCH_REASON) {
      throw userError("review_not_found", "Review request not found");
    }
    const assessment = await ctx.db.get(request.assessmentId);
    await assertAssessmentAccess(ctx, identity.subject, assessment);

    if (request.deliveryStatus !== "failed") {
      throw userError("review_not_retryable", "This review delivery cannot be retried");
    }
    if (!dispatchIsOpen(request, Date.now())) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }
    if (!request.externalSystem || !isConsultantReviewSnapshot(request.assessmentSnapshot)) {
      throw userError("review_not_retryable", "This review delivery cannot be retried");
    }

    const now = Date.now();
    const partner = partnerEndpoint(request.externalSystem);
    if (
      !partner?.intakeUrl ||
      !partner.outboundKey ||
      !partner.outboundSigningKey ||
      !partner.keyId ||
      partner.signingConfigurationInvalid
    ) {
      throw userError("consultant_partner_unavailable", "Consultant partner is not configured");
    }
    let initialDeliveryId = await retryPartnerInitialCase(ctx, {
      expertRequestId: request._id,
      now,
    });
    if (!initialDeliveryId) {
      initialDeliveryId = await enqueuePartnerInitialCase(ctx, {
        expertRequestId: request._id,
        partnerSlug: request.externalSystem,
        snapshot: request.assessmentSnapshot,
        reviewRole: request.consultantRole ?? "applies_on_behalf",
        expiresAt: request.expiresAt ?? request.assessmentSnapshot.expiresAt,
        now,
      });
    }
    await ctx.db.patch(request._id, {
      deliveryStatus: "pending",
      deliveryError: undefined,
      dispatchOpen: true,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "consultant_dispatch_retry_requested",
      details: {
        assessmentId: request.assessmentId,
        expertRequestId: request._id,
        externalSystem: request.externalSystem,
      },
      timestamp: now,
      archived: false,
    });

    return {
      expertRequestId: request._id,
      consultantEmail: request.consultantEmail,
      consultantName: request.consultantName,
      consultantRole: request.consultantRole ?? "applies_on_behalf",
      senderNote: request.senderNote,
      externalSystem: request.externalSystem,
      expiresAt: request.expiresAt,
      initialDeliveryId,
      deliveryStatus: "pending" as const,
      snapshot: request.assessmentSnapshot,
    };
  },
});

/** Records the partner's case id once delivery succeeded. */
export const markDispatchDelivered = mutation({
  args: {
    expertRequestId: v.id("expert_requests"),
    externalSystem: v.string(),
    externalCaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const request = await ctx.db.get(args.expertRequestId);
    if (!request || request.reasonCode !== CONSULTANT_DISPATCH_REASON) {
      throw userError("review_not_found", "Review request not found");
    }
    const assessment = await ctx.db.get(request.assessmentId);
    await assertAssessmentAccess(ctx, identity.subject, assessment);

    const externalSystem = args.externalSystem.trim().toLowerCase();
    if (!request.externalSystem || request.externalSystem !== externalSystem) {
      throw userError("review_not_found", "Review request not found");
    }
    if (!dispatchIsOpen(request, Date.now())) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }
    const externalCaseId = args.externalCaseId.trim();
    if (!externalCaseId) {
      throw userError("external_case_id_required", "External case ID required");
    }

    const now = Date.now();
    await ctx.db.patch(args.expertRequestId, {
      externalSystem,
      externalCaseId,
      deliveryStatus: "delivered",
      deliveredAt: now,
      deliveryError: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "consultant_dispatch_delivered",
      details: {
        assessmentId: request.assessmentId,
        expertRequestId: args.expertRequestId,
        externalSystem,
        externalCaseId,
      },
      timestamp: now,
      archived: false,
    });
  },
});

/**
 * Records a failed hand-off. The dispatch and its snapshot are kept so the
 * exporter can retry without re-freezing a changed assessment.
 */
export const markDispatchDeliveryFailed = mutation({
  args: {
    expertRequestId: v.id("expert_requests"),
    externalSystem: v.string(),
    deliveryError: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const request = await ctx.db.get(args.expertRequestId);
    if (!request || request.reasonCode !== CONSULTANT_DISPATCH_REASON) {
      throw userError("review_not_found", "Review request not found");
    }
    const assessment = await ctx.db.get(request.assessmentId);
    await assertAssessmentAccess(ctx, identity.subject, assessment);

    const externalSystem = args.externalSystem.trim().toLowerCase();
    if (!request.externalSystem || request.externalSystem !== externalSystem) {
      throw userError("review_not_found", "Review request not found");
    }
    if (!dispatchIsOpen(request, Date.now())) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }

    const now = Date.now();
    await ctx.db.patch(args.expertRequestId, {
      externalSystem,
      deliveryStatus: "failed",
      deliveryError: args.deliveryError.slice(0, 500),
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "consultant_dispatch_delivery_failed",
      details: {
        assessmentId: request.assessmentId,
        expertRequestId: args.expertRequestId,
        externalSystem,
      },
      timestamp: now,
      archived: false,
    });
  },
});

/**
 * Withdraw a review already with the consultant.
 *
 * Closes both doors: the review credential stops resolving, and a durable
 * partner-status event is queued in the same transaction.
 */
export const revokeConsultantDispatch = mutation({
  args: {
    expertRequestId: v.id("expert_requests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const request = await ctx.db.get(args.expertRequestId);
    if (!request || request.reasonCode !== CONSULTANT_DISPATCH_REASON) {
      throw userError("review_not_found", "Review request not found");
    }
    const assessment = await ctx.db.get(request.assessmentId);
    if (!assessment) throw userError("assessment_not_found", "Assessment not found");
    await assertAssessmentAccess(ctx, identity.subject, assessment);

    if (request.completedAt) {
      throw userError(
        "this_review_was_already_completed",
        "This review was already completed and cannot be withdrawn",
      );
    }
    if (
      request.revokedAt ||
      request.deliveryStatus === "revoked" ||
      request.deliveryStatus === "expired"
    ) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }

    const now = Date.now();
    await ctx.db.patch(args.expertRequestId, {
      status: "revoked",
      deliveryStatus: "revoked",
      dispatchOpen: false,
      revokedAt: now,
      revokedBy: identity.subject,
      updatedAt: now,
    });

    await closeConsultantCredentials(ctx, {
      expertRequestId: args.expertRequestId,
      assessmentId: request.assessmentId,
      terminalState: "revoked",
      terminalAt: now,
    });

    let partnerNotificationQueued = false;
    if (request.externalSystem) {
      await enqueuePartnerCaseStatus(ctx, {
        expertRequestId: request._id,
        partnerSlug: request.externalSystem,
        status: "revoked",
        now,
      });
      partnerNotificationQueued = true;
    }

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "consultant_dispatch_revoked",
      details: {
        assessmentId: request.assessmentId,
        expertRequestId: args.expertRequestId,
        externalSystem: request.externalSystem,
        externalCaseId: request.externalCaseId,
        reason: args.reason?.trim() || undefined,
      },
      timestamp: now,
      archived: false,
    });

    return {
      externalSystem: request.externalSystem ?? null,
      externalCaseId: request.externalCaseId ?? null,
      assessmentId: request.assessmentId,
      partnerNotificationQueued,
    };
  },
});

/** Legacy raw-token access or server-held hash-session access. */
export const getReviewByToken = query({
  args: {
    token: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    partnerSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await findReviewCredential(ctx, args);

    const now = Date.now();
    if (!row || row.revoked || row.completedAt || row.expiresAt <= now) return null;

    const request = await ctx.db.get(row.expertRequestId);
    if (!request || !dispatchIsOpen(request, now)) return null;
    if (!isConsultantReviewSnapshot(request.assessmentSnapshot)) return null;

    const detail = renderConsultantReviewSnapshot(request.assessmentSnapshot, row.token);

    return {
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

/** Public — secured by token. Fallback door onto the shared completion path. */
export const completeConsultantReview = mutation({
  args: {
    token: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    partnerSecret: v.optional(v.string()),
    advisoryNotes: v.string(),
    outcome: v.union(v.literal("cleared"), v.literal("blocked")),
    applicationRef: v.optional(v.string()),
    licenceRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await findReviewCredential(ctx, args);

    if (!row || row.revoked || row.expiresAt <= Date.now()) {
      throw userError("link_expired_or_invalid", "Link expired or invalid");
    }
    if (row.completedAt) {
      throw userError("this_review_was_already_completed", "This review was already completed");
    }

    const now = Date.now();
    const request = await ctx.db.get(row.expertRequestId);
    if (!request) throw userError("review_not_found", "Review request not found");
    if (!dispatchIsOpen(request, now)) {
      throw userError("link_expired_or_invalid", "This review is no longer open");
    }

    const result = await applyConsultantCompletion(ctx, {
      expertRequestId: row.expertRequestId,
      assessmentId: row.assessmentId,
      outcome: args.outcome,
      advisoryNotes: args.advisoryNotes,
      applicationRef: args.applicationRef,
      licenceRef: args.licenceRef,
      // A handoff token carries an identity the partner's own session proved.
      // A sender-issued token carries an address somebody typed — that is a
      // claim, and the audit record must not dress it up as anything more.
      reviewer:
        row.consultantVerified && row.partnerSlug
          ? {
              label: row.consultantEmail || `${row.partnerSlug}:${row.consultantExternalId}`,
              externalId: row.consultantExternalId,
              email: row.consultantEmail || undefined,
              system: row.partnerSlug,
              verified: true,
            }
          : {
              label: row.consultantEmail || "consultant",
              email: row.consultantEmail || undefined,
              system: "freightcode_token",
              verified: false,
            },
      completedAt: now,
    });

    return { assessmentId: result.assessmentId, outcome: result.outcome };
  },
});

export const markReviewTokenOpened = mutation({
  args: {
    token: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    partnerSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await findReviewCredential(ctx, args);
    const now = Date.now();
    if (!row || row.openedAt || row.revoked || row.completedAt || row.expiresAt <= now) return;
    const request = await ctx.db.get(row.expertRequestId);
    if (!request || !dispatchIsOpen(request, now)) return;
    await ctx.db.patch(row._id, { openedAt: now });
    await ctx.db.insert("auditLogs", {
      userId:
        row.partnerSlug && row.consultantExternalId
          ? `${row.partnerSlug}:${row.consultantExternalId}`
          : row.consultantEmail || "consultant",
      action: "consultant_review_opened",
      details: {
        assessmentId: row.assessmentId,
        expertRequestId: row.expertRequestId,
        reviewTokenId: row._id,
      },
      timestamp: now,
      archived: false,
    });
  },
});

/**
 * One evidence file's storage URL, for our own API route to fetch and stream.
 *
 * Token-gated exactly like the review page, and scoped to the assessment that
 * token belongs to. The URL is returned to a server, never to a browser — the
 * consultant only ever sees the proxy path.
 */
export const getReviewEvidenceByToken = mutation({
  args: {
    token: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    partnerSecret: v.optional(v.string()),
    evidenceId: v.id("export_evidence"),
  },
  handler: async (ctx, args) => {
    const row = await findReviewCredential(ctx, args);

    const now = Date.now();
    if (!row || row.revoked || row.completedAt || row.expiresAt <= now) return null;

    const request = await ctx.db.get(row.expertRequestId);
    if (!request || !dispatchIsOpen(request, now)) return null;
    if (!isConsultantReviewSnapshot(request.assessmentSnapshot)) return null;
    const frozenEvidence = request.assessmentSnapshot.evidence.find(
      (item) => item.evidenceId === String(args.evidenceId),
    );
    if (!frozenEvidence?.hasFile) return null;

    const file = await ctx.db
      .query("consultant_review_files")
      .withIndex("by_request_evidence", (q) =>
        q.eq("expertRequestId", row.expertRequestId).eq("evidenceId", args.evidenceId),
      )
      .unique();
    if (!file || file.assessmentId !== row.assessmentId) return null;

    const url = await ctx.storage.getUrl(file.storageId);
    if (!url) return null;

    await ctx.db.insert("auditLogs", {
      userId:
        row.partnerSlug && row.consultantExternalId
          ? `${row.partnerSlug}:${row.consultantExternalId}`
          : row.consultantEmail || "consultant",
      action: "consultant_review_evidence_accessed",
      details: {
        assessmentId: row.assessmentId,
        expertRequestId: row.expertRequestId,
        reviewTokenId: row._id,
        evidenceId: args.evidenceId,
      },
      timestamp: now,
      archived: false,
    });

    return {
      url,
      fileName: file.fileName,
      contentType: file.contentType,
    };
  },
});
