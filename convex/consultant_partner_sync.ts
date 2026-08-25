/** Durable, leased outbound delivery and consultant-dispatch expiry. */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { partnerEndpoint, sourceSlug } from "./lib/partner_config";
import { signPartnerRequest } from "./lib/consultant_partner_signing";
import { closeConsultantCredentials } from "./lib/consultant_credentials";
import { enqueuePartnerCaseStatus } from "./lib/consultant_partner_outbox";
import { notify } from "./lib/notify";

const PARTNER_STATUS = v.union(
  v.literal("received"),
  v.literal("in_review"),
  v.literal("completed"),
  v.literal("blocked"),
  v.literal("revoked"),
  v.literal("expired"),
);

const MAX_DELIVERY_ATTEMPTS = 6;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 30 * 60 * 1000;
const CLAIM_LEASE_MS = 60_000;
const RESPONSE_MAX_BYTES = 32 * 1024;
const DELIVERY_TIMEOUT_MS = 15_000;
const MAX_SWEEP_BATCH = 100;
const MAX_EXPIRY_BATCH = 100;

interface PartnerDeliveryResult {
  ok: boolean;
  error?: string;
  httpStatus?: number;
  responseCaseId?: string;
  responseBytes?: number;
}

function safePartnerUrl(raw: string, statusEvent: boolean): string {
  const target = new URL(raw);
  if (target.protocol !== "https:" || target.username || target.password || target.hash) {
    throw new Error("Consultant partner URL must be an exact HTTPS target");
  }
  if (statusEvent) {
    target.pathname = `${target.pathname.replace(/\/$/, "")}/status`;
  }
  return target.toString();
}

async function readResponseBodyLimited(
  response: Response,
): Promise<{ text: string | null; bytes: number }> {
  const declared = response.headers.get("content-length");
  if (declared) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > RESPONSE_MAX_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return { text: null, bytes: length };
    }
  }
  if (!response.body) return { text: "", bytes: 0 };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > RESPONSE_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return { text: null, bytes: total };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), bytes: total };
}

async function sendPartnerEvent(row: {
  partnerSlug: string;
  eventKind?: "initial" | "status";
  status: "received" | "in_review" | "completed" | "blocked" | "revoked" | "expired";
  rawBody: string;
  claimId: string;
}): Promise<PartnerDeliveryResult> {
  const partner = partnerEndpoint(row.partnerSlug);
  if (!partner?.intakeUrl) {
    return { ok: false, error: "Partner endpoint is not configured" };
  }
  if (
    partner.signingConfigurationInvalid ||
    !partner.outboundKey ||
    new TextEncoder().encode(partner.outboundKey).byteLength < 32 ||
    !partner.outboundSigningKey ||
    new TextEncoder().encode(partner.outboundSigningKey).byteLength < 32 ||
    !partner.keyId
  ) {
    return { ok: false, error: "Partner HMAC and bearer credentials are not configured" };
  }

  try {
    const statusEvent = row.eventKind === "status" || row.status !== "received";
    const url = safePartnerUrl(partner.intakeUrl, statusEvent);
    const timestamp = Date.now();
    const signed = await signPartnerRequest({
      method: "POST",
      url,
      timestamp,
      requestId: row.claimId,
      body: row.rawBody,
      keyId: partner.keyId,
      signingKey: partner.outboundSigningKey,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${partner.outboundKey}`,
        ...signed.headers,
      },
      body: row.rawBody,
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    const responseBody = await readResponseBodyLimited(response);
    if (responseBody.text === null) {
      return {
        ok: false,
        httpStatus: response.status,
        responseBytes: responseBody.bytes,
        error: "Partner response was too large",
      };
    }
    if (!response.ok || response.status >= 300) {
      return {
        ok: false,
        httpStatus: response.status,
        responseBytes: responseBody.bytes,
        error: `Partner returned HTTP ${response.status}`,
      };
    }

    let responseCaseId: string | undefined;
    if (!statusEvent && responseBody.text) {
      try {
        const parsed: unknown = JSON.parse(responseBody.text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const candidate = (parsed as Record<string, unknown>).caseId;
          if (typeof candidate === "string" && candidate.trim().length <= 200) {
            responseCaseId = candidate.trim() || undefined;
          }
        }
      } catch {
        // A successful partner response does not require a JSON body.
      }
    }
    return {
      ok: true,
      httpStatus: response.status,
      responseCaseId,
      responseBytes: responseBody.bytes,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Atomically acquire one delivery attempt, including recovery of a stale lease. */
export const claimPartnerDelivery = internalMutation({
  args: { outboxId: v.id("consultant_partner_status_outbox") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row) return null;
    const now = Date.now();
    const pendingDue = row.state === "pending" && row.nextAttemptAt <= now;
    const staleLease =
      row.state === "delivering" &&
      typeof row.leaseExpiresAt === "number" &&
      row.leaseExpiresAt <= now;
    if (!pendingDue && !staleLease) return null;

    const eventId = row.eventId ?? `legacy-${String(row._id)}`;
    const eventType = row.eventType ?? "consultant.case.status_changed";
    const eventKind = row.eventKind ?? "status";
    const occurredAt = row.occurredAt ?? row.createdAt;
    const sequence = row.sequence ?? 1;
    const rawBody =
      row.rawBody ??
      JSON.stringify({
        eventId,
        eventType,
        occurredAt,
        sequence,
        source: sourceSlug(),
        externalCaseId: row.externalCaseId || String(row.expertRequestId),
        status: row.status,
      });

    if (staleLease && row.claimId) {
      await ctx.db.insert("consultant_partner_delivery_attempts", {
        outboxId: row._id,
        eventId,
        claimId: row.claimId,
        attemptNumber: row.attempts,
        phase: "lease_expired",
        occurredAt: now,
      });
    }

    const claimId = crypto.randomUUID();
    const attempts = row.attempts + 1;
    const leaseExpiresAt = now + CLAIM_LEASE_MS;
    await ctx.db.patch(row._id, {
      eventId,
      eventType,
      eventKind,
      occurredAt,
      sequence,
      rawBody,
      state: "delivering",
      attempts,
      claimId,
      claimedAt: now,
      leaseExpiresAt,
      lastAttemptAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("consultant_partner_delivery_attempts", {
      outboxId: row._id,
      eventId,
      claimId,
      attemptNumber: attempts,
      phase: "claimed",
      occurredAt: now,
    });
    await ctx.scheduler.runAfter(CLAIM_LEASE_MS, internal.consultant_partner_sync.deliverPartnerOutbox, {
      outboxId: row._id,
    });

    return {
      ...row,
      eventId,
      eventType,
      eventKind,
      occurredAt,
      sequence,
      rawBody,
      state: "delivering" as const,
      attempts,
      claimId,
      claimedAt: now,
      leaseExpiresAt,
      lastAttemptAt: now,
      updatedAt: now,
    };
  },
});

/** Commit one claimed result. Late or foreign claims cannot mutate the row. */
export const recordPartnerDeliveryResult = internalMutation({
  args: {
    outboxId: v.id("consultant_partner_status_outbox"),
    claimId: v.string(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    responseCaseId: v.optional(v.string()),
    responseBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.state !== "delivering" || row.claimId !== args.claimId) {
      return { accepted: false, state: row?.state ?? null };
    }

    const now = Date.now();
    const eventId = row.eventId ?? `legacy-${String(row._id)}`;
    if (args.ok) {
      const responseCaseId = args.responseCaseId?.trim().slice(0, 200) || undefined;
      await ctx.db.patch(row._id, {
        state: "delivered",
        claimId: undefined,
        claimedAt: undefined,
        leaseExpiresAt: undefined,
        lastError: undefined,
        deliveredAt: now,
        responseCaseId,
        updatedAt: now,
      });
      await ctx.db.insert("consultant_partner_delivery_attempts", {
        outboxId: row._id,
        eventId,
        claimId: args.claimId,
        attemptNumber: row.attempts,
        phase: "delivered",
        occurredAt: now,
        httpStatus: args.httpStatus,
        responseCaseId,
        responseBytes: args.responseBytes,
      });

      if (row.status === "received") {
        const request = await ctx.db.get(row.expertRequestId);
        if (
          request &&
          request.dispatchOpen !== false &&
          request.completedAt == null &&
          request.revokedAt == null &&
          request.deliveryStatus !== "expired"
        ) {
          await ctx.db.patch(request._id, {
            externalCaseId: responseCaseId ?? String(request._id),
            deliveryStatus: "delivered",
            deliveredAt: now,
            deliveryError: undefined,
            updatedAt: now,
          });
        }
      }
      return { accepted: true, state: "delivered" as const };
    }

    const error = (args.error?.trim() || "Partner delivery failed").slice(0, 500);
    await ctx.db.insert("consultant_partner_delivery_attempts", {
      outboxId: row._id,
      eventId,
      claimId: args.claimId,
      attemptNumber: row.attempts,
      phase: "failed",
      occurredAt: now,
      httpStatus: args.httpStatus,
      error,
      responseBytes: args.responseBytes,
    });

    if (row.attempts < MAX_DELIVERY_ATTEMPTS) {
      const delayMs = Math.min(
        RETRY_BASE_MS * 2 ** Math.max(0, row.attempts - 1),
        RETRY_MAX_MS,
      );
      await ctx.db.patch(row._id, {
        state: "pending",
        claimId: undefined,
        claimedAt: undefined,
        leaseExpiresAt: undefined,
        lastError: error,
        nextAttemptAt: now + delayMs,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(delayMs, internal.consultant_partner_sync.deliverPartnerOutbox, {
        outboxId: row._id,
      });
      return { accepted: true, state: "pending" as const };
    }

    await ctx.db.patch(row._id, {
      state: "exhausted",
      claimId: undefined,
      claimedAt: undefined,
      leaseExpiresAt: undefined,
      lastError: error,
      exhaustedNotifiedAt: now,
      updatedAt: now,
    });
    const request = await ctx.db.get(row.expertRequestId);
    if (request) {
      if (row.status === "received" && request.dispatchOpen !== false) {
        await ctx.db.patch(request._id, {
          deliveryStatus: "failed",
          deliveryError: error,
          updatedAt: now,
        });
      }
      await ctx.db.insert("auditLogs", {
        userId: request.requestedBy,
        action: "consultant_partner_delivery_exhausted",
        details: {
          assessmentId: request.assessmentId,
          expertRequestId: request._id,
          outboxId: row._id,
          eventId,
          eventType: row.eventType,
          status: row.status,
          partnerSlug: row.partnerSlug,
          attempts: row.attempts,
          error,
        },
        timestamp: now,
        archived: false,
      });
      const assessment = await ctx.db.get(request.assessmentId);
      await notify(ctx, {
        event: "export_controls.consultant_delivery_failed",
        userId: request.requestedBy,
        orgId: assessment?.orgId,
        title: `Consultant delivery failed for ${assessment?.reference ?? "export review"}`,
        body: "Automatic delivery attempts were exhausted. The retained review can be retried.",
        sourceTable: "consultant_partner_status_outbox",
        sourceId: String(row._id),
        metadata: {
          assessmentId: String(request.assessmentId),
          expertRequestId: String(request._id),
          eventId,
          status: row.status,
        },
        dedupeKey: `consultant-delivery-exhausted:${eventId}`,
      });
    }
    return { accepted: true, state: "exhausted" as const };
  },
});

async function deliverClaimedOutbox(ctx: any, args: { outboxId: Id<"consultant_partner_status_outbox"> }) {
  const row = await ctx.runMutation(internal.consultant_partner_sync.claimPartnerDelivery, args);
  if (!row) return { ok: false, skipped: true };
  const result = await sendPartnerEvent({
    partnerSlug: row.partnerSlug,
    eventKind: row.eventKind,
    status: row.status,
    rawBody: row.rawBody,
    claimId: row.claimId,
  });
  await ctx.runMutation(internal.consultant_partner_sync.recordPartnerDeliveryResult, {
    outboxId: row._id,
    claimId: row.claimId,
    ok: result.ok,
    error: result.error,
    httpStatus: result.httpStatus,
    responseCaseId: result.responseCaseId,
    responseBytes: result.responseBytes,
  });
  return result;
}

export const deliverPartnerOutbox = internalAction({
  args: { outboxId: v.id("consultant_partner_status_outbox") },
  handler: deliverClaimedOutbox,
});

/** Compatibility name for already-scheduled calls created before the unified outbox. */
export const deliverStatusOutbox = internalAction({
  args: { outboxId: v.id("consultant_partner_status_outbox") },
  handler: deliverClaimedOutbox,
});

export const listDueStatusOutbox = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("consultant_partner_status_outbox")
      .withIndex("by_state_next_attempt", (q) =>
        q.eq("state", "pending").lte("nextAttemptAt", now),
      )
      .take(MAX_SWEEP_BATCH);
    const stale = await ctx.db
      .query("consultant_partner_status_outbox")
      .withIndex("by_state_lease_expiry", (q) =>
        q.eq("state", "delivering").lte("leaseExpiresAt", now),
      )
      .take(Math.max(0, MAX_SWEEP_BATCH - pending.length));
    return [...pending, ...stale].slice(0, MAX_SWEEP_BATCH);
  },
});

interface LapsedDispatch {
  expertRequestId: Id<"expert_requests">;
  assessmentId: Id<"export_assessments">;
  externalSystem: string;
  externalCaseId: string;
}

/** Dispatches past expiry, bounded and selected through an expiry index. */
export const listLapsedDispatches = internalQuery({
  args: {},
  handler: async (ctx): Promise<LapsedDispatch[]> => {
    const now = Date.now();
    const current = await ctx.db
      .query("expert_requests")
      .withIndex("by_dispatch_open_expiry", (q) =>
        q.eq("dispatchOpen", true).lte("expiresAt", now),
      )
      .take(MAX_EXPIRY_BATCH);
    const legacy =
      current.length < MAX_EXPIRY_BATCH
        ? await ctx.db
            .query("expert_requests")
            .withIndex("by_dispatch_open_expiry", (q) =>
              q.eq("dispatchOpen", undefined).lte("expiresAt", now),
            )
            .take(MAX_EXPIRY_BATCH - current.length)
        : [];

    return [...current, ...legacy]
      .filter(
        (request) =>
          request.reasonCode === "consultant_dispatch" &&
          typeof request.externalSystem === "string" &&
          request.externalSystem.length > 0 &&
          request.completedAt == null &&
          request.revokedAt == null &&
          request.deliveryStatus !== "expired",
      )
      .map((request) => ({
        expertRequestId: request._id,
        assessmentId: request.assessmentId,
        externalSystem: request.externalSystem as string,
        externalCaseId: String(request._id),
      }));
  },
});

export const markDispatchExpired = internalMutation({
  args: { expertRequestId: v.id("expert_requests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.expertRequestId);
    if (
      !request ||
      request.completedAt ||
      request.revokedAt ||
      request.deliveryStatus === "expired"
    ) {
      return;
    }

    const now = Date.now();
    await ctx.db.patch(args.expertRequestId, {
      status: "expired",
      deliveryStatus: "expired",
      dispatchOpen: false,
      updatedAt: now,
    });
    await closeConsultantCredentials(ctx, {
      expertRequestId: args.expertRequestId,
      assessmentId: request.assessmentId,
      terminalState: "expired",
      terminalAt: now,
    });
    if (request.externalSystem) {
      await enqueuePartnerCaseStatus(ctx, {
        expertRequestId: request._id,
        partnerSlug: request.externalSystem,
        status: "expired",
        now,
      });
    }
    await ctx.db.insert("auditLogs", {
      userId: "system",
      action: "consultant_dispatch_expired",
      details: {
        assessmentId: request.assessmentId,
        expertRequestId: args.expertRequestId,
        externalSystem: request.externalSystem,
        externalCaseId: request.externalCaseId,
      },
      timestamp: now,
      archived: false,
    });
  },
});

/** Bounded expiry and delivery recovery sweep. */
export const expireLapsedDispatches = internalAction({
  args: {},
  handler: async (ctx): Promise<{ expired: number; deliveriesStarted: number }> => {
    const lapsed: LapsedDispatch[] = await ctx.runQuery(
      internal.consultant_partner_sync.listLapsedDispatches,
      {},
    );
    for (const dispatch of lapsed) {
      await ctx.runMutation(internal.consultant_partner_sync.markDispatchExpired, {
        expertRequestId: dispatch.expertRequestId,
      });
    }
    const due = await ctx.runQuery(internal.consultant_partner_sync.listDueStatusOutbox, {});
    for (const row of due) {
      await ctx.runAction(internal.consultant_partner_sync.deliverPartnerOutbox, {
        outboxId: row._id,
      });
    }
    return { expired: lapsed.length, deliveriesStarted: due.length };
  },
});

/** Retained direct status surface; callers should normally enqueue instead. */
export const pushCaseStatus = internalAction({
  args: {
    partnerSlug: v.string(),
    externalCaseId: v.string(),
    status: PARTNER_STATUS,
  },
  handler: async (_ctx, args): Promise<PartnerDeliveryResult> => {
    const id = crypto.randomUUID();
    return await sendPartnerEvent({
      partnerSlug: args.partnerSlug,
      eventKind: args.status === "received" ? "initial" : "status",
      status: args.status,
      claimId: crypto.randomUUID(),
      rawBody: JSON.stringify({
        eventId: id,
        eventType:
          args.status === "received"
            ? "consultant.case.created"
            : "consultant.case.status_changed",
        occurredAt: Date.now(),
        sequence: 1,
        source: sourceSlug(),
        externalCaseId: args.externalCaseId,
        status: args.status,
      }),
    });
  },
});
