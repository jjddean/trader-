import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ControlListEntry } from "@/lib/export-controls/control-list";
import { loadControlListForUser } from "@/lib/export-controls/load-control-list-server";

const ENTRY_TYPES = new Set(["military", "dual_use", "firearms", "radioactive"]);

function matchesQuery(entry: ControlListEntry, q: string): boolean {
  if (!q) return true;
  const hay = [
    entry.entryCode,
    entry.title,
    entry.category,
    entry.fullText.slice(0, 800),
    ...entry.notes.slice(0, 3),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export async function GET(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const type = (searchParams.get("type") ?? "all").trim();
    const entryCode = (searchParams.get("entry") ?? "").trim().toUpperCase();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1), 100);
    const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

    const snapshot = await loadControlListForUser(convexToken);

    if (entryCode) {
      const entry = snapshot.entries.find((e) => e.entryCode.toUpperCase() === entryCode);
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json({
        version: snapshot.version,
        sourceRef: snapshot.sourceRef,
        govSourceUrl: snapshot.govSourceUrl,
        effectiveDate: snapshot.effectiveDate,
        entry,
      });
    }

    const filtered = snapshot.entries.filter((entry) => {
      if (type !== "all" && ENTRY_TYPES.has(type) && entry.entryType !== type) return false;
      return matchesQuery(entry, q);
    });

    const page = filtered.slice(offset, offset + limit).map((entry) => ({
      entryCode: entry.entryCode,
      entryType: entry.entryType,
      category: entry.category,
      title: entry.title,
      pageStart: entry.pageStart,
      pageEnd: entry.pageEnd,
      notesCount: entry.notes.length,
      exclusionsCount: entry.exclusions.length,
    }));

    const typeCounts = {
      military: 0,
      dual_use: 0,
      firearms: 0,
      radioactive: 0,
    };
    for (const entry of snapshot.entries) {
      if (entry.entryType in typeCounts) {
        typeCounts[entry.entryType as keyof typeof typeCounts] += 1;
      }
    }

    return NextResponse.json({
      version: snapshot.version,
      sourceRef: snapshot.sourceRef,
      govSourceUrl: snapshot.govSourceUrl,
      effectiveDate: snapshot.effectiveDate,
      entryCount: snapshot.entryCount,
      typeCounts,
      total: filtered.length,
      offset,
      limit,
      entries: page,
    });
  } catch (error) {
    console.error("Control list browse failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load control list" },
      { status: 500 },
    );
  }
}
