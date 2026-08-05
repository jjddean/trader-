import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getActiveOrgId, isPersonalScopedRecord, resolveOrgIdForNewRecord } from "./lib/org_access";

type Ctx = QueryCtx | MutationCtx;

async function canAccess(ctx: Ctx, userId: string, lane: Doc<"trade_lanes"> | null) {
  if (!lane) return false;
  if (lane.userId === userId) return true;
  const orgId = await getActiveOrgId(ctx, userId);
  return Boolean(orgId && lane.orgId === orgId);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const orgId = await getActiveOrgId(ctx, identity.subject);
    if (orgId) {
      return ctx.db.query("trade_lanes").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").take(200);
    }
    const rows = await ctx.db.query("trade_lanes").withIndex("by_user", (q) => q.eq("userId", identity.subject)).order("desc").take(200);
    return rows.filter((lane) => isPersonalScopedRecord(lane.orgId));
  },
});

export const get = query({
  args: { laneId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const laneId = ctx.db.normalizeId("trade_lanes", args.laneId);
    if (!laneId) return null;
    const lane = await ctx.db.get(laneId);
    return (await canAccess(ctx, identity.subject, lane)) ? lane : null;
  },
});

const laneFields = {
  code: v.string(),
  originName: v.string(),
  originCountryCode: v.string(),
  originUNLocode: v.string(),
  destinationName: v.string(),
  destinationCountryCode: v.string(),
  destinationUNLocode: v.string(),
  mode: v.union(v.literal("ocean"), v.literal("air"), v.literal("rail"), v.literal("road")),
  status: v.union(v.literal("draft"), v.literal("active"), v.literal("inactive")),
};

export const create = mutation({
  args: laneFields,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const now = Date.now();
    return ctx.db.insert("trade_lanes", {
      ...args,
      code: args.code.trim().toUpperCase(),
      originName: args.originName.trim(),
      originCountryCode: args.originCountryCode.trim().toUpperCase(),
      originUNLocode: args.originUNLocode.trim().toUpperCase(),
      destinationName: args.destinationName.trim(),
      destinationCountryCode: args.destinationCountryCode.trim().toUpperCase(),
      destinationUNLocode: args.destinationUNLocode.trim().toUpperCase(),
      userId: identity.subject,
      orgId: await resolveOrgIdForNewRecord(ctx, identity.subject),
      createdAt: now,
      updatedAt: now,
    });
  },
});