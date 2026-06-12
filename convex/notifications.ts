import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  isAmendmentAccepted,
  isAmendmentAcknowledged,
  isAmendmentRejected,
  isInvalidationAccepted,
  isPostCancelClearance,
} from "./lib/notification_dms_context";
import { statusAfterNotification } from "./lib/notification_status";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";

export const saveWebhook = mutation({
  args: {
    mrn: v.string(),
    conversationId: v.string(),
    notificationType: v.string(),
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
    // Dedupe by HMRC notificationId first — stable across push/pull channels.
    if (args.hmrcNotificationId) {
      const existingByNotifId = await ctx.db
        .query("notifications")
        .withIndex("by_hmrcNotificationId", (q) => q.eq("hmrcNotificationId", args.hmrcNotificationId))
        .first();
      if (existingByNotifId) {
        await ctx.runMutation(api.audit.logAction, {
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
        await ctx.runMutation(api.audit.logAction, {
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
        await ctx.runMutation(api.audit.logAction, {
          userId: existingByConv.userId || "",
          action: "notification_dedup",
          metadata: { reason: "conv_type_ts", id: existingByConv._id, incoming: { idempotencyKey: args.idempotencyKey } },
        });
        return existingByConv._id;
      }
    }

    const notificationId = await ctx.db.insert("notifications", {
      mrn: args.mrn,
      conversationId: args.conversationId,
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
      });
      const postCancelCle = isPostCancelClearance({
        notificationType: args.notificationType,
        rawPayload: args.rawPayload,
      });
      if (!mrnMismatch) {
        const newStatus = statusAfterNotification({
          currentStatus: declaration.status,
          notificationType: args.notificationType,
          hasResolvedMrn,
          isAmendmentRejected: amendRejected,
          isAmendmentAccepted: amendAccepted,
          isAmendmentAcknowledged: amendAcknowledged,
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

        await ctx.runMutation(api.audit.logAction, {
          userId: declaration.userId,
          action: "declaration_status_updated",
          metadata: {
            declarationId: declaration._id,
            mrn: args.mrn,
            newStatus: newStatus,
            notificationType: args.notificationType,
          },
        });
      }

      await ctx.db.patch(notificationId, {
        userId: declaration.userId,
        declarationId: declaration._id,
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
    return collectDeclarationNotifications(ctx.db, {
      declarationId: args.declarationId,
      conversationId: args.conversationId,
      mrn: args.mrn,
    });
  },
});

export const getUserNotifications = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(15);
  },
});
