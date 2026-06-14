"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, Copy, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface HSCode {
  code: string;
  description: string;
  matchType?: string;
  isOfficial?: boolean;
}

interface HSCodeLookupProps {
  variant?: "default" | "minimal" | "card";
  className?: string;
}

export function HSCodeLookup({ variant = "default", className }: HSCodeLookupProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<HSCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [staticCodes, setStaticCodes] = useState<{ code: string; desc: string }[]>([]);
  const [instantResults, setInstantResults] = useState<HSCode[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const searchHMRC = useAction(api.hmrc_actions.searchHSCode);

  useEffect(() => {
    fetch("/hs-codes.json")
      .then((res) => res.json())
      .then((data) => {
        setStaticCodes(data);
        setIsDbLoaded(true);
      })
      .catch((err) => console.error("Failed to load static HS codes:", err));
  }, []);

  useEffect(() => {
    if (variant !== "card" && searchTerm.length >= 2 && staticCodes.length > 0) {
      const term = searchTerm.toLowerCase();
      const filtered = staticCodes
        .filter((item) => item.code.includes(term) || item.desc.toLowerCase().includes(term))
        .slice(0, 50)
        .map((item) => ({
          code: item.code,
          description: item.desc,
          matchType: "local",
        }));
      setInstantResults(filtered);
      setSearched(true);
    } else if (variant !== "card") {
      setInstantResults([]);
      if (searchTerm.length < 2) setSearched(false);
    }
  }, [searchTerm, staticCodes, variant]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const officialResults = await searchHMRC({ query: searchTerm });
      const formatted = (officialResults || []).map((r: { code: string; description: string; matchType?: string }) => ({
        code: r.code,
        description: r.description,
        matchType: r.matchType,
        isOfficial: true,
      }));

      const lowerTerm = searchTerm.toLowerCase();
      const localResults = staticCodes
        .filter((item) => item.desc.toLowerCase().includes(lowerTerm) || item.code.startsWith(searchTerm))
        .slice(0, 50)
        .map((item) => ({
          code: item.code,
          description: item.desc,
          matchType: "local",
          isOfficial: false,
        }));

      const merged = [...formatted];
      localResults.forEach((lr) => {
        if (!merged.find((m) => m.code === lr.code)) merged.push(lr);
      });

      setResults(merged);

      if (merged.length === 0) {
        toast.info("No results found. Try a different search term.");
      }
    } catch (error) {
      console.error("HMRC Search failed:", error);
      const lowerTerm = searchTerm.toLowerCase();
      const filtered = staticCodes
        .filter((item) => item.desc.toLowerCase().includes(lowerTerm) || item.code.startsWith(searchTerm))
        .slice(0, 50)
        .map((item) => ({
          code: item.code,
          description: item.desc,
          matchType: "local",
          isOfficial: false,
        }));
      setResults(filtered);
      toast.error("Official search failed. Showing local database matches.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied to clipboard`);
  };

  const openTariffPage = (code: string) => {
    window.open(`https://www.trade-tariff.service.gov.uk/commodities/${code.replace(/\s/g, "")}`, "_blank");
  };

  const displayResults = results.length > 0 ? results : instantResults;

  if (variant === "card") {
    return (
      <div className={cn("rounded-lg border border-gray-200 bg-white p-5 shadow-sm", className)}>
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">HS Code Lookup</h3>
          {!isDbLoaded && (
            <span className="text-[11px] text-gray-400">Loading Database...</span>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter product description or HS Code (e.g. 'Coffee', '8517')"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={!isDbLoaded}
            className="h-9 flex-1 border-gray-200 bg-white text-xs shadow-none placeholder:text-gray-400 focus-visible:border-gray-300 focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSearch}
            disabled={!isDbLoaded || loading || !searchTerm.trim()}
            className="size-9 shrink-0 bg-[#0f172a] text-white hover:bg-gray-800"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {searched && displayResults.length === 0 && !loading && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-xs text-gray-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No HS Codes found for &ldquo;{searchTerm}&rdquo;
          </div>
        )}

        {displayResults.length > 0 && (
          <div className="mt-3 max-h-[420px] divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100">
            {displayResults.map((item, idx) => (
              <div
                key={`${item.code}-${idx}`}
                className="flex items-start justify-between gap-3 px-3 py-3 transition hover:bg-gray-50"
              >
                <button
                  type="button"
                  onClick={() => openTariffPage(item.code)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-bold text-blue-700">{item.code}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{item.description}</p>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.code)}
                  className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        )}

        {!searched && !loading && (
          <div className="mt-6 flex flex-col items-center py-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Search className="h-4 w-4 text-gray-300" />
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Instant Tariff Search</h4>
            <p className="mt-1 max-w-sm text-xs text-gray-500">
              Lookup thousands of commodity codes instantly. Find the correct code for your imports.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-[10px] text-gray-400">
          <span>
            {isDbLoaded
              ? `Database Ready (${staticCodes.length.toLocaleString()} codes)`
              : "Initializing..."}
          </span>
          <span>Source: HMRC Official Trade Tariff API</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by product description or HS Code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-16 text-sm outline-none transition-colors focus:border-gray-400"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            searchTerm.trim() && (
              <button
                type="button"
                onClick={handleSearch}
                className="text-[10px] font-bold uppercase tracking-tight text-blue-600 hover:text-blue-700"
              >
                Search
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-4">
        {loading && results.length === 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-slate-500">Querying Trade Tariff API...</p>
          </div>
        )}

        {searched && displayResults.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-900">No results found</h3>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              We couldn&apos;t find matches for &ldquo;{searchTerm}&rdquo;. Try broader keywords.
            </p>
          </div>
        )}

        {displayResults.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {displayResults.map((item, idx) => (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => openTariffPage(item.code)}
                onKeyDown={(e) => e.key === "Enter" && openTariffPage(item.code)}
                className="group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold tracking-tight text-blue-600">{item.code}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(item.code);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 opacity-0 transition-opacity hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    COPY
                  </button>
                </div>
                <p className="pr-4 text-[13px] font-medium leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        )}

        {!searched && !loading && variant === "default" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-6 w-6 text-slate-300" />
            </div>
            <h3 className="text-base font-bold leading-tight text-slate-900">Instant Tariff Search</h3>
            <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
              Lookup thousands of commodity codes instantly. Find the correct code for your imports.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
