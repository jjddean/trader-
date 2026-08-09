import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import {
  readCnsNotificationConfig,
  validateCnsNotificationConfig,
} from "./lib/cns_config";
import {
  acknowledgeBatch,
  getNotificationBatch,
  getTopicConsumer,
  notificationErrorCode,
  parseConsumerEndpoint,
  sendHeartbeat,
} from "./lib/cns_notification_client";
import {
  buildAcknowledgementXml,
  classifyCnsNotification,
  decodeCnsBody,
  hashCnsBody,
  header,
  parseCnsBatch,
} from "./lib/cns_envelope";
import { analyseInventoryRejection } from "./lib/cns_inventory_reject";
import { parseHmrcNotification } from "./lib/hmrc_notification_parser";
import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isInvalidationAccepted,
  isPostCancelClearance,
} from "./lib/notification_dms_context";
import { statusAfterNotification } from "./lib/notification_status";

/**
 * CNS notification ingestion.
 *
 * The ordering below is not a style choice — it is the contract in Notification
 * APIs v1.0.3 §10, tightened in that version specifically to say notifications
 * are acknowledged once PERSISTED, not once processed:
 *
 *   lease topic → GET batch → persist every envelope → DELETE-ack → parse
 *
 * Acknowledging before persisting risks permanent loss: CNS may delete an
 * acknowledged message at any point and is not required to redeliver it.
 * Acknowledging only after parsing risks the opposite failure — a parser defect
 * would cause endless redelivery of the same batch. Persist-then-ack-then-parse
 * is the only ordering that loses nothing and blocks nothing.
 */

const LEASE_OWNER_PREFIX = "convex-poller";

// ---------------------------------------------------------------------------
// Poll state and leasing
// ---------------------------------------------------------------------------

/**
 * Claim exclusive consumption of the topic.
 *
 * Only one poller may read a topic: querying a new batch before acknowledging
 * the previous one causes the unacknowledged messages to reappear in the next
 * batch (Notification APIs v1.0.3 §7).
 */
export const acquireTopicLease = internalMutation({
  args: { topic: v.string(), owner: v.string(), leaseSeconds: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("cns_poll_state")
      .withIndex("by_topic", (q) => q.eq("topic", args.topic))
      .first();

    if (!existing) {
      await ctx.db.insert("cns_poll_state", {
        topic: args.topic,
        leaseOwner: args.owner,
        leaseExpiresAt: now + args.leaseSeconds * 1000,
        lastPollAt: now,
        consecutiveFailures: 0,
        mode: "pull",
        updatedAt: now,
      });
      return true;
    }

    // A live lease held by someone else means another poller is mid-batch.
    if (
      existing.leaseOwner &&
      existing.leaseOwner !== args.owner &&
      (existing.leaseExpiresAt ?? 0) > now
    ) {
      return false;
    }

    // Respect the 30s floor after an empty poll.
    if ((existing.nextPollAt ?? 0) > now) return false;

    await ctx.db.patch(existing._id, {
      leaseOwner: args.owner,
      leaseExpiresAt: now + args.leaseSeconds * 1000,
      lastPollAt: now,
      updatedAt: now,
    });
    return true;
  },
});

export const releaseTopicLease = internalMutation({
  args: {
    topic: v.string(),
    owner: v.string(),
    nextPollAfterSeconds: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await ctx.db
      .query("cns_poll_state")
      .withIndex("by_topic", (q) => q.eq("topic", args.topic))
      .first();
    if (!state) return null;
    // Never clear a lease another poller has since taken.
    if (state.leaseOwner && state.leaseOwner !== args.owner) return null;

    await ctx.db.patch(state._id, {
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      nextPollAt: now + args.nextPollAfterSeconds * 1000,
      ...(args.success
        ? { lastSuccessAt: now, consecutiveFailures: 0, lastError: undefined }
        : {
            consecutiveFailures: (state.consecutiveFailures ?? 0) + 1,
            lastError: args.error?.slice(0, 1000),
          }),
      updatedAt: now,
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Durable persistence
// ---------------------------------------------------------------------------

/**
 * Insert one envelope, deduplicated on topic + notification id.
 *
 * Returns false when the row already existed: duplicate delivery is expected
 * (any batch not fully acknowledged is redelivered) and must not produce a
 * second timeline event.
 */
export const persistNotification = internalMutation({
  args: {
    topic: v.string(),
    notificationId: v.string(),
    partition: v.optional(v.number()),
    queuedDateTime: v.optional(v.string()),
    headers: v.any(),
    contentType: v.optional(v.string()),
    notificationType: v.optional(v.string()),
    bodyBase64: v.string(),
    bodyHash: v.optional(v.string()),
    cspId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    badgeId: v.optional(v.string()),
  },
  returns: v.object({ inserted: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cns_notifications")
      .withIndex("by_topic_and_notificationId", (q) =>
        q.eq("topic", args.topic).eq("notificationId", args.notificationId),
      )
      .first();
    if (existing) return { inserted: false };

    const now = Date.now();
    await ctx.db.insert("cns_notifications", {
      ...args,
      persistedAt: now,
      createdAt: now,
    });
    return { inserted: true };
  },
});

export const markAcknowledged = internalMutation({
  args: { topic: v.string(), notificationIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const notificationId of args.notificationIds) {
      const row = await ctx.db
        .query("cns_notifications")
        .withIndex("by_topic_and_notificationId", (q) =>
          q.eq("topic", args.topic).eq("notificationId", notificationId),
        )
        .first();
      if (row && !row.ackedAt) {
        await ctx.db.patch(row._id, { ackedAt: now });
      }
    }
    return null;
  },
});

/** Rows persisted but not yet parsed. Replay source after a parser defect. */
export const getUnprocessed = internalQuery({
  args: { topic: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cns_notifications")
      .withIndex("by_topic_and_processedAt", (q) =>
        q.eq("topic", args.topic).eq("processedAt", undefined),
      )
      .take(args.limit);
  },
});

// ---------------------------------------------------------------------------
// Correlation and processing
// ---------------------------------------------------------------------------

/**
 * Resolve which declaration a notification belongs to.
 *
 * Order matters. On an inventory pre-check rejection there is no ConversationID
 * and the MRN is blank, so X-CSP-ID and the LRN are the only usable keys —
 * hence they are tried first.
 */
async function resolveDeclarationId(
  ctx: { db: any },
  keys: { cspId?: string; functionalReferenceId?: string; conversationId?: string },
): Promise<Id<"declarations"> | undefined> {
  if (keys.cspId) {
    const byCsp = await ctx.db
      .query("declarations")
      .withIndex("by_cnsCspId", (q: any) => q.eq("cnsCspId", keys.cspId))
      .first();
    if (byCsp) return byCsp._id;

    const attempt = await ctx.db
      .query("submissions")
      .withIndex("by_cspId", (q: any) => q.eq("cspId", keys.cspId))
      .first();
    if (attempt) return attempt.declarationId;
  }

  if (keys.functionalReferenceId) {
    // The LRN is the permanent correlation key and is unchanged across
    // amendment and cancellation.
    const attempt = await ctx.db
      .query("submissions")
      .withIndex("by_lrn", (q: any) => q.eq("lrn", keys.functionalReferenceId))
      .first();
    if (attempt) return attempt.declarationId;
  }

  if (keys.conversationId) {
    const byConv = await ctx.db
      .query("declarations")
      .withIndex("by_conversationId", (q: any) => q.eq("conversationId", keys.conversationId))
      .first();
    if (byConv) return byConv._id;
  }

  return undefined;
}

/**
 * Apply one persisted notification.
 *
 * Idempotent: a row already carrying processedAt returns immediately, so
 * duplicate delivery produces no second timeline event.
 */
export const processNotification = internalMutation({
  args: { rowId: v.id("cns_notifications") },
  returns: v.object({ processed: v.boolean(), outcome: v.string() }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.rowId);
    if (!row) return { processed: false, outcome: "missing" };
    if (row.processedAt) return { processed: false, outcome: "already_processed" };

    const now = Date.now();

    let decoded: string;
    try {
      decoded = decodeCnsBody(row.bodyBase64).text;
    } catch (error) {
      // The raw body stays persisted; this row can be replayed once fixed.
      await ctx.db.patch(row._id, {
        parserError: `decode failed: ${error instanceof Error ? error.message : String(error)}`,
        parseAttempts: (row.parseAttempts ?? 0) + 1,
      });
      return { processed: false, outcome: "decode_error" };
    }

    const type = classifyCnsNotification(
      { id: row.notificationId, headers: row.headers ?? {}, bodyBase64: row.bodyBase64 },
      decoded,
    );

    const finish = async (outcome: string, extra: Record<string, unknown> = {}) => {
      await ctx.db.patch(row._id, {
        bodyDecoded: decoded.slice(0, 200000),
        notificationType: type,
        processedAt: now,
        parserError: undefined,
        ...extra,
      });
      return { processed: true, outcome };
    };

    if (type === "HEARTBEAT") {
      return await finish("heartbeat");
    }

    if (type === "CILE") {
      // Inventory-linked exports are a later phase. Retained, never discarded —
      // these are the samples the export parser will be built against.
      return await finish("unsupported_phase_2");
    }

    const inventory = analyseInventoryRejection(decoded, row.headers ?? {});
    const declarationId = await resolveDeclarationId(ctx, {
      cspId: row.cspId,
      functionalReferenceId: inventory.functionalReferenceId || row.functionalReferenceId,
      conversationId: row.conversationId,
    });

    if (!declarationId) {
      // Correlation failure is not a parse failure. The row stays available and
      // an operator can match it by hand; marking it processed would hide it.
      await ctx.db.patch(row._id, {
        bodyDecoded: decoded.slice(0, 200000),
        notificationType: type,
        functionalReferenceId: inventory.functionalReferenceId || undefined,
        parserError: "uncorrelated: no declaration matched CSP-ID, LRN or ConversationID",
        parseAttempts: (row.parseAttempts ?? 0) + 1,
      });
      return { processed: false, outcome: "uncorrelated" };
    }

    if (inventory.isInventoryPreCheck) {
      // The declaration never reached CDS. This is NOT an HMRC rejection and
      // must never be shown as one — the remediation is the inventory record.
      await ctx.db.patch(declarationId, {
        cnsInventoryState: "inventory_rejected",
        cnsTransportState: "inventory_rejected",
        cnsInventoryErrorCode: inventory.validationCode || undefined,
        cnsInventoryIrcCode: inventory.ircCode || undefined,
        cnsInventoryErrorMessage: inventory.ircDescription || undefined,
        cnsLastNotificationAt: now,
        lastUpdated: now,
      });
      return await finish("inventory_rejected", {
        declarationId,
        functionalReferenceId: inventory.functionalReferenceId || undefined,
      });
    }

    // API notifications are CSP transport responses; DMS notifications are the
    // legal declaration outcome and must enter the normal declaration timeline.
    if (type === "DMS") {
      const parsed = parseHmrcNotification(decoded);
      const declaration = await ctx.db.get(declarationId);
      if (!declaration) throw new Error("Correlated declaration was deleted");

      // Any DMS response proves the CNS inventory pre-check completed and the
      // declaration reached CDS. Its CDS outcome is tracked separately below.
      await ctx.db.patch(declarationId, {
        cnsInventoryState: "passed",
        cnsTransportState: "cds_response_received",
        cnsLastNotificationAt: now,
        lastUpdated: now,
      });

      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_hmrcNotificationId", (q: any) => q.eq("hmrcNotificationId", row.notificationId))
        .first();
      if (!existing) {
        const notificationId = await ctx.db.insert("notifications", {
          mrn: parsed.mrn,
          conversationId: row.conversationId || "UNKNOWN",
          environment: declaration.environment ?? "sandbox",
          idempotencyKey: `cns:${row.topic}:${row.notificationId}`,
          hmrcNotificationId: row.notificationId,
          source: "cns",
          timestamp: parsed.issueDateTime || row.queuedDateTime || new Date(now).toISOString(),
          issueDateTime: parsed.issueDateTime,
          notificationType: parsed.notificationType,
          errorCodes: parsed.errorCodes,
          fieldErrors: parsed.fieldErrors,
          rawPayload: decoded,
          processed: false,
          userId: declaration.userId,
          declarationId,
          orgId: declaration.orgId,
        });

        const context = {
          notificationType: parsed.notificationType,
          rawPayload: decoded,
          fieldErrors: parsed.fieldErrors,
          errorCodes: parsed.errorCodes,
        };
        const newStatus = statusAfterNotification({
          currentStatus: declaration.status,
          notificationType: parsed.notificationType,
          hasResolvedMrn: parsed.mrn !== "UNKNOWN" || Boolean(declaration.mrn),
          isAmendmentRejected: isAmendmentRejected(context),
          isAmendmentAccepted: isAmendmentAccepted(context),
          isAmendmentAcknowledged: isAmendmentAcknowledged(context),
          isInvalidationAccepted: isInvalidationAccepted(context),
          isPostCancelClearance: isPostCancelClearance(context),
        });
        await ctx.db.patch(declarationId, {
          status: newStatus,
          ...(parsed.mrn !== "UNKNOWN" ? { mrn: parsed.mrn } : {}),
          cnsLastNotificationAt: now,
          lastUpdated: now,
        });
        await ctx.db.patch(notificationId, { processed: true });
      } else {
        // Parser replays must refresh previously persisted operator-facing
        // details without creating a duplicate timeline event.
        await ctx.db.patch(existing._id, {
          mrn: parsed.mrn,
          notificationType: parsed.notificationType,
          errorCodes: parsed.errorCodes,
          fieldErrors: parsed.fieldErrors,
          rawPayload: decoded,
          processed: true,
        });
      }
      // The declarations table uses a cached preview. Refresh it after this
      // transaction so the list reflects the DMS status shown on the detail page.
      await ctx.scheduler.runAfter(0, internal.declarations.refreshDeclarationPreviewInternal, {
        declarationId,
      });
    } else {
      await ctx.db.patch(declarationId, {
        cnsLastNotificationAt: now,
        lastUpdated: now,
      });
    }

    return await finish(type === "API" ? "api_response" : "dms", {
      declarationId,
      functionalReferenceId: inventory.functionalReferenceId || undefined,
    });
  },
});

/** Operations replay: raw envelopes are retained so parser improvements can be reapplied safely. */
export const resetNotificationForReplay = internalMutation({
  args: { rowId: v.id("cns_notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.rowId);
    if (!row) throw new Error("CNS notification not found");
    await ctx.db.patch(row._id, { processedAt: undefined, parserError: undefined });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Preflight: confirm the topic is in pull mode.
 *
 * A configured push consumer locks batch reads (423), so this must pass before
 * the poller is enabled.
 */
export const checkTopicConsumer = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.number(), detail: v.string() }),
  handler: async () => {
    const config = readCnsNotificationConfig();
    const errors = validateCnsNotificationConfig(config);
    if (errors.length > 0) {
      return { ok: false, status: 0, detail: errors.join("; ") };
    }

    const result = await getTopicConsumer(config);

    // 404 means no consumer record at all, which is fine for pull.
    if (result.status === 404) {
      return { ok: true, status: 404, detail: "No push consumer configured — pull is available." };
    }

    if (!result.ok) {
      return { ok: false, status: result.status, detail: result.body.slice(0, 500) };
    }

    // A consumer record commonly exists but is blank. Only a populated
    // endpointUrl actually locks the topic.
    const endpoint = parseConsumerEndpoint(result.body);
    if (endpoint) {
      return {
        ok: false,
        status: result.status,
        detail: `A push consumer IS configured on this topic (${endpoint}). Batch reads will return 423 LOCKED_PUSH_MESSAGING_ACTIVE until it is removed.`,
      };
    }

    return {
      ok: true,
      status: result.status,
      detail: "Consumer record present but empty — pull is available.",
    };
  },
});

export const sendTopicHeartbeat = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.number() }),
  handler: async () => {
    const config = readCnsNotificationConfig();
    const errors = validateCnsNotificationConfig(config);
    if (errors.length > 0) throw new Error(`CNS configuration invalid: ${errors.join("; ")}`);
    const result = await sendHeartbeat(config);
    return { ok: result.ok, status: result.status };
  },
});

/**
 * One poll cycle: lease → fetch → persist → acknowledge → schedule parsing.
 */
export const pollTopic = internalAction({
  args: {},
  returns: v.object({
    polled: v.boolean(),
    received: v.number(),
    persisted: v.number(),
    acknowledged: v.number(),
    /** Raw batch HTTP status — distinguishes an empty topic (204) from a 200 whose body did not parse. */
    httpStatus: v.optional(v.number()),
    bodyLength: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    const idle = { polled: false, received: 0, persisted: 0, acknowledged: 0 };
    const config = readCnsNotificationConfig();
    if (!config.enabled || config.mode !== "pull") return idle;

    const errors = validateCnsNotificationConfig(config);
    if (errors.length > 0) {
      console.error("[CNS-POLL] Configuration invalid:", errors.join("; "));
      return idle;
    }

    const owner = `${LEASE_OWNER_PREFIX}-${Date.now().toString(36)}`;
    const leased = await ctx.runMutation(internal.cns_notifications.acquireTopicLease, {
      topic: config.topic,
      owner,
      leaseSeconds: config.pollLeaseSeconds,
    });
    if (!leased) return idle;

    let nextPollAfterSeconds = config.pollIntervalSeconds;
    let success = false;
    let failure: string | undefined;
    let received = 0;
    let persisted = 0;
    let acknowledged = 0;

    try {
      const batch = await getNotificationBatch(config);

      if (batch.status === 204) {
        // Empty topic. The 30s floor applies before the next read.
        success = true;
        return {
          polled: true,
          received: 0,
          persisted: 0,
          acknowledged: 0,
          httpStatus: 204,
          bodyLength: 0,
        };
      }

      if (!batch.ok) {
        const code = notificationErrorCode(batch.body);
        failure = `batch ${batch.status} ${code}`;
        if (batch.status === 423) {
          console.error(
            "[CNS-POLL] Topic is locked because a push consumer is active. Pull is unavailable until it is removed.",
          );
        }
        return {
          polled: true,
          received: 0,
          persisted: 0,
          acknowledged: 0,
          httpStatus: batch.status,
          bodyLength: batch.body.length,
        };
      }

      const parsed = parseCnsBatch(batch.body);
      received = parsed.notifications.length;
      if (received === 0) {
        // A 200 with no parseable notifications is NOT the same as an empty
        // topic — it means the envelope shape differs from what we parse.
        if (batch.body.trim().length > 0) {
          console.warn(
            `[CNS-POLL] 200 with a ${batch.body.length}-byte body but no notifications parsed. Body starts: ${batch.body.slice(0, 300)}`,
          );
        }
        success = true;
        return {
          polled: true,
          received: 0,
          persisted: 0,
          acknowledged: 0,
          httpStatus: batch.status,
          bodyLength: batch.body.length,
        };
      }

      // Persist EVERY envelope before acknowledging any of them.
      const persistedIds: string[] = [];
      for (const envelope of parsed.notifications) {
        if (!envelope.id) continue;
        const result = await ctx.runMutation(internal.cns_notifications.persistNotification, {
          topic: config.topic,
          notificationId: envelope.id,
          partition: envelope.partition,
          queuedDateTime: envelope.queuedDateTime,
          headers: envelope.headers,
          contentType: header(envelope.headers, "Content-Type"),
          bodyBase64: envelope.bodyBase64,
          bodyHash: hashCnsBody(envelope.bodyBase64),
          cspId: header(envelope.headers, "X-CSP-ID"),
          conversationId: header(envelope.headers, "ConversationID"),
          badgeId: header(envelope.headers, "X-Badge-ID"),
        });
        if (result.inserted) persisted += 1;
        // Duplicates are acknowledged too — the row is already durable.
        persistedIds.push(envelope.id);
      }

      if (persistedIds.length > 0) {
        const ack = await acknowledgeBatch(config, buildAcknowledgementXml(persistedIds));
        if (ack.ok) {
          await ctx.runMutation(internal.cns_notifications.markAcknowledged, {
            topic: config.topic,
            notificationIds: persistedIds,
          });
          acknowledged = persistedIds.length;
          // A new batch may be requested immediately after a successful ack.
          nextPollAfterSeconds = 0;
          success = true;
        } else {
          // Nothing is lost: the batch stays unacknowledged and is redelivered,
          // and the rows are already persisted and deduplicated.
          failure = `ack ${ack.status} ${notificationErrorCode(ack.body)}`;
        }
      }

      await ctx.scheduler.runAfter(0, internal.cns_notifications.processPending, {});

      return {
        polled: true,
        received,
        persisted,
        acknowledged,
        httpStatus: batch.status,
        bodyLength: batch.body.length,
      };
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      return { polled: true, received, persisted, acknowledged };
    } finally {
      await ctx.runMutation(internal.cns_notifications.releaseTopicLease, {
        topic: config.topic,
        owner,
        nextPollAfterSeconds,
        success,
        error: failure,
      });
    }
  },
});

/** Parse persisted rows. Safe to re-run; processed rows are skipped. */
export const processPending = internalAction({
  args: {},
  returns: v.object({ processed: v.number(), failed: v.number() }),
  handler: async (ctx) => {
    const config = readCnsNotificationConfig();
    if (!config.topic) return { processed: 0, failed: 0 };

    const rows = await ctx.runQuery(internal.cns_notifications.getUnprocessed, {
      topic: config.topic,
      limit: 50,
    });

    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const result = await ctx.runMutation(internal.cns_notifications.processNotification, {
          rowId: row._id,
        });
        if (result.processed) processed += 1;
        else if (result.outcome !== "already_processed") failed += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed, failed };
  },
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

async function pollHealth(ctx: { db: any }) {
  const config = readCnsNotificationConfig();
  if (!config.topic) return null;

  const state = await ctx.db
    .query("cns_poll_state")
    .withIndex("by_topic", (q: any) => q.eq("topic", config.topic))
    .first();

  // What has actually ARRIVED, not just whether the last poll found anything.
  //
  // A poll returning zero means only that the topic was empty at that instant —
  // the scheduled poller may have consumed the batch seconds earlier. Reading
  // poll counts alone made a working integration look broken. Health must answer
  // "is anything coming in", which is a question about received rows.
  const recent = await ctx.db
    .query("cns_notifications")
    .withIndex("by_topic_and_ackedAt", (q: any) => q.eq("topic", config.topic))
    .order("desc")
    .take(20);

  const lastReceived = recent[0];
  const unacknowledged = recent.filter((row: any) => !row.ackedAt).length;
  const unprocessed = recent.filter((row: any) => !row.processedAt).length;
  const withParserErrors = recent.filter((row: any) => row.parserError).length;

  return {
    topic: config.topic,
    enabled: config.enabled,
    mode: config.mode,
    lastSuccessAt: state?.lastSuccessAt ?? null,
    lastPollAt: state?.lastPollAt ?? null,
    consecutiveFailures: state?.consecutiveFailures ?? 0,
    lastError: state?.lastError ?? null,
    alerting: (state?.consecutiveFailures ?? 0) >= config.maxConsecutiveFailuresBeforeAlert,
    // Receipt evidence — the answer to "is the integration alive".
    lastNotificationAt: lastReceived?.persistedAt ?? null,
    lastNotificationId: lastReceived?.notificationId ?? null,
    lastNotificationType: lastReceived?.notificationType ?? null,
    recentCount: recent.length,
    unacknowledged,
    unprocessed,
    withParserErrors,
  };
}

/** Poller health for operational scripts and crons (no user identity). */
export const getPollHealthInternal = internalQuery({
  args: {},
  handler: async (ctx) => pollHealth(ctx),
});

/** Poller health for the integration status surface. */
export const getPollHealth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return pollHealth(ctx);
  },
});
