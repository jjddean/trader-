import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getActiveOrgId } from "./lib/org_access";
import { evaluateOrgLiveReadiness } from "./lib/org_live_readiness";
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

    const declOrgId = typeof declaration.orgId === "string" ? declaration.orgId.trim() : "";
    const sessionOrgId = (await getActiveOrgId(ctx, identity.subject)) ?? "";
    const orgId = declOrgId || sessionOrgId;
    if (!orgId) return { hmrcMode: "practice" as const, orgId: null as string | null };

    const row = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    return { hmrcMode: (row?.hmrcMode ?? "practice") as OrgHmrcMode, orgId };
  },
});

function shortOrgId(orgId: string): string {
  if (orgId.length <= 22) return orgId;
  return `${orgId.slice(0, 14)}…${orgId.slice(-6)}`;
}

function orgDisplayLabel(orgId: string, orgName?: string, memberEmail?: string): string {
  const name = orgName?.trim();
  if (name) return name;
  const email = memberEmail?.trim();
  if (email) return email;
  return shortOrgId(orgId);
}

/** Ensure org defaults to practice on first touch (sign-up / sync). */
export const ensurePracticeMode = mutation({
  args: {
    orgId: v.string(),
    orgName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const orgId = args.orgId.trim();
    if (!orgId) return { hmrcMode: "practice" as const, created: false };

    const orgName = args.orgName?.trim() || undefined;

    const existing = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    if (existing) {
      if (orgName && existing.orgName !== orgName) {
        await ctx.db.patch(existing._id, { orgName });
      }
      return { hmrcMode: existing.hmrcMode as OrgHmrcMode, created: false };
    }

    await ctx.db.insert("org_hmrc_settings", {
      orgId,
      ...(orgName ? { orgName } : {}),
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

export const getLiveReadinessForOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await evaluateOrgLiveReadiness(ctx, args.orgId);
  },
});

export const setOrgMode = mutation({
  args: {
    orgId: v.string(),
    hmrcMode: v.union(v.literal("practice"), v.literal("live")),
    orgName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const orgId = args.orgId.trim();
    if (!orgId) throw new Error("orgId required");

    if (args.hmrcMode === "live") {
      const readiness = await evaluateOrgLiveReadiness(ctx, orgId);
      if (!readiness.canProceed) {
        throw new Error(`Cannot enable live CDS: ${readiness.blockers.join(" ")}`);
      }
    }

    const orgName = args.orgName?.trim() || undefined;

    const existing = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    const identity = await ctx.auth.getUserIdentity();
    const patch = {
      hmrcMode: args.hmrcMode,
      updatedAt: Date.now(),
      updatedBy: identity?.subject,
      ...(orgName ? { orgName } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("org_hmrc_settings", { orgId, ...patch });
    }

    return { orgId, hmrcMode: args.hmrcMode };
  },
});

/** Platform admin: all known Clerk orgs and CDS mode (no header switcher required). */
export const listOrganisationsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [settings, declarations, users] = await Promise.all([
      ctx.db.query("org_hmrc_settings").take(500),
      ctx.db.query("declarations").take(3000),
      ctx.db.query("users").take(500),
    ]);

    const memberEmailByOrg = new Map<string, string>();
    for (const user of users) {
      const orgId = typeof user.orgId === "string" ? user.orgId.trim() : "";
      const email = typeof user.email === "string" ? user.email.trim() : "";
      if (!orgId || !email || memberEmailByOrg.has(orgId)) continue;
      memberEmailByOrg.set(orgId, email);
    }

    const orgMap = new Map<
      string,
      {
        hmrcMode: OrgHmrcMode;
        updatedAt: number;
        hasSettingsRow: boolean;
        orgName?: string;
        memberEmail?: string;
      }
    >();

    for (const row of settings) {
      orgMap.set(row.orgId, {
        hmrcMode: row.hmrcMode as OrgHmrcMode,
        updatedAt: row.updatedAt,
        hasSettingsRow: true,
        orgName: typeof row.orgName === "string" ? row.orgName.trim() : undefined,
        memberEmail: memberEmailByOrg.get(row.orgId),
      });
    }

    for (const decl of declarations) {
      const orgId = typeof decl.orgId === "string" ? decl.orgId.trim() : "";
      if (!orgId || orgMap.has(orgId)) continue;
      orgMap.set(orgId, {
        hmrcMode: "practice",
        updatedAt: 0,
        hasSettingsRow: false,
        memberEmail: memberEmailByOrg.get(orgId),
      });
    }

    return [...orgMap.entries()]
      .map(([orgId, meta]) => {
        const memberEmail = meta.memberEmail ?? memberEmailByOrg.get(orgId);
        return {
          orgId,
          ...meta,
          memberEmail,
          displayLabel: orgDisplayLabel(orgId, meta.orgName, memberEmail),
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt || a.displayLabel.localeCompare(b.displayLabel));
  },
});
