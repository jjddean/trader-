import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getWorkspaces = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // 1. Get owned workspaces
    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .take(100);

    // 2. Get member workspaces
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(200);

    const memberWorkspaces = await Promise.all(
      memberships.map((m) => ctx.db.get(m.workspaceId))
    );

    // Combine and deduplicate
    const allWorkspaces = [...owned, ...memberWorkspaces.filter(Boolean)];
    const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map((w) => [w!._id, w])).values());

    return uniqueWorkspaces;
  },
});

export const getWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workspaceId);
  },
});

export const createWorkspace = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      ownerId: args.userId,
    });

    // Automatically make the creator an admin member
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: args.userId,
      role: "admin",
    });

    return workspaceId;
  },
});

export const updateWorkspaceConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    eoriNumber: v.optional(v.string()),
    hmrcTokensId: v.optional(v.id("hmrc_tokens")),
  },
  handler: async (ctx, args) => {
    const { workspaceId, ...updates } = args;
    await ctx.db.patch(workspaceId, updates);
    return workspaceId;
  },
});
