import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

/**
 * GET /api/health
 *
 * Liveness, not configuration. The previous version only tested whether env
 * vars were non-empty and always returned `status: "ok"` with a 200 — so a
 * deployment whose Convex backend was unreachable still reported healthy, which
 * is the one case a health check exists to catch.
 *
 * Now it actually calls Convex and reports:
 *   200 ok       — Convex answered
 *   503 degraded — Convex unreachable, timed out, or not configured
 *
 * Monitors should alert on the status code; the body explains which dependency
 * failed. Never returns detail from the underlying error — it is a public
 * endpoint.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROBE_TIMEOUT_MS = 5_000;

type ProbeResult = { ok: true; latencyMs: number } | { ok: false; reason: string };

async function probeConvex(): Promise<ProbeResult> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return { ok: false, reason: "not_configured" };

  const startedAt = Date.now();
  try {
    const client = new ConvexHttpClient(url);
    const result = await Promise.race([
      client.query(api.health.ping, {}),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), PROBE_TIMEOUT_MS),
      ),
    ]);
    if (!result?.ok) return { ok: false, reason: "unhealthy_response" };
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    const reason = err instanceof Error && err.message === "timeout" ? "timeout" : "unreachable";
    console.error("[health] Convex probe failed", { reason, latencyMs: Date.now() - startedAt });
    return { ok: false, reason };
  }
}

export async function GET() {
  const convex = await probeConvex();
  const healthy = convex.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      environment: process.env.HMRC_ENVIRONMENT || "unknown",
      dependencies: {
        convex: convex.ok
          ? { status: "ok", latencyMs: convex.latencyMs }
          : { status: "down", reason: convex.reason },
      },
      // Configuration presence only — these say nothing about reachability and
      // must never on their own decide the status code.
      configured: {
        convex: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
        hmrc: Boolean(process.env.HMRC_CLIENT_ID),
        clerk: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
        productionHmrcOAuth: Boolean(
          process.env.HMRC_PRODUCTION_CLIENT_ID?.trim() &&
            process.env.HMRC_PRODUCTION_CLIENT_SECRET?.trim(),
        ),
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
