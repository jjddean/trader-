import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isCancellationRejected,
  isInvalidationAccepted,
  isPostCancelClearance,
} from "./lib/notification_dms_context";
import { statusAfterNotification } from "./lib/notification_status";
import type { MutationCtx } from "./_generated/server";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";
import { assertIngestSecret } from "./lib/secret_compare";
import { canAccessDeclaration, orgIdFromDeclaration } from "./lib/org_access";
import { notify } from "./lib/notify";
import { eventForNotification, titleForNotification } from "./lib/notification_events";

const hmrcEnvironment = v.union(v.literal("sandbox"), v.literal("production"));

/** Same lookup order saveWebhook uses below: conversationId, then MRN. */
async function resolveDeclarationForNotification(
  ctx: { db: MutationCtx["db"] },
  args: { conversationId?: string; mrn?: string },
) {
  if (args.conversationId && args.conversationId !== "UNKNOWN") {
    const byConversation = await ctx.db
      .query("declarations")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();
    if (byConversation) return byConversation;
  }
  if (args.mrn && args.mrn !== "UNKNOWN") {
    return await ctx.db
      .query("declarations")
      .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
      .first();
  }
  return null;
}

export const saveWebhook = mutation({
  args: {
    ingestSecret: v.string(),
    mrn: v.string(),
    conversationId: v.string(),
    notificationType: v.string(),
    environment: v.optional(hmrcEnvironment),
    idempotencyKey: v.optional(v.string()),
    errorCodes: v.optional(v.array(v.string())),
    fieldErrors: v.optional(v.array(v.object({
      field: v.string(),
      code: v.optional(v.string()),
      reason: v.string(),
    }))),
    rawPayload: v.string(),
    timestamp: v.string(),
    source: v.optional(v.string()),
    hmrcNotificationId: v.optional(v.string()),
    issueDateTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertIngestSecret(args.ingestSecret);

    // Dedupe by HMRC notificationId first — stable across push/pull channels.
    if (args.hmrcNotificationId) {
      const existingByNotifId = await ctx.db
        .query("notifications")
        .withIndex("by_hmrcNotificationId", (q) => q.eq("hmrcNotificationId", args.hmrcNotificationId))
        .first();
      if (existingByNotifId) {
        await ctx.runMutation(internal.audit.logAction, {
          userId: existingByNotifId.userId || "",
          action: "notification_dedup",
          metadata: { reason: "hmrcNotificationId", id: existingByNotifId._id, incoming: { conversationId: args.conversationId, notificationType: args.notificationType } },
        });
        return existingByNotifId._id;
      }
    }

    // Dedupe by idempotency key if provided
    if (args.idempotencyKey) {
      const existingByIdemp = await ctx.db
        .query("notifications")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existingByIdemp) {
        await ctx.runMutation(internal.audit.logAction, {
          userId: existingByIdemp.userId || "",
          action: "notification_dedup",
          metadata: { reason: "idempotencyKey", id: existingByIdemp._id, incoming: { conversationId: args.conversationId, notificationType: args.notificationType } },
        });
        return existingByIdemp._id;
      }
    }

    // Dedupe by conversationId + type + timestamp
    if (args.conversationId && args.notificationType && args.timestamp) {
      const existingByConv = await ctx.db
        .query("notifications")
        .withIndex("by_conv_type_ts", (q) =>
          q.eq("conversationId", args.conversationId).eq("notificationType", args.notificationType).eq("timestamp", args.timestamp),
        )
        .first();
      if (existingByConv) {
        await ctx.runMutation(internal.audit.logAction, {
          userId: existingByConv.userId || "",
          action: "notification_dedup",
          metadata: { reason: "conv_type_ts", id: existingByConv._id, incoming: { idempotencyKey: args.idempotencyKey } },
        });
        return existingByConv._id;
      }
    }

    // HMRC issues a distinct conversationId per request, so the submissions row
    // sharing it names the operation this notification answers.
    const originatingSubmission =
      args.conversationId && args.conversationId !== "UNKNOWN"
        ? await ctx.db
            .query("submissions")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .first()
        : null;
    // CNS follow-ups record no conversationId (the CSP returns only X-CSP-ID), so
    // the join above is impossible for exactly the declarations that need it.
    // Fall back to the declaration's own state: beginFollowUp sets
    // "Cancellation Requested" atomically before dispatch and releases it only on
    // a definite outcome, so nothing else can put a declaration in that state.
    // INFERENCE about our own state machine — not a documented HMRC rule.
    // See docs/hmrc/ACTIVE/tdr/errors-handled.md, 2026-08-15.
    let originatingOperation = originatingSubmission?.operation;
    if (!originatingOperation) {
      const pending = await resolveDeclarationForNotification(ctx, args);
      if (String(pending?.status ?? "") === "Cancellation Requested") {
        originatingOperation = "cancel";
      }
    }

    const notificationId = await ctx.db.insert("notifications", {
      mrn: args.mrn,
      conversationId: args.conversationId,
      ...(originatingOperation ? { originatingOperation } : {}),
      environment: args.environment ?? "sandbox",
      idempotencyKey: args.idempotencyKey,
      hmrcNotificationId: args.hmrcNotificationId,
      source: args.source,
      timestamp: args.timestamp,
      issueDateTime: args.issueDateTime,
      notificationType: args.notificationType,
      errorCodes: args.errorCodes || [],
      fieldErrors: args.fieldErrors || [],
      rawPayload: args.rawPayload,
      processed: false,
    });

    let declaration = null;
    let foundByConversationId = false;

    // Look up by conversationId first — most reliable link after 202
    if (args.conversationId && args.conversationId !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
        .first();
      if (declaration) foundByConversationId = true;
    }

    // Fall back to MRN lookup (for notifications where conversationId isn't stored yet)
    if (!declaration && args.mrn && args.mrn !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
        .first();
    }

    if (declaration) {
      const declMrn = String(declaration.mrn ?? "").trim();
      const notifMrn = String(args.mrn ?? "").trim();
      // conversationId is the authoritative link after a 202. When the
      // declaration was found that way, a new HMRC-assigned MRN must always be
      // trusted (re-submit assigns a fresh MRN). Only guard MRN-fallback lookups.
      const mrnMismatch =
        !foundByConversationId &&
        declMrn.length > 0 &&
        notifMrn.length > 0 &&
        notifMrn !== "UNKNOWN" &&
        notifMrn !== declMrn;

      const hasResolvedMrn =
        (args.mrn && args.mrn !== "UNKNOWN") ||
        (declaration.mrn && String(declaration.mrn).trim().length > 0);
      const amendRejected = isAmendmentRejected({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
        fieldErrors: args.fieldErrors,
        errorCodes: args.errorCodes,
      });
      const amendAccepted = isAmendmentAccepted({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
        fieldErrors: args.fieldErrors,
        errorCodes: args.errorCodes,
      });
      const amendAcknowledged = isAmendmentAcknowledged({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
        fieldErrors: args.fieldErrors,
        errorCodes: args.errorCodes,
      });
      const invAccepted = isInvalidationAccepted({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
        fieldErrors: args.fieldErrors,
        errorCodes: args.errorCodes,
        originatingOperation,
      });
      const postCancelCle = isPostCancelClearance({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
      });
      const cancelRejected = isCancellationRejected({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
        originatingOperation,
      });
      if (!mrnMismatch) {
        const newStatus = statusAfterNotification({
          currentStatus: declaration.status,
          notificationType: args.notificationType,
          hasResolvedMrn,
          isAmendmentRejected: amendRejected,
          isAmendmentAccepted: amendAccepted,
          isAmendmentAcknowledged: amendAcknowledged,
          isCancellationRejected: cancelRejected,
          isInvalidationAccepted: invAccepted,
          isPostCancelClearance: postCancelCle,
        });

        const patchObj: Record<string, string | number> = {
          status: newStatus,
          lastUpdated: Date.now(),
        };

        // Always sync the CDS-assigned MRN back to the declaration when HMRC provides one.
        if (args.mrn && args.mrn !== "UNKNOWN") {
          patchObj.mrn = args.mrn;
        }

        await ctx.db.patch(declaration._id, patchObj);

        await ctx.runMutation(internal.declarations.upsertDeclarationPreview, {
          declarationId: declaration._id,
        });

        await ctx.runMutation(internal.audit.logAction, {
          userId: declaration.userId,
          action: "declaration_status_updated",
          metadata: {
            declarationId: declaration._id,
            mrn: args.mrn,
            newStatus: newStatus,
            notificationType: args.notificationType,
          },
        });

        // Mirror into the in-app inbox. This row is derived and disposable — the
        // evidence stays on the `notifications` row inserted above, which this
        // points back to via sourceId. Emitted only when the correlation held
        // (no MRN mismatch), so a suspect link never raises a user-facing alert.
        const event = eventForNotification({
          notificationType: args.notificationType,
          isAmendmentAccepted: amendAccepted,
          isAmendmentRejected: amendRejected,
          isCancellationRejected: cancelRejected,
          isInvalidationAccepted: invAccepted,
        });
        const errorCodes = args.errorCodes ?? [];
        await notify(ctx, {
          event,
          userId: declaration.userId,
          orgId: orgIdFromDeclaration(declaration),
          title: titleForNotification(event, args.notificationType),
          body: errorCodes.length > 0
            ? `${declaration.mrn || args.mrn || "Declaration"} — ${errorCodes.slice(0, 3).join(", ")}`
            : (args.mrn && args.mrn !== "UNKNOWN" ? `MRN ${args.mrn}` : undefined),
          href: `/dashboard/declarations/${declaration._id}/status`,
          declarationId: declaration._id,
          sourceTable: "notifications",
          sourceId: notificationId,
          // One inbox row per evidence row. Guards the backfill in
          // convex/notifications_backfill.ts against double-writing a mirror.
          dedupeKey: `hmrc:${notificationId}`,
          metadata: {
            notificationType: args.notificationType,
            newStatus,
            errorCodes: errorCodes.slice(0, 10),
          },
        });
      }

      await ctx.db.patch(notificationId, {
        userId: declaration.userId,
        declarationId: declaration._id,
        orgId: orgIdFromDeclaration(declaration),
        environment: args.environment ?? declaration.environment ?? "sandbox",
      });
    }
  }
});

export const getWebhooks = query({
  args: {
    mrn: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    declarationId: v.optional(v.id("declarations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        return [];
      }
    }

    return collectDeclarationNotifications(ctx.db, {
      declarationId: args.declarationId,
      conversationId: args.conversationId,
      mrn: args.mrn,
    });
  },
});
