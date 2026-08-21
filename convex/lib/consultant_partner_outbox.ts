import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { ConsultantReviewSnapshot } from "./consultant_review_snapshot";
import { sourceSlug } from "./partner_config";

export type ConsultantPartnerStatus =
  | "received"
  | "in_review"
  | "completed"
  | "blocked"
  | "revoked"
  | "expired";

export type ConsultantRole = "adviser" | "applies_on_behalf" | "eor";

const TERMINAL_STATUSES = new Set<ConsultantPartnerStatus>([
  "completed",
  "blocked",
  "revoked",
  "expired",
]);

const CASE_CREATED_EVENT = "consultant.case.created" as const;
const CASE_STATUS_EVENT = "consultant.case.status_changed" as const;

function nextSequence(rows: Array<{ sequence?: number }>): number {
  return rows.reduce((highest, row) => Math.max(highest, row.sequence ?? 0), 0) + 1;
}

function eventId(): string {
  return crypto.randomUUID();
}

export function buildPartnerSubjectLabel(snapshot: ConsultantReviewSnapshot): string {
  const controlled = snapshot.products.some((product) => {
    const run = product.classificationRuns[0];
    return run && run.requiresReview === false && Boolean(run.finalControlEntry);
  });
  const parts = [
    controlled ? "Controlled goods" : "Export assessment",
    `${snapshot.products.length} ${snapshot.products.length === 1 ? "item" : "items"}`,
  ];
  if (snapshot.assessment.destinationCountry) {
    parts.push(`destination ${snapshot.assessment.destinationCountry}`);
  }
  return parts.join(" · ");
}

/** Persist the immutable initial case event in the dispatch transaction. */
export async function enqueuePartnerInitialCase(
  ctx: MutationCtx,
  args: {
    expertRequestId: Id<"expert_requests">;
    partnerSlug: string;
    snapshot: ConsultantReviewSnapshot;
    reviewRole: ConsultantRole;
    expiresAt: number;
    now: number;
  },
): Promise<Id<"consultant_partner_status_outbox">> {
  const existing = await ctx.db
    .query("consultant_partner_status_outbox")
    .withIndex("by_request_status", (q) =>
      q.eq("expertRequestId", args.expertRequestId).eq("status", "received"),
    )
    .unique();
  if (existing) return existing._id;

  const id = eventId();
  const occurredAt = args.now;
  const sequence = 1;
  const externalCaseId = String(args.expertRequestId);
  const rawBody = JSON.stringify({
    eventId: id,
    eventType: CASE_CREATED_EVENT,
    occurredAt,
    sequence,
    source: sourceSlug(),
    externalCaseId,
    reference: args.snapshot.reference,
    status: "received",
    subjectLabel: buildPartnerSubjectLabel(args.snapshot),
    expiresAt: new Date(args.expiresAt).toISOString(),
    reviewRole: args.reviewRole,
  });

  const outboxId = await ctx.db.insert("consultant_partner_status_outbox", {
    expertRequestId: args.expertRequestId,
    partnerSlug: args.partnerSlug,
    externalCaseId,
    status: "received",
    eventId: id,
    eventType: CASE_CREATED_EVENT,
    eventKind: "initial",
    occurredAt,
    sequence,
    rawBody,
    state: "pending",
    attempts: 0,
    nextAttemptAt: args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });
  await ctx.scheduler.runAfter(0, internal.consultant_partner_sync.deliverPartnerOutbox, {
    outboxId,
  });
  return outboxId;
}

/** Re-arm an exhausted initial event without changing its id, sequence, or body. */
export async function retryPartnerInitialCase(
  ctx: MutationCtx,
  args: { expertRequestId: Id<"expert_requests">; now: number },
): Promise<Id<"consultant_partner_status_outbox"> | null> {
  const row = await ctx.db
    .query("consultant_partner_status_outbox")
    .withIndex("by_request_status", (q) =>
      q.eq("expertRequestId", args.expertRequestId).eq("status", "received"),
    )
    .unique();
  if (!row || row.state !== "exhausted") return null;

  await ctx.db.patch(row._id, {
    state: "pending",
    attempts: 0,
    nextAttemptAt: args.now,
    lastError: undefined,
    claimId: undefined,
    claimedAt: undefined,
    leaseExpiresAt: undefined,
    exhaustedNotifiedAt: undefined,
    updatedAt: args.now,
  });
  await ctx.scheduler.runAfter(0, internal.consultant_partner_sync.deliverPartnerOutbox, {
    outboxId: row._id,
  });
  return row._id;
}

/** Persist a partner status before any network request is attempted. */
export async function enqueuePartnerCaseStatus(
  ctx: MutationCtx,
  args: {
    expertRequestId: Id<"expert_requests">;
    partnerSlug: string;
    status: Exclude<ConsultantPartnerStatus, "received">;
    now: number;
  },
): Promise<Id<"consultant_partner_status_outbox"> | null> {
  const existing = await ctx.db
    .query("consultant_partner_status_outbox")
    .withIndex("by_request_status", (q) =>
      q.eq("expertRequestId", args.expertRequestId).eq("status", args.status),
    )
    .unique();
  if (existing) return existing._id;

  const earlier = await ctx.db
    .query("consultant_partner_status_outbox")
    .withIndex("by_expert_request", (q) => q.eq("expertRequestId", args.expertRequestId))
    .collect();
  const terminalExists = earlier.some((row) => TERMINAL_STATUSES.has(row.status));
  if (args.status === "in_review" && terminalExists) return null;

  if (TERMINAL_STATUSES.has(args.status)) {
    for (const row of earlier) {
      if (row.status !== "in_review" || (row.state !== "pending" && row.state !== "delivering")) {
        continue;
      }
      if (row.state === "delivering" && row.claimId) {
        await ctx.db.insert("consultant_partner_delivery_attempts", {
          outboxId: row._id,
          eventId: row.eventId ?? String(row._id),
          claimId: row.claimId,
          attemptNumber: row.attempts,
          phase: "superseded",
          occurredAt: args.now,
        });
      }
      await ctx.db.patch(row._id, {
        state: "superseded",
        claimId: undefined,
        claimedAt: undefined,
        leaseExpiresAt: undefined,
        updatedAt: args.now,
      });
    }
  }

  const id = eventId();
  const sequence = nextSequence(earlier);
  const externalCaseId = String(args.expertRequestId);
  const rawBody = JSON.stringify({
    eventId: id,
    eventType: CASE_STATUS_EVENT,
    occurredAt: args.now,
    sequence,
    source: sourceSlug(),
    externalCaseId,
    status: args.status,
  });
  const outboxId = await ctx.db.insert("consultant_partner_status_outbox", {
    expertRequestId: args.expertRequestId,
    partnerSlug: args.partnerSlug,
    externalCaseId,
    status: args.status,
    eventId: id,
    eventType: CASE_STATUS_EVENT,
    eventKind: "status",
    occurredAt: args.now,
    sequence,
    rawBody,
    state: "pending",
    attempts: 0,
    nextAttemptAt: args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });
  await ctx.scheduler.runAfter(0, internal.consultant_partner_sync.deliverPartnerOutbox, {
    outboxId,
  });
  return outboxId;
}
