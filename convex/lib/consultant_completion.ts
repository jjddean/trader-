/**
 * The single write path for a completed consultant review.
 *
 * Two front doors reach it, and both must land the same records, so neither
 * owns the logic: a review token issued by a partner handoff, and the legacy
 * sender-emailed token kept as a fallback. What they write:
 *
 *   expert_requests  — outcome, notes, refs, reviewer identity
 *   export_assessments — status (clear / flagged)
 *   export_licences  — only when a reference was supplied, and never with a
 *                      licence type the route contradicts
 *   auditLogs        — attributed to the verified reviewer where there is one
 *   app_notifications — tells the requester the review came back
 *
 * Reviewer identity: a sender-issued token can only offer the address somebody
 * typed, which is a claim, not proof. A handoff token carries an identity the
 * partner's own authenticated session established. `verified` records which it
 * was, so an audit reader can tell the difference.
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  licenceTypeForRoute,
  resolveSubmissionRoute,
  type ExportLicenceType,
  type SubmissionRoute,
} from "./export_routing";
import { notify } from "./notify";
import { userError } from "./user_errors";
import { closeConsultantCredentials } from "./consultant_credentials";
import { enqueuePartnerCaseStatus } from "./consultant_partner_outbox";

export type ConsultantOutcome = "cleared" | "blocked";

export interface ConsultantReviewer {
  /** Display label written to `auditLogs.userId` and `export_licences.recordedBy`. */
  label: string;
  /** Verified identity from the reviewing system's session, when there is one. */
  externalId?: string;
  email?: string;
  /** "freightcode_token" or a configured partner slug. */
  system: string;
  verified: boolean;
}

export interface ConsultantCompletionInput {
  expertRequestId: Id<"expert_requests">;
  assessmentId: Id<"export_assessments">;
  outcome: ConsultantOutcome;
  advisoryNotes: string;
  applicationRef?: string;
  licenceRef?: string;
  reviewer: ConsultantReviewer;
  completedAt: number;
}

export interface ConsultantCompletionResult {
  assessmentId: Id<"export_assessments">;
  outcome: ConsultantOutcome;
  licenceId?: Id<"export_licences">;
  licenceType?: ExportLicenceType;
}

const MAX_ADVISORY_NOTES_LENGTH = 10_000;
const MAX_REFERENCE_LENGTH = 200;

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result && result.length > 0 ? result : undefined;
}

/**
 * The route this assessment actually sits on.
 *
 * Prefers the route stored on the assessment; recomputes from the approved
 * control entries when it is unset, which is the same decision the draft pack
 * and the consultant form show.
 */
export async function resolveAssessmentRoute(
  ctx: MutationCtx,
  assessmentId: Id<"export_assessments">,
  assessment: { originJurisdiction?: "GB" | "NI"; destinationCountry?: string; submissionRoute?: string },
): Promise<SubmissionRoute> {
  const stored = assessment.submissionRoute;
  if (stored === "lite" || stored === "spire" || stored === "otsi" || stored === "none") {
    return stored;
  }

  const products = await ctx.db
    .query("export_products")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();

  const approved: string[] = [];
  for (const product of products) {
    const runs = await ctx.db
      .query("export_classification_runs")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();
    const latest = runs.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (latest && latest.requiresReview === false) approved.push(latest.finalControlEntry ?? "");
  }

  return resolveSubmissionRoute({
    originJurisdiction: assessment.originJurisdiction,
    destinationCountry: assessment.destinationCountry,
    approvedControlEntries: approved,
  }).route;
}

/**
 * Apply a completed review. Callers are responsible for authorising the
 * reviewer and for rejecting expired, revoked or already-completed requests
 * before calling — this function performs the writes, not the gate.
 */
export async function applyConsultantCompletion(
  ctx: MutationCtx,
  input: ConsultantCompletionInput,
): Promise<ConsultantCompletionResult> {
  const notes = input.advisoryNotes.trim();
  if (!notes) throw userError("advisory_notes_are_required", "Advisory notes are required");
  if (notes.length > MAX_ADVISORY_NOTES_LENGTH) {
    throw userError("advisory_notes_too_long", "Advisory notes are too long");
  }

  const assessment = await ctx.db.get(input.assessmentId);
  if (!assessment) throw userError("assessment_not_found", "Assessment not found");

  const applicationRef = trimmed(input.applicationRef);
  const licenceRef = trimmed(input.licenceRef);
  if (applicationRef && applicationRef.length > MAX_REFERENCE_LENGTH) {
    throw userError("application_reference_too_long", "Application reference is too long");
  }
  if (licenceRef && licenceRef.length > MAX_REFERENCE_LENGTH) {
    throw userError("licence_reference_too_long", "Licence reference is too long");
  }
  const now = input.completedAt;

  await ctx.db.patch(input.expertRequestId, {
    status: input.outcome === "cleared" ? "completed" : "blocked",
    advisoryNotes: notes,
    outcome: input.outcome,
    applicationRef,
    licenceRef,
    completedAt: now,
    dispatchOpen: false,
    updatedAt: now,
    reviewerSystem: input.reviewer.system,
    reviewerExternalId: input.reviewer.externalId,
    reviewerEmail: input.reviewer.email ?? undefined,
    reviewerVerified: input.reviewer.verified,
  });

  await ctx.db.patch(input.assessmentId, {
    status: input.outcome === "cleared" ? "clear" : "flagged",
    updatedAt: now,
  });

  await closeConsultantCredentials(ctx, {
    expertRequestId: input.expertRequestId,
    assessmentId: input.assessmentId,
    terminalState: "completed",
    terminalAt: now,
  });

  let licenceId: Id<"export_licences"> | undefined;
  let licenceType: ExportLicenceType | undefined;

  if (applicationRef || licenceRef) {
    const route = await resolveAssessmentRoute(ctx, input.assessmentId, assessment);
    // Derived, never supplied by the reviewer: the consultant form records a
    // reference, not a licence type, so the only defensible value is the one
    // the route implies. See licenceTypeForRoute for why SPIRE yields "other".
    licenceType = licenceTypeForRoute(route);
    licenceId = await ctx.db.insert("export_licences", {
      assessmentId: input.assessmentId,
      licenceType,
      applicationRef,
      licenceRef,
      route,
      recordedBy: input.reviewer.label,
      recordedAt: now,
    });
    await ctx.db.patch(input.expertRequestId, { licenceType });
  }

  await ctx.db.insert("auditLogs", {
    userId: input.reviewer.label,
    action: "consultant_review_completed",
    details: {
      assessmentId: input.assessmentId,
      expertRequestId: input.expertRequestId,
      outcome: input.outcome,
      reviewerSystem: input.reviewer.system,
      reviewerExternalId: input.reviewer.externalId,
      reviewerEmail: input.reviewer.email,
      reviewerVerified: input.reviewer.verified,
      licenceId,
      licenceType,
      applicationRef,
      licenceRef,
    },
    timestamp: now,
    archived: false,
  });

  const request = await ctx.db.get(input.expertRequestId);
  await notify(ctx, {
    event: "export_controls.consultant_review_completed",
    userId: String(request?.requestedBy || assessment.userId || ""),
    orgId: typeof assessment.orgId === "string" ? assessment.orgId : undefined,
    title:
      input.outcome === "cleared"
        ? `Consultant signed off ${assessment.reference}`
        : `Consultant blocked ${assessment.reference}`,
    body: notes.length > 200 ? `${notes.slice(0, 197)}…` : notes,
    href: `/dashboard/trade-compliance?assessment=${input.assessmentId}`,
    sourceTable: "expert_requests",
    sourceId: String(input.expertRequestId),
    dedupeKey: `consultant-review:${input.expertRequestId}`,
    metadata: {
      outcome: input.outcome,
      applicationRef,
      licenceRef,
      licenceType,
      reviewerSystem: input.reviewer.system,
    },
  });

  // Persist the partner update before attempting delivery. A partner outage
  // leaves a bounded-retry outbox row rather than losing the terminal state.
  if (request?.externalSystem) {
    await enqueuePartnerCaseStatus(ctx, {
      expertRequestId: input.expertRequestId,
      partnerSlug: request.externalSystem,
      status: input.outcome === "cleared" ? "completed" : "blocked",
      now,
    });
  }

  return { assessmentId: input.assessmentId, outcome: input.outcome, licenceId, licenceType };
}
