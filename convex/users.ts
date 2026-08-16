import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUserRole, resolveUserRole } from "./lib/user_role";
import { getActiveOrgId } from "./lib/org_access";
import { unauthenticatedError } from "./lib/user_errors";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserRole(ctx);
    if (!currentUser) return null;

    const { dbUser, role, email, identity } = currentUser;
    const activeOrgId = await getActiveOrgId(ctx, identity.subject);

    return {
      ...(dbUser ?? {}),
      clerkId: identity.subject,
      email: email ?? dbUser?.email,
      role,
      activeOrgId,
      tenantMode: activeOrgId ? "org" : "personal",
      personalMigratedAt: dbUser?.personalMigratedAt,
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
    if (!identity) throw unauthenticatedError();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const role = resolveUserRole(
      args.role,
      typeof existing?.role === "string" ? existing.role : undefined,
      args.email,
    );

    // Prefer Clerk session org from JWT; client sync is fallback for display/history.
    const jwtOrg =
      typeof (identity as Record<string, unknown>).org_id === "string"
        ? String((identity as Record<string, unknown>).org_id).trim()
        : "";
    const sessionOrgId = jwtOrg || args.orgId;

    if (existing) {
      const roleUnchanged = role === undefined || existing.role === role;
      const unchanged =
        existing.name === args.name &&
        existing.email === args.email &&
        existing.orgId === sessionOrgId &&
        roleUnchanged &&
        existing.legacyClaimedForOrgId === undefined;

      if (!unchanged) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          email: args.email,
          orgId: sessionOrgId,
          ...(role !== undefined && { role }),
          legacyClaimedForOrgId: undefined,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      email: args.email,
      orgId: sessionOrgId,
      role,
    });
  },
});

/** One-shot: remove deprecated legacyClaimedForOrgId from all user rows. */
export const stripLegacyClaimedForOrgId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("users").collect();
    let patched = 0;
    for (const row of rows) {
      if (row.legacyClaimedForOrgId !== undefined) {
        await ctx.db.patch(row._id, { legacyClaimedForOrgId: undefined });
        patched += 1;
      }
    }
    return { patched, scanned: rows.length };
  },
});
