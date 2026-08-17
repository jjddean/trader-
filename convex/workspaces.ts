/** @deprecated Legacy Convex workspaces — use Clerk orgs (`orgId` on records). Kept for existing DB rows only. */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

async function requireWorkspaceAccess(
  ctx: { db: any },
  workspaceId: any,
  userId: string,
) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw userError("workspace_not_found", "Workspace not found");
  if (workspace.ownerId === userId) return workspace;

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("workspaceId"), workspaceId))
    .first();

  if (!membership) throw forbiddenError();
  return workspace;
}

export const getWorkspaces = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;

    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .take(100);

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);

    const memberWorkspaces = await Promise.all(
      memberships.map((m) => ctx.db.get(m.workspaceId)),
    );

    const allWorkspaces = [...owned, ...memberWorkspaces.filter(Boolean)];
    return Array.from(new Map(allWorkspaces.map((w) => [w!._id, w])).values());
  },
});

export const getWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    try {
      return await requireWorkspaceAccess(ctx, args.workspaceId, identity.subject);
    } catch {
      return null;
    }
  },
});

export const createWorkspace = mutation({
  args: {
    name: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      ownerId: identity.subject,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: identity.subject,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    await requireWorkspaceAccess(ctx, args.workspaceId, identity.subject);

    const { workspaceId, ...updates } = args;
    await ctx.db.patch(workspaceId, updates);
    return workspaceId;
  },
});
