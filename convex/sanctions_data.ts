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

/**
 * Operational view of the sanctions pipeline — source version, ingest age,
 * entity count and the active storage URL screening will actually fetch.
 * Answers "why is screening failing" without a database inspection.
 */
export const getSanctionsHealth = query({
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("sanctions_versions")
      .withIndex("by_publishedAt")
      .order("desc")
      .first();

    const dataset = await ctx.db
      .query("referenceDatasets")
      .withIndex("by_name", (q) => q.eq("name", "sanctions_list"))
      .order("desc")
      .first();

    const freshness = await evaluateFreshness(ctx);

    // Screening needs both: a snapshot to score against and a dataset row
    // telling the route where to fetch it.
    const blockers: string[] = [];
    if (!latest) blockers.push("no_snapshot_recorded");
    if (!dataset) blockers.push("no_active_dataset_row");
    if (dataset && !dataset.storageUrl && !dataset.storagePath) {
      blockers.push("dataset_row_has_no_location");
    }
    if (latest && !freshness.fresh) blockers.push("snapshot_stale");

    return {
      ready: blockers.length === 0,
      blockers,
      snapshot: latest
        ? {
            version: latest.publishedAt,
            entityCount: latest.entityCount,
            sourceHash: latest.sourceHash,
            ingestedAt: latest.ingestedAt,
            ageHours: Math.round((Date.now() - latest.ingestedAt) / (60 * 60 * 1000)),
            fresh: freshness.fresh,
          }
        : null,
      activeDataset: dataset
        ? {
            version: dataset.version,
            storagePath: dataset.storagePath,
            storageUrl: dataset.storageUrl,
            lastUpdated: dataset.lastUpdated,
          }
        : null,
      remediation:
        blockers.length === 0 ? null : "npm run export-controls:refresh-sanctions",
    };
  },
});
