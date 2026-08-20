import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { aiClassifyLimiter } from "@/lib/api-rate-limiter";
import { loadSanctionsSnapshot, type SanctionsSnapshot } from "@/lib/export-controls/sanctions/snapshot";
import { buildSanctionsIndex, screenParties, type ScreenSubjectInput } from "@/lib/export-controls/sanctions/screen";
import { sanctionsClearanceScore } from "@/lib/export-controls/sanctions/scoring";
import { userMessageFromError } from "@/lib/convex-errors";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const SANCTIONS_DATA_DIR = path.join(process.cwd(), "data", "export-controls");

/** Screening cannot proceed — surfaced as 503 + remediation, not a generic 500. */
class SanctionsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SanctionsUnavailableError";
  }
}

/** Active snapshot URL from the sanctions_list dataset row, or null if unregistered. */
async function resolveSanctionsUrl(convexToken: string): Promise<string | null> {
  convex.setAuth(convexToken);
  const dataset = await convex.query(api.reference_data.getLatestDataset, {
    name: "sanctions_list",
  });
  if (dataset?.storageUrl) return dataset.storageUrl;
  if (dataset?.storagePath && process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}${dataset.storagePath}`;
  }
  return null;
}

/** Newest sanctions-*.json on disk. Resolved dynamically — never a pinned filename. */
async function findLocalSnapshot(): Promise<string | null> {
  try {
    const files = (await readdir(SANCTIONS_DATA_DIR))
      .filter((f) => f.startsWith("sanctions-") && f.endsWith(".json"))
      .sort()
      .reverse();
    return files[0] ? path.join(SANCTIONS_DATA_DIR, files[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Remote snapshot first, newest local snapshot as fallback.
 *
 * The fallback also covers a missing dataset row (url === null), not only a
 * failed fetch: previously resolveSanctionsUrl() threw first, so on a fresh
 * deployment the fallback was unreachable and the caller saw HTTP 500.
 */
async function loadSanctionsWithFallback(
  url: string | null,
): Promise<{ snapshot: SanctionsSnapshot; source: "r2" | "local" }> {
  if (url) {
    try {
      return { snapshot: await loadSanctionsSnapshot(url), source: "r2" };
    } catch (error: unknown) {
      console.warn(
        "[sanctions] Remote snapshot unavailable, falling back to local:",
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    console.warn("[sanctions] No active sanctions_list dataset row; trying local snapshot");
  }

  const localPath = await findLocalSnapshot();
  if (!localPath) {
    throw new SanctionsUnavailableError(
      url
        ? "Sanctions list could not be fetched and no local snapshot is available. Run: npm run export-controls:refresh-sanctions"
        : "Sanctions list is not configured. Run: npm run export-controls:refresh-sanctions",
    );
  }

  return {
    snapshot: JSON.parse(await readFile(localPath, "utf8")) as SanctionsSnapshot,
    source: "local",
  };
}

export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!aiClassifyLimiter.tryConsume(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }
    convex.setAuth(convexToken);

    const body = await request.json();
    const assessmentId = body.assessmentId as Id<"export_assessments"> | undefined;
    const persist = body.persist !== false;
    const subjects = body.subjects as ScreenSubjectInput[] | undefined;

    const parties: ScreenSubjectInput[] = subjects ?? [];

    if (parties.length === 0 && assessmentId) {
      const detail = await convex.query(api.export_controls.getAssessment, { assessmentId });
      if (!detail) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }
      const a = detail.assessment;
      if (a.consignee?.name) {
        parties.push({
          subjectType: "consignee",
          name: a.consignee.name,
          address: a.consignee.address,
          country: a.consignee.country,
        });
      }
      if (a.endUser?.name) {
        parties.push({
          subjectType: "end_user",
          name: a.endUser.name,
          address: a.endUser.address,
          country: a.endUser.country,
        });
      }
    }

    if (parties.length === 0) {
      return NextResponse.json({ error: "subjects or assessmentId with parties required" }, { status: 400 });
    }

    const freshness = await convex.query(api.sanctions_data.isSnapshotFresh, {});
    const sanctionsUrl = await resolveSanctionsUrl(convexToken);
    const { snapshot, source: snapshotSource } = await loadSanctionsWithFallback(sanctionsUrl);
    const index = buildSanctionsIndex(snapshot);
    const results = screenParties(index, parties);

    const hasBlockBandHit = results.some((r) =>
      r.matches.some((m) => m.band.band === "block" || m.band.band === "review"),
    );

    const screeningIds: string[] = [];
    if (persist && assessmentId) {
      for (const result of results) {
        const top = result.matches[0];
        const screeningId = await convex.mutation(api.export_controls.recordSanctionsScreening, {
          assessmentId,
          subjectType: result.subject.subjectType,
          subjectName: result.subject.name,
          matchedUniqueId: top?.uniqueId,
          score: top?.scoreBreakdown.total,
          matchReason: top?.matchReason,
          scoreBreakdown: top?.scoreBreakdown,
          sanctionsVersion: snapshot.version,
        });
        screeningIds.push(screeningId);
      }

      const status = !freshness.fresh || hasBlockBandHit ? "flagged" : "review_required";
      await convex.mutation(api.export_controls.updateAssessment, {
        assessmentId,
        status,
        sanctionsVersion: snapshot.version,
      });
    }

    return NextResponse.json({
      sanctionsVersion: snapshot.version,
      snapshotSource,
      snapshotFresh: freshness,
      sanctionsClearance: sanctionsClearanceScore(freshness.fresh, hasBlockBandHit),
      canAutoClear: false,
      results: results.map((r) => ({
        subject: r.subject,
        matches: r.matches.map((m) => ({
          uniqueId: m.uniqueId,
          score: m.scoreBreakdown.total,
          band: m.band,
          matchReason: m.matchReason,
          matchedName: m.matchedName,
          regimeName: m.entity.regimeName,
          measures: m.entity.measures,
          scoreBreakdown: m.scoreBreakdown,
        })),
      })),
      persisted: persist && assessmentId ? { screeningIds } : null,
    });
  } catch (error: unknown) {
    if (error instanceof SanctionsUnavailableError) {
      console.error("Export controls screen unavailable:", error.message);
      return NextResponse.json(
        { error: error.message, code: "sanctions_unavailable" },
        { status: 503 },
      );
    }
    console.error("Export controls screen error:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
