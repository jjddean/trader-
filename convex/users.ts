import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserRole, resolveUserRole } from "./lib/user_role";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserRole(ctx);
    if (!currentUser) return null;

    const { dbUser, role, email, identity } = currentUser;

    return {
      ...(dbUser ?? {}),
      clerkId: identity.subject,
      email: email ?? dbUser?.email,
      role,
    };
  },
});

export const syncUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    orgId: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const role = resolveUserRole(
      args.role,
      typeof existing?.role === "string" ? existing.role : undefined,
      args.email,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        orgId: args.orgId,
        ...(role !== undefined && { role }),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      email: args.email,
      orgId: args.orgId,
      role,
    });
  },
});
