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
    await ctx.db.insert("notifications", {
      mrn: args.mrn,
      conversationId: args.conversationId,
      timestamp: args.timestamp,
      notificationType: args.notificationType,
      rawPayload: args.rawPayload,
      processed: false,
    });
    
    // 2. Try to find the linked declaration by MRN and update its status
    if (args.mrn !== "UNKNOWN") {
      const declaration = await ctx.db
        .query("declarations")
        .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
        .first();
        
      if (declaration) {
        let newStatus = declaration.status;
        if (args.notificationType === "CLEARED") newStatus = "Cleared";
        if (args.notificationType === "REJECTED") newStatus = "Rejected";
        if (args.notificationType === "ACCEPTED") newStatus = "Accepted";

        await ctx.db.patch(declaration._id, {
          status: newStatus,
          lastUpdated: Date.now()
        });
      }
    }
  }
});

export const getWebhooksForMrn = query({
  args: { mrn: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
      .order("desc")
      .collect();
  },
});
