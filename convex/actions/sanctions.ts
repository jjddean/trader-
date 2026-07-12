"use node";

import { createHash } from "node:crypto";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const UKSL_XML_URL = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml";

/** Daily check — full auto-ingest deferred to RT-08; alerts when XML hash changes or snapshot stale. */
export const checkSanctionsSnapshot = internalAction({
  handler: async (ctx): Promise<{
    status: "ok" | "stale" | "needs_ingest" | "fetch_failed";
    freshness?: Awaited<ReturnType<typeof ctx.runQuery>>;
    hashChanged?: boolean;
    remoteHash?: string | null;
    latestVersion?: string | null;
    message?: string;
  }> => {
    const freshness = await ctx.runQuery(internal.sanctions_data.isSnapshotFreshInternal, {});
    const latest = await ctx.runQuery(internal.sanctions_data.getLatestVersionInternal, {});

    let remoteHash: string | null = null;
    try {
      const res = await fetch(UKSL_XML_URL);
      if (!res.ok) {
        throw new Error(`UKSL fetch failed: ${res.status}`);
      }
      const xml = await res.text();
      remoteHash = createHash("sha256").update(xml).digest("hex");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "fetch failed";
      console.error("[sanctions-cron] UKSL fetch error:", message);
      return { status: "fetch_failed" as const, message, freshness };
    }

    const hashChanged = Boolean(latest?.sourceHash && remoteHash !== latest.sourceHash);
    const stale = !freshness.fresh;

    if (hashChanged || stale) {
      console.warn("[sanctions-cron] Action required:", {
        hashChanged: Boolean(hashChanged),
        stale,
        ageHours: freshness.ageHours,
        hint: "Run npm run export-controls:ingest-sanctions && npm run export-controls:upload-sanctions",
      });
    }

    return {
      status: hashChanged ? ("needs_ingest" as const) : stale ? ("stale" as const) : ("ok" as const),
      freshness,
      hashChanged: Boolean(hashChanged),
      remoteHash,
      latestVersion: latest?.publishedAt ?? null,
    };
  },
});
