"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type EntryType = "military" | "dual_use" | "firearms" | "radioactive";

interface BrowseRow {
  entryCode: string;
  entryType: EntryType;
  category: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  notesCount: number;
  exclusionsCount: number;
}

interface BrowseResponse {
  version: string;
  sourceRef: string;
  govSourceUrl: string;
  effectiveDate: string;
  entryCount: number;
  typeCounts: Record<EntryType, number>;
  total: number;
  offset: number;
  limit: number;
  entries: BrowseRow[];
}

interface EntryDetail {
  entryCode: string;
  entryType: EntryType;
  category: string;
  title: string;
  fullText: string;
  pageStart: number;
  pageEnd: number;
  notes: string[];
  exclusions: string[];
  crossRefs: Array<{ targetEntryCode: string; relationType: string }>;
}

const TYPE_FILTERS: Array<{ value: "all" | EntryType; label: string }> = [
  { value: "all", label: "All" },
  { value: "military", label: "Military" },
  { value: "dual_use", label: "Dual-use" },
  { value: "firearms", label: "Firearms" },
  { value: "radioactive", label: "Radioactive" },
];

function typeLabel(type: EntryType) {
  if (type === "dual_use") return "Dual-use";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function typeTone(type: EntryType) {
  if (type === "military") return "bg-slate-900 text-white";
  if (type === "dual_use") return "bg-blue-100 text-blue-800";
  if (type === "firearms") return "bg-amber-100 text-amber-800";
  return "bg-purple-100 text-purple-800";
}

export function ControlListBrowser() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState<"all" | EntryType>("all");
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadList = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: String(offset),
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (type !== "all") params.set("type", type);

      const res = await fetch(`/api/export-controls/control-list?${params}`);
      const json = (await res.json()) as BrowseResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load control list");

      setData((prev) =>
        append && prev
          ? {
              ...json,
              entries: [...prev.entries, ...json.entries],
            }
          : json,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load control list");
      if (!append) setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, type]);

  useEffect(() => {
    void loadList(0, false);
  }, [loadList]);

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/export-controls/control-list?entry=${encodeURIComponent(selectedCode)}`)
      .then(async (res) => {
        const json = (await res.json()) as { entry?: EntryDetail; error?: string };
        if (!res.ok) throw new Error(json.error || "Entry not found");
        if (!cancelled) setDetail(json.entry ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Failed to load entry");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode]);

  const hasMore = data ? data.offset + data.entries.length < data.total : false;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">UK Strategic Export Control List</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Browse military, dual-use, firearms and radioactive entries. Classification still requires human review.
            </p>
          </div>
          {data && (
            <div className="text-right text-[11px] text-slate-500">
              <p>
                Version <span className="font-medium text-slate-700">{data.version}</span>
              </p>
              <p>Effective {data.effectiveDate}</p>
              <a
                href={data.govSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                GOV.UK source <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entry code, title, category…"
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setType(filter.value)}
                className={cn(
                  "h-8 rounded-md px-3 text-[11px] font-medium transition-colors",
                  type === filter.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {filter.label}
                {data && filter.value !== "all" ? ` (${data.typeCounts[filter.value]})` : ""}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <p className="mt-3 text-[11px] text-slate-500">
            Showing {data.entries.length} of {data.total.toLocaleString()} matching · {data.entryCount.toLocaleString()}{" "}
            total entries
          </p>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading control list…
            </div>
          ) : !data || data.entries.length === 0 ? (
            <p className="px-6 py-16 text-center text-xs text-slate-500">No entries match this search.</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {data.entries.map((entry) => (
                  <li key={entry.entryCode}>
                    <button
                      type="button"
                      onClick={() => setSelectedCode(entry.entryCode)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-5 py-3.5 text-left transition-colors hover:bg-slate-50",
                        selectedCode === entry.entryCode && "bg-slate-50",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{entry.entryCode}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            typeTone(entry.entryType),
                          )}
                        >
                          {typeLabel(entry.entryType)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          p.{entry.pageStart}
                          {entry.pageEnd !== entry.pageStart ? `–${entry.pageEnd}` : ""}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-800">{entry.title || entry.category}</p>
                      {entry.category && entry.title && (
                        <p className="text-[11px] text-slate-500">{entry.category}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="border-t border-slate-100 p-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void loadList(data.entries.length, true)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-4 lg:self-start">
          {!selectedCode ? (
            <p className="text-xs text-slate-500">Select an entry to read the full control text.</p>
          ) : detailLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {selectedCode}…
            </div>
          ) : !detail ? (
            <p className="text-xs text-slate-500">Could not load this entry.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-900">{detail.entryCode}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{detail.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {typeLabel(detail.entryType)} · {detail.category} · p.{detail.pageStart}
                    {detail.pageEnd !== detail.pageStart ? `–${detail.pageEnd}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCode(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close entry"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
                <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-700">
                  {detail.fullText}
                </pre>
              </div>

              {detail.notes.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                    {detail.notes.map((note, i) => (
                      <li key={i} className="rounded border border-slate-100 bg-white px-2.5 py-2">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.exclusions.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Exclusions</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                    {detail.exclusions.map((item, i) => (
                      <li key={i} className="rounded border border-slate-100 bg-white px-2.5 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.crossRefs.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cross-refs</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detail.crossRefs.map((ref) => (
                      <button
                        key={`${ref.targetEntryCode}-${ref.relationType}`}
                        type="button"
                        onClick={() => setSelectedCode(ref.targetEntryCode)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 hover:border-slate-400"
                      >
                        {ref.targetEntryCode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
