import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/user_role";

export type OrgHmrcMode = "practice" | "live";

export const getModeForOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const orgId = args.orgId.trim();
    if (!orgId) return { hmrcMode: "practice" as const };

    const row = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    return { hmrcMode: (row?.hmrcMode ?? "practice") as OrgHmrcMode };
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
    if (!orgId) return { hmrcMode: "practice" as const };

    const existing = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();

    if (existing) return { hmrcMode: existing.hmrcMode as OrgHmrcMode };

    await ctx.db.insert("org_hmrc_settings", {
      orgId,
      hmrcMode: "practice",
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    });

    return { hmrcMode: "practice" as const };
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
