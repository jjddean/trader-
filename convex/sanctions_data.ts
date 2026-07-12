import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const FRESHNESS_MS = 48 * 60 * 60 * 1000;

/** Latest ingested UK Sanctions List snapshot metadata. */
export const getLatestVersion = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("sanctions_versions")
      .withIndex("by_publishedAt")
      .order("desc")
      .first();
  },
});

export const getLatestVersionInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query("sanctions_versions")
      .withIndex("by_publishedAt")
      .order("desc")
      .first();
  },
});

/** Whether the latest snapshot is fresh enough for CLEAR screening (48h). */
export const isSnapshotFresh = query({
  handler: async (ctx) => {
    return await evaluateFreshness(ctx);
  },
});

export const isSnapshotFreshInternal = internalQuery({
  handler: async (ctx) => {
    return await evaluateFreshness(ctx);
  },
});

async function evaluateFreshness(ctx: { db: any }) {
  const latest = await ctx.db
    .query("sanctions_versions")
    .withIndex("by_publishedAt")
    .order("desc")
    .first();
  if (!latest) return { fresh: false, reason: "no_snapshot" as const };
  const ageMs = Date.now() - latest.ingestedAt;
  return {
    fresh: ageMs <= FRESHNESS_MS,
    reason: ageMs <= FRESHNESS_MS ? ("ok" as const) : ("stale" as const),
    ageHours: Math.round(ageMs / (60 * 60 * 1000)),
    latest,
  };
}

/** Record a new sanctions snapshot after R2 upload — internal / CLI only. */
export const recordVersion = internalMutation({
  args: {
    publishedAt: v.string(),
    sourceHash: v.string(),
    entityCount: v.number(),
    storagePath: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sanctions_versions")
      .withIndex("by_publishedAt", (q) => q.eq("publishedAt", args.publishedAt))
      .first();

    if (existing && existing.sourceHash === args.sourceHash) {
      return existing._id;
    }

    return await ctx.db.insert("sanctions_versions", {
      ...args,
      ingestedAt: Date.now(),
    });
  },
});
