import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ALLOWED_RESOURCES = new Set(["lanes", "risk-scores", "alerts"]);

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resource } = await params;
  if (!ALLOWED_RESOURCES.has(resource)) {
    return NextResponse.json({ error: "Unknown GeoRisk resource" }, { status: 404 });
  }

  const baseUrl = process.env.GEORISK_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json({ error: "GeoRisk API is not configured" }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${baseUrl}/${resource}/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "GeoRisk API is unavailable" }, { status: 502 });
  }
}
