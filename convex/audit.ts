import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const logAction = mutation({
  args: {
    action: v.string(),
    userId: v.string(),
    entityId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
      archived: false,
    });
  },
});

export const getRecentLogs = query({
  handler: async (ctx) => {
    return await ctx.db.query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

export const getOldLogs = query({
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return await ctx.db.query("auditLogs")
      .withIndex("by_timestamp", q => q.lt("timestamp", thirtyDaysAgo))
      .filter(q => q.neq(q.field("archived"), true))
      .take(1000);
  }
});

export const markArchived = internalMutation({
  args: { logIds: v.array(v.id("auditLogs")) },
  handler: async (ctx, args) => {
    for (const id of args.logIds) {
      await ctx.db.patch(id, { archived: true });
    }
  }
});


