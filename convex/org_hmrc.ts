import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/user_role";

export type OrgHmrcMode = "practice" | "live";

function readOrgIdFromIdentity(identity: Record<string, unknown>): string {
  const raw = identity.org_id ?? identity.orgId;
  return typeof raw === "string" ? raw.trim() : "";
}

function assertOrgSession(orgId: string, identity: Record<string, unknown>) {
  const sessionOrg = readOrgIdFromIdentity(identity);
  if (!sessionOrg || sessionOrg !== orgId.trim()) {
    throw new Error("Organisation context required");
  }
}

export const getModeForOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const orgId = args.orgId.trim();
    if (!orgId) return { hmrcMode: "practice" as const, hasSandboxTestUser: false };

    const row = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    const hmrcMode = (row?.hmrcMode ?? "practice") as OrgHmrcMode;
    const hasSandboxTestUser = Boolean(
      row?.sandboxTestUserId?.trim() && row?.sandboxTestUserPassword?.trim(),
    );

    return { hmrcMode, hasSandboxTestUser };
  },
});

export const getSandboxTestUserForOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const orgId = args.orgId.trim();
    if (!orgId) return null;

    assertOrgSession(orgId, identity as Record<string, unknown>);

    const row = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    if (!row || row.hmrcMode === "live") return null;

    const userId = row.sandboxTestUserId?.trim() || "";
    const password = row.sandboxTestUserPassword?.trim() || "";
    if (!userId || !password) return null;

    return {
      userId,
      password,
      createdAt: row.sandboxTestUserCreatedAt ?? null,
    };
  },
});

export const getModeForDeclaration = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration) return null;

    const orgId = typeof declaration.orgId === "string" ? declaration.orgId.trim() : "";
    if (!orgId) return { hmrcMode: "practice" as const, orgId: null as string | null };

    const row = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    return { hmrcMode: (row?.hmrcMode ?? "practice") as OrgHmrcMode, orgId };
  },
});

/** Ensure org defaults to practice on first touch (sign-up / sync). */
export const ensurePracticeMode = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const orgId = args.orgId.trim();
    if (!orgId) return { hmrcMode: "practice" as const, created: false };

    const existing = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    if (existing) {
      return { hmrcMode: existing.hmrcMode as OrgHmrcMode, created: false };
    }

    await ctx.db.insert("org_hmrc_settings", {
      orgId,
      hmrcMode: "practice",
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    });

    return { hmrcMode: "practice" as const, created: true };
  },
});

/** Store HMRC sandbox Test User credentials for a practice org (server-provisioned). */
export const saveSandboxTestUser = mutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const orgId = args.orgId.trim();
    const userId = args.userId.trim();
    const password = args.password.trim();
    if (!orgId || !userId || !password) throw new Error("Invalid sandbox test user payload");

    assertOrgSession(orgId, identity as Record<string, unknown>);

    const existing = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    const hmrcMode = (existing?.hmrcMode ?? "practice") as OrgHmrcMode;
    if (hmrcMode === "live") {
      throw new Error("Cannot store sandbox test user on a live organisation");
    }

    const patch = {
      sandboxTestUserId: userId,
      sandboxTestUserPassword: password,
      sandboxTestUserCreatedAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("org_hmrc_settings", {
        orgId,
        hmrcMode: "practice",
        ...patch,
      });
    }

    return { orgId, userId };
  },
});

export const setOrgMode = mutation({
  args: {
    orgId: v.string(),
    hmrcMode: v.union(v.literal("practice"), v.literal("live")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const orgId = args.orgId.trim();
    if (!orgId) throw new Error("orgId required");

    const existing = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    const identity = await ctx.auth.getUserIdentity();
    const patch = {
      hmrcMode: args.hmrcMode,
      updatedAt: Date.now(),
      updatedBy: identity?.subject,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("org_hmrc_settings", { orgId, ...patch });
    }

    return { orgId, hmrcMode: args.hmrcMode };
  },
});
