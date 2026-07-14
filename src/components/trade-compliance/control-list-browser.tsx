"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
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
  additionalOccurrences?: Array<{
    title: string;
    fullText: string;
    pageStart: number;
    pageEnd: number;
  }>;
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

  const loadList = useCallback(
    async (offset = 0, append = false) => {
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
        if (!res.ok)
          throw new Error(json.error || "Failed to load control list");
        setData((previous) =>
          append && previous
            ? { ...json, entries: [...previous.entries, ...json.entries] }
            : json,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load control list",
        );
        if (!append) setData(null);
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, type],
  );

  useEffect(() => {
    void loadList(0, false);
  }, [loadList]);

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    fetch(
      `/api/export-controls/control-list?entry=${encodeURIComponent(selectedCode)}`,
    )
      .then(async (res) => {
        const json = (await res.json()) as {
          entry?: EntryDetail;
          error?: string;
        };
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

  const hasMore = data ? data.entries.length < data.total : false;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <h1 className="text-sm font-semibold text-slate-900">
              Control List
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Browse UK military, dual-use, firearms and radioactive entries.
            Classification still requires human review.
          </p>
        </div>
        {data && (
          <div className="text-right text-[11px] text-slate-500">
            <p>
              Version{" "}
              <span className="font-medium text-slate-700">{data.version}</span>
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search entry code, title, category…"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setType(filter.value);
                setSelectedCode(null);
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[11px] font-medium transition-colors",
                type === filter.value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {filter.label}
              {data && filter.value !== "all"
                ? ` (${data.typeCounts[filter.value]})`
                : ""}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <p className="mt-3 text-[11px] text-slate-500">
          Showing {data.entries.length} of {data.total.toLocaleString()}{" "}
          matching · {data.entryCount.toLocaleString()} total entries
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 max-h-[560px] overflow-y-auto rounded-md border border-slate-100 bg-white">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading control list…
          </div>
        ) : !data || data.entries.length === 0 ? (
          <p className="px-6 py-16 text-center text-xs text-slate-500">
            No entries match this search.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data.entries.map((entry) => {
                const isOpen = selectedCode === entry.entryCode;
                return (
                  <li key={entry.entryCode}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCode(isOpen ? null : entry.entryCode)
                      }
                      aria-expanded={isOpen}
                      className={cn(
                        "flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50",
                        isOpen && "bg-slate-50",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-blue-700">
                            {entry.entryCode}
                          </span>
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
                            {entry.pageEnd !== entry.pageStart
                              ? `–${entry.pageEnd}`
                              : ""}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-800">
                          {entry.title || entry.category}
                        </p>
                        {entry.category && entry.title && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {entry.category}
                          </p>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                        {detailLoading ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading {entry.entryCode}…
                          </div>
                        ) : !detail ? (
                          <p className="text-xs text-slate-500">
                            Could not load this entry.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
                              {detail.fullText}
                            </pre>
                            {detail.additionalOccurrences &&
                              detail.additionalOccurrences.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Additional occurrences in source
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    These passages use the same entry code elsewhere in the source document.
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {detail.additionalOccurrences.map(
                                      (occurrence, index) => (
                                        <div
                                          key={`${occurrence.pageStart}-${occurrence.pageEnd}-${index}`}
                                          className="rounded border border-slate-200 bg-white px-2.5 py-2"
                                        >
                                          <p className="text-[10px] font-medium text-slate-500">
                                            Page {occurrence.pageStart}
                                            {occurrence.pageEnd !==
                                            occurrence.pageStart
                                              ? `–${occurrence.pageEnd}`
                                              : ""}
                                          </p>
                                          <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-600">
                                            {occurrence.fullText}
                                          </pre>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                            {detail.notes.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Notes
                                </p>
                                <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                                  {detail.notes.map((note, index) => (
                                    <li
                                      key={index}
                                      className="rounded border border-slate-200 bg-white px-2.5 py-2"
                                    >
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {detail.exclusions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Exclusions
                                </p>
                                <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                                  {detail.exclusions.map((item, index) => (
                                    <li
                                      key={index}
                                      className="rounded border border-slate-200 bg-white px-2.5 py-2"
                                    >
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {detail.crossRefs.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Cross-references
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {detail.crossRefs.map((ref) => (
                                    <button
                                      key={`${ref.targetEntryCode}-${ref.relationType}`}
                                      type="button"
                                      onClick={() => {
                                        setQuery(ref.targetEntryCode);
                                        setDebouncedQuery(ref.targetEntryCode);
                                        setType("all");
                                        setSelectedCode(ref.targetEntryCode);
                                      }}
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
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {hasMore && (
              <div className="border-t border-slate-100 p-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadList(data.entries.length, true)}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
