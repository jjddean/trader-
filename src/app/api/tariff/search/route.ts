import { NextResponse } from "next/server";
import {
  TRADE_TARIFF_BASE,
  readEntryDescription,
  readExactEntry,
  readFuzzyResults,
} from "../../../../../convex/lib/trade_tariff_search";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

/**
 * Public commodity-code lookup against the UK Trade Tariff API.
 *
 * This lives here rather than in a Convex action so it can be rate limited. The
 * previous `hmrc_actions.searchHSCode` was reachable unauthenticated over the
 * Convex websocket, which carries no caller address — so per-caller limiting was
 * impossible there and only a global cap would have been available, letting one
 * abuser deny service to everyone.
 *
 * Unauthenticated by design: /hs-code-lookup and /tools are public pages.
 */
const limiter = new ApiRateLimiter(
  Number(process.env.TARIFF_SEARCH_RATE_LIMIT_PER_MINUTE) || 30,
  60_000,
);

function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  if (!limiter.tryConsume(callerKey(request))) {
    return NextResponse.json(
      { error: "Too many lookups. Wait a moment and try again." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = String(body?.query ?? "").trim();
  if (!query) return NextResponse.json({ results: [] });
  if (query.length > 200) {
    return NextResponse.json({ error: "Search term is too long." }, { status: 400 });
  }

  const headers = { Accept: "application/json", "User-Agent": "FreightCode/1.0" };

  try {
    const response = await fetch(
      `${TRADE_TARIFF_BASE}/search?q=${encodeURIComponent(query)}`,
      { headers },
    );
    if (!response.ok) {
      console.error("[tariff-search] upstream failed", response.status, response.statusText);
      return NextResponse.json({ results: [] });
    }

    const payload = await response.json();

    const entry = readExactEntry(payload);
    if (entry) {
      const detail = await fetch(`${TRADE_TARIFF_BASE}/${entry.endpoint}/${entry.id}`, { headers });
      const description = detail.ok ? readEntryDescription(await detail.json()) : "";
      return NextResponse.json({
        results: [{ code: entry.id, description, matchType: "exact_match" }],
      });
    }

    return NextResponse.json({ results: readFuzzyResults(payload) });
  } catch (error: unknown) {
    console.error(
      "[tariff-search] request error",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ results: [] });
  }
}
