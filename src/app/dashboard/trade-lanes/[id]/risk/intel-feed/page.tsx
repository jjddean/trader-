"use client";

import { useQuery } from "convex/react";
import { CloudRain, ExternalLink, Newspaper, Radar, Scale, Wind } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "../../../../../../../convex/_generated/api";

interface WeatherReading {
  location: string;
  time?: string;
  temperature_2m?: number;
  precipitation?: number;
  wind_speed_10m?: number;
  wind_gusts_10m?: number;
}

interface NewsArticle {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
}

interface LiveIntelResponse {
  generatedAt: string;
  weather: WeatherReading[];
  articles: NewsArticle[];
  maritime: { status: string };
  sanctions: { status: string; screeningEndpoint: string };
}

function category(article: NewsArticle) {
  const value = `${article.title ?? ""} ${article.url ?? ""}`.toLowerCase();
  if (value.includes("sanction")) return "Sanctions intelligence";
  if (value.includes("conflict") || value.includes("attack") || value.includes("war")) return "Conflict intelligence";
  if (value.includes("piracy") || value.includes("vessel") || value.includes("shipping")) return "Maritime intelligence";
  return "Route news";
}

export default function IntelFeedPage() {
  const { id } = useParams<{ id: string }>();
  const lane = useQuery(api.trade_lanes.get, { laneId: id });
  const [data, setData] = useState<LiveIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (!lane) return () => controller.abort();

    const query = new URLSearchParams({
      origin: `${lane.originName} ${lane.originCountryCode} ${lane.originUNLocode}`,
      destination: `${lane.destinationName} ${lane.destinationCountryCode} ${lane.destinationUNLocode}`,
    });
    void fetch(`/api/georisk/live-intel?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Live intelligence is unavailable");
        return response.json() as Promise<LiveIntelResponse>;
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Live intelligence is unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [lane]);

  const articles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.articles ?? []).filter((article) => !term || `${article.title} ${article.domain}`.toLowerCase().includes(term));
  }, [data, search]);

  return (
    <div className="min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50 text-slate-600">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-[14px] font-medium text-slate-900">Lane Intel Feed</h1>
          <p className="text-[10px] text-slate-400">Live weather and route intelligence for this saved lane</p>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search intelligence…" className="h-8 w-52 rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] outline-none focus:border-slate-400" />
      </header>

      <div className="space-y-5 p-6">
        {loading || lane === undefined ? <p className="py-12 text-center text-xs text-slate-400">Loading live intelligence…</p> : error ? <p className="rounded-lg border border-red-100 bg-red-50 p-4 text-xs text-red-700">{error}</p> : (
          <>
            <section>
              <div className="mb-2 flex items-center gap-2"><CloudRain className="h-4 w-4 text-blue-600" /><h2 className="text-xs font-semibold text-slate-900">Current port weather</h2><span className="text-[9px] text-slate-400">Open-Meteo</span></div>
              <div className="grid gap-3 md:grid-cols-2">
                {(data?.weather ?? []).map((reading) => <div key={reading.location} className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-900">{reading.location}</p><div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-600"><span>{reading.temperature_2m ?? "—"}°C</span><span className="flex items-center gap-1"><Wind className="h-3 w-3" />{reading.wind_speed_10m ?? "—"} kn</span><span>Gusts {reading.wind_gusts_10m ?? "—"} kn</span><span>Rain {reading.precipitation ?? "—"} mm</span></div></div>)}
                {data?.weather.length === 0 && <p className="text-xs text-slate-400">Weather coordinates could not be resolved.</p>}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-purple-600" /><p className="text-xs font-medium text-slate-900">Sanctions</p></div><p className="mt-2 text-[11px] text-slate-500">Feed items are intelligence only. Party clearance uses FreightCode’s separate UK sanctions screening workflow.</p></div>
              <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><Radar className="h-4 w-4 text-cyan-600" /><p className="text-xs font-medium text-slate-900">Maritime / AIS</p></div><p className="mt-2 text-[11px] text-slate-500">Link a vessel IMO to this lane before vessel-specific Maersk and AIS events can be requested.</p></div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2"><Newspaper className="h-4 w-4 text-orange-600" /><h2 className="text-xs font-semibold text-slate-900">Route news and risk signals</h2><span className="text-[9px] text-slate-400">GDELT</span></div>
              <div className="space-y-3">
                {articles.map((article, index) => <article key={`${article.url}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-4"><div><span className="text-[9px] font-medium uppercase tracking-wide text-orange-600">{category(article)}</span><h3 className="mt-1 text-[13px] font-medium text-slate-900">{article.title || "Untitled intelligence item"}</h3><p className="mt-1 text-[10px] text-slate-400">{article.domain || "External source"}{article.seendate ? ` · ${article.seendate}` : ""}</p></div>{article.url && <a href={article.url} target="_blank" rel="noreferrer" aria-label="Open source article" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ExternalLink className="h-4 w-4" /></a>}</div></article>)}
                {articles.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-white py-10 text-center text-xs text-slate-400">No matching route intelligence found.</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}