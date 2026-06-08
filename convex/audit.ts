import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const logAction = mutation({
  args: {
    action: v.string(),
    userId: v.string(),
    entityId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { metadata, ...rest } = args;
    return await ctx.db.insert("auditLogs", {
      ...rest,
      details: metadata,
      timestamp: Date.now(),
      archived: false,
    });
  },
});

// Owner-scoped audit retrieval. Unlike getRecentLogs/getOldLogs (which require
// an admin `role` claim that the standard Clerk JWT may not carry), this lets a
// signed-in user read THEIR OWN audit trail — so submission evidence is always
// retrievable through the app, not just by an admin.
export const getMyLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(args.limit ?? 200);
  },
});

/** Owner-scoped audit rows for one declaration (metadata.declarationId match). */
export const getDeclarationAuditLogs = query({
  args: {
    declarationId: v.id("declarations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || decl.userId !== identity.subject) return [];

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(500);

    const target = String(args.declarationId);
    return logs
      .filter((log) => {
        const details = log.details;
        if (!details || typeof details !== "object") return false;
        return String((details as { declarationId?: string }).declarationId ?? "") === target;
      })
      .slice(0, args.limit ?? 50);
  },
});

export const getRecentLogs = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Unauthorized access to system audit logs.");
    }
    return await ctx.db.query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});


export const getOldLogs = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Unauthorized access to system audit logs.");
    }
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
    await Promise.all(args.logIds.map((id) => ctx.db.patch(id, { archived: true })));
  }
});


