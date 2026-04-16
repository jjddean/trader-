import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

export const saveWebhook = mutation({
  args: {
    mrn: v.string(),
    conversationId: v.string(),
    notificationType: v.string(),
    errorCodes: v.optional(v.array(v.string())),
    fieldErrors: v.optional(v.array(v.object({
      field: v.string(),
      code: v.optional(v.string()),
      reason: v.string(),
    }))),
    rawPayload: v.string(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      mrn: args.mrn,
      conversationId: args.conversationId,
      timestamp: args.timestamp,
      notificationType: args.notificationType,
      errorCodes: args.errorCodes || [],
      fieldErrors: args.fieldErrors || [],
      rawPayload: args.rawPayload,
      processed: false,
    });

    let declaration = null;

    // Look up by conversationId first — most reliable link after 202
    if (args.conversationId && args.conversationId !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
        .first();
    }

    // Fall back to MRN lookup (for notifications where conversationId isn't stored yet)
    if (!declaration && args.mrn && args.mrn !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
        .first();
    }

    if (declaration) {
      let newStatus = declaration.status;
      const hasResolvedMrn =
        (args.mrn && args.mrn !== "UNKNOWN") ||
        (declaration.mrn && String(declaration.mrn).trim().length > 0);
      if (args.notificationType === "DMSUB") newStatus = "Submitted";
      if (args.notificationType === "DMSACC") newStatus = hasResolvedMrn ? "Accepted" : "Submitted";
      if (args.notificationType === "DMSCLE") newStatus = hasResolvedMrn ? "Cleared" : "Submitted";
      if (args.notificationType === "DMSROG") newStatus = "Action Required";
      if (args.notificationType === "DMSREJ") newStatus = "Rejected";
      if (args.notificationType === "DMSINV") newStatus = "Invalid";

      const patchObj: Record<string, string | number> = {
        status: newStatus,
        lastUpdated: Date.now()
      };

      // Always sync the CDS-assigned MRN back to the declaration when HMRC provides one.
      // Overwrite any locally-set draft MRN so the declaration MRN matches what CDS issued.
      if (args.mrn && args.mrn !== "UNKNOWN") {
        patchObj.mrn = args.mrn;
      }

      await ctx.db.patch(declaration._id, patchObj);

      await ctx.runMutation(api.audit.logAction, {
        userId: declaration.userId,
        action: "declaration_status_updated",
        metadata: {
          declarationId: declaration._id,
          mrn: args.mrn,
          newStatus: newStatus,
          notificationType: args.notificationType
        }
      });

      await ctx.db.patch(notificationId, {
        userId: declaration.userId,
        declarationId: declaration._id
      });
    }
  }
});

export const getWebhooks = query({
  args: { mrn: v.optional(v.string()), conversationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const seen = new Set<string>();
    const results: any[] = [];

    // Always query both — conversationId is the more reliable link post-submission
    if (args.conversationId) {
      const convResults = await ctx.db
        .query("notifications")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId!))
        .take(100);
      for (const n of convResults) {
        if (!seen.has(n._id)) { seen.add(n._id); results.push(n); }
      }
    }

    if (args.mrn && args.mrn !== "UNKNOWN") {
      const mrnResults = await ctx.db
        .query("notifications")
        .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn!))
        .take(100);
      for (const n of mrnResults) {
        if (!seen.has(n._id)) { seen.add(n._id); results.push(n); }
      }
    }

    return results.sort(
      (a, b) => new Date(String(b.timestamp || 0)).getTime() - new Date(String(a.timestamp || 0)).getTime()
    );
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
