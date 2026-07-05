import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { aiClassifyLimiter } from "@/lib/api-rate-limiter";
import { loadSanctionsSnapshot } from "@/lib/export-controls/sanctions/snapshot";
import { buildSanctionsIndex, screenParties, type ScreenSubjectInput } from "@/lib/export-controls/sanctions/screen";
import { sanctionsClearanceScore } from "@/lib/export-controls/sanctions/scoring";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function resolveSanctionsUrl(convexToken: string): Promise<string> {
  convex.setAuth(convexToken);
  const dataset = await convex.query(api.reference_data.getLatestDataset, {
    name: "sanctions_list",
  });
  if (dataset?.storageUrl) return dataset.storageUrl;
  if (dataset?.storagePath && process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}${dataset.storagePath}`;
  }
  throw new Error("Sanctions list dataset URL not configured");
}

async function loadSanctionsWithFallback(url: string) {
  try {
    return await loadSanctionsSnapshot(url);
  } catch {
    const localPath = path.join(process.cwd(), "data", "export-controls", "sanctions-2026-06-26.json");
    const raw = await readFile(localPath, "utf8");
    return JSON.parse(raw);
  }
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

    let parties: ScreenSubjectInput[] = subjects ?? [];

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
    const snapshot = await loadSanctionsWithFallback(sanctionsUrl);
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
    console.error("Export controls screen error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
