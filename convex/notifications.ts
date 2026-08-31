import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isCancellationRejected,
  isInvalidationAccepted,
  isSubmitReceipt,
  isPostCancelClearance,
} from "./lib/notification_dms_context";
import { statusAfterNotification } from "./lib/notification_status";
import type { MutationCtx } from "./_generated/server";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";
import { assertIngestSecret } from "./lib/secret_compare";
import { canAccessDeclaration, orgIdFromDeclaration } from "./lib/org_access";
import { notify } from "./lib/notify";
import { eventForNotification, titleForNotification } from "./lib/notification_events";
import { parseHmrcNotification } from "./lib/hmrc_notification_parser";

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
    functionCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertIngestSecret(args.ingestSecret);

    const parsed = parseHmrcNotification(args.rawPayload);
    const notificationType = parsed.notificationType;
    const functionCode = parsed.functionCode || args.functionCode;
    const mrn = parsed.mrn !== "UNKNOWN" ? parsed.mrn : args.mrn;
    const errorCodes = parsed.errorCodes.length > 0 ? parsed.errorCodes : args.errorCodes;
    const fieldErrors = parsed.fieldErrors.length > 0 ? parsed.fieldErrors : args.fieldErrors;
    const issueDateTime = parsed.issueDateTime || args.issueDateTime;

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
    if (args.conversationId && notificationType && args.timestamp) {
      const existingByConv = await ctx.db
        .query("notifications")
        .withIndex("by_conv_type_ts", (q) =>
          q.eq("conversationId", args.conversationId).eq("notificationType", notificationType).eq("timestamp", args.timestamp),
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
      mrn,
      conversationId: args.conversationId,
      ...(originatingOperation ? { originatingOperation } : {}),
      ...(functionCode ? { functionCode } : {}),
      environment: args.environment ?? "sandbox",
      idempotencyKey: args.idempotencyKey,
      hmrcNotificationId: args.hmrcNotificationId,
      source: args.source,
      timestamp: args.timestamp,
      issueDateTime,
      notificationType,
      errorCodes: errorCodes || [],
      fieldErrors: fieldErrors || [],
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
    if (!declaration && mrn && mrn !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .withIndex("by_mrn", (q) => q.eq("mrn", mrn))
        .first();
    }

    if (declaration) {
      const declMrn = String(declaration.mrn ?? "").trim();
      const notifMrn = String(mrn ?? "").trim();
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
        (mrn && mrn !== "UNKNOWN") ||
        (declaration.mrn && String(declaration.mrn).trim().length > 0);
      const dmsCtx = {
        notificationType,
        rawPayload: args.rawPayload,
        fieldErrors,
        errorCodes,
      };
      const amendRejected = isAmendmentRejected(dmsCtx);
      const amendAccepted = isAmendmentAccepted(dmsCtx);
      const amendAcknowledged = isAmendmentAcknowledged(dmsCtx);
      const invAccepted = isInvalidationAccepted({
        ...dmsCtx,
        originatingOperation,
      });
      const submitReceipt = isSubmitReceipt({
        ...dmsCtx,
        originatingOperation,
      });
      const postCancelCle = isPostCancelClearance(dmsCtx);
      const cancelRejected = isCancellationRejected({
        notificationType,
        rawPayload: args.rawPayload,
        originatingOperation,
      });
      if (!mrnMismatch) {
        const newStatus = statusAfterNotification({
          currentStatus: declaration.status,
          notificationType,
          hasResolvedMrn,
          isAmendmentRejected: amendRejected,
          isAmendmentAccepted: amendAccepted,
          isAmendmentAcknowledged: amendAcknowledged,
          isCancellationRejected: cancelRejected,
          isInvalidationAccepted: invAccepted,
          isSubmitReceipt: submitReceipt,
          isPostCancelClearance: postCancelCle,
        });

        const patchObj: Record<string, string | number> = {
          status: newStatus,
          lastUpdated: Date.now(),
        };

        if (mrn && mrn !== "UNKNOWN") {
          patchObj.mrn = mrn;
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
            mrn,
            newStatus: newStatus,
            notificationType,
            functionCode,
          },
        });

        const event = eventForNotification({
          notificationType,
          isAmendmentAccepted: amendAccepted,
          isAmendmentRejected: amendRejected,
          isCancellationRejected: cancelRejected,
          isInvalidationAccepted: invAccepted,
        });
        const codes = errorCodes ?? [];
        await notify(ctx, {
          event,
          userId: declaration.userId,
          orgId: orgIdFromDeclaration(declaration),
          title: titleForNotification(event, notificationType),
          body: codes.length > 0
            ? `${declaration.mrn || mrn || "Declaration"} — ${codes.slice(0, 3).join(", ")}`
            : (mrn && mrn !== "UNKNOWN" ? `MRN ${mrn}` : undefined),
          href: `/dashboard/declarations/${declaration._id}/status`,
          declarationId: declaration._id,
          sourceTable: "notifications",
          sourceId: notificationId,
          dedupeKey: `hmrc:${notificationId}`,
          metadata: {
            notificationType,
            newStatus,
            errorCodes: codes.slice(0, 10),
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
