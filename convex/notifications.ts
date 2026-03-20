import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const saveWebhook = mutation({
  args: {
    mrn: v.string(),
    conversationId: v.string(),
    notificationType: v.string(),
    rawPayload: v.string(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Save the incoming webhook to the notifications log
    const notificationId = await ctx.db.insert("notifications", {
      mrn: args.mrn,
      conversationId: args.conversationId,
      timestamp: args.timestamp,
      notificationType: args.notificationType,
      rawPayload: args.rawPayload,
      processed: false,
    });
    
    // 2. Try to find the linked declaration by MRN or ConversationId
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
        
    // 3. Update its status based on the business-level async response from HMRC
    if (declaration) {
      let newStatus = declaration.status;
      if (args.notificationType === "CLEARED") newStatus = "Cleared";
      if (args.notificationType === "REJECTED") newStatus = "Rejected";
      if (args.notificationType === "ACCEPTED") newStatus = "Accepted";
      if (args.notificationType === "GOODS_ARRIVED") newStatus = "Goods Arrived";
      if (args.notificationType === "HELD") newStatus = "Held";
      if (args.notificationType === "DOCUMENTS_REQUIRED") newStatus = "Documents Required";

      const patchObj: any = {
        status: newStatus,
        lastUpdated: Date.now()
      };

      // If webhook has an MRN and the declaration does not, save it.
      if (args.mrn && args.mrn !== "UNKNOWN" && !declaration.mrn) {
        patchObj.mrn = args.mrn;
      }

      await ctx.db.patch(declaration._id, patchObj);
      
      // Update the webhook with the userId so we can query it easily on the DB for the dashboard bell
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
    
    // Sort descending by timestamp
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

