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
    
    if (args.mrn && args.mrn !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
        .first();
    }
    
    if (!declaration && args.conversationId && args.conversationId !== "UNKNOWN") {
      declaration = await ctx.db
        .query("declarations")
        .filter((q) => q.eq(q.field("conversationId"), args.conversationId))
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

      const patchObj: any = {
        status: newStatus,
        lastUpdated: Date.now()
      };

      if (args.mrn && args.mrn !== "UNKNOWN" && !declaration.mrn) {
        patchObj.mrn = args.mrn;
      }

      await ctx.db.patch(declaration._id, patchObj);
      
      // Audit log entry for status change
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
    let results: any[] = [];
    
    if (args.mrn && args.mrn !== "UNKNOWN") {
      results = await ctx.db
        .query("notifications")
        .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn!))
        .collect();
    }
    
    if (results.length === 0 && args.conversationId) {
      results = await ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("conversationId"), args.conversationId))
        .collect();
    }
    
    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
