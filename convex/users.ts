import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUserRole, resolveUserRole } from "./lib/user_role";
import { getActiveOrgId } from "./lib/org_access";
import { normalizeEmail } from "./lib/signed_in_email";
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

/**
 * Sync the Clerk profile into the users row.
 *
 * `role` and `email` are NOT taken from the caller. Both previously flowed
 * straight into resolveUserRole, which grants "admin" for a role string of
 * "admin" or an address in ADMIN_EMAILS — so any signed-in user could call this
 * with role "admin" and read every tenant's data. Both now come from the Clerk
 * identity, which the caller cannot forge.
 *
 * `role` remains an accepted argument only so existing callers keep compiling;
 * its value is ignored.
 */
export const syncUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    orgId: v.optional(v.string()),
    /** @deprecated Ignored. Role is resolved from the Clerk JWT. */
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();

    // Identity only — never args.
    const claims = identity as unknown as Record<string, unknown>;
    const jwtRole = typeof claims.role === "string" ? claims.role : undefined;
    const identityEmail =
      typeof identity.email === "string" ? identity.email : undefined;

    const role = resolveUserRole(
      jwtRole,
      typeof existing?.role === "string" ? existing.role : undefined,
      identityEmail,
    );

    // Prefer Clerk session org from JWT; client sync is fallback for display/history.
    const jwtOrg =
      typeof (identity as Record<string, unknown>).org_id === "string"
        ? String((identity as Record<string, unknown>).org_id).trim()
        : "";
    const sessionOrgId = jwtOrg || args.orgId;

    // The stored email is what resolveSignedInEmail falls back to when binding a
    // portal, so prefer the verified claim over the submitted value.
    const email = identityEmail ?? args.email;
    const emailNormalized = normalizeEmail(email);

    if (existing) {
      const roleUnchanged = role === undefined || existing.role === role;
      const unchanged =
        existing.name === args.name &&
        existing.email === email &&
        existing.emailNormalized === emailNormalized &&
        existing.orgId === sessionOrgId &&
        roleUnchanged &&
        existing.legacyClaimedForOrgId === undefined;

      if (!unchanged) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          email,
          emailNormalized,
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
      email,
      emailNormalized,
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

/**
 * Populate `emailNormalized` on rows written before the field existed.
 *
 * The portal-email guard in clients.setPortalAccess reads it by index. Rows
 * without it are invisible to that lookup, so a broker could set a portal email
 * that belongs to a FreightCode account.
 */
export const backfillEmailNormalized = internalMutation({
  args: { dryRun: v.optional(v.boolean()), limit: v.optional(v.number()) },
  returns: v.object({
    dryRun: v.boolean(),
    scanned: v.number(),
    patched: v.number(),
    alreadySet: v.number(),
    noEmail: v.number(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const rows = await ctx.db.query("users").take(args.limit ?? 5000);

    let patched = 0;
    let alreadySet = 0;
    let noEmail = 0;

    for (const row of rows) {
      if (row.emailNormalized) {
        alreadySet += 1;
        continue;
      }
      const normalized = normalizeEmail(typeof row.email === "string" ? row.email : undefined);
      if (!normalized) {
        noEmail += 1;
        continue;
      }
      if (!dryRun) await ctx.db.patch(row._id, { emailNormalized: normalized });
      patched += 1;
    }

    return { dryRun, scanned: rows.length, patched, alreadySet, noEmail };
  },
});
