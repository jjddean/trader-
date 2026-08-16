"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Info,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { commodityRequiresSupplementaryUnit } from "@/lib/wco-mapper";
import { getCachedHsCodeRows, preloadHsCodeRows } from "@/lib/hs-codes-static-cache";
import {
  HS_TARIFF_SECTIONS,
  hsCodeInSection,
  type HsTariffSectionValue,
} from "@/lib/hs-tariff-sections";
import { userMessageFromError } from "@/lib/convex-errors";

interface HSCode {
  code: string;
  description: string;
  matchType?: string;
  isOfficial?: boolean;
}

interface HSCodeLookupProps {
  variant?: "default" | "minimal" | "card";
  className?: string;
  /** When set, shows "Apply to item" and returns to declaration after apply */
  declarationId?: string;
  itemId?: string;
}

type CopiedField = "code" | "description" | null;

function tariffUrl(code: string) {
  return `https://www.trade-tariff.service.gov.uk/commodities/${code.replace(/\s/g, "")}`;
}

function DescriptionGuidance({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border border-blue-100 bg-blue-50/80 text-blue-950",
        compact ? "px-3 py-2.5" : "px-4 py-3",
      )}
    >
      <Info className={cn("shrink-0 text-blue-600", compact ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4")} />
      <div className={cn("space-y-1", compact ? "text-[11px] leading-relaxed" : "text-xs leading-relaxed")}>
        <p className="font-medium">Code vs declaration description</p>
        <p className="text-blue-900/85">
          The text below is <strong>tariff nomenclature</strong> — use it to pick the right commodity code.
          On your declaration, enter a <strong>normal trade description</strong> (DE 6/8) that matches your
          invoice and supports the code. Only use tariff wording if your goods exactly match that line
          (including purity or CAS criteria where shown).
        </p>
      </div>
    </div>
  );
}

function ResultActionButton({
  label,
  copiedLabel,
  isCopied,
  onClick,
  variant = "default",
}: {
  label: string;
  copiedLabel: string;
  isCopied: boolean;
  onClick: () => void;
  variant?: "default" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-[88px] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors",
        isCopied
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : variant === "secondary"
            ? "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            : "border-slate-300 bg-slate-50 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700",
      )}
    >
      {isCopied ? (
        <>
          <Check className="h-3 w-3" />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 opacity-70" />
          {label}
        </>
      )}
    </button>
  );
}

function HSCodeResultRow({
  item,
  itemId,
  declarationId,
  onApply,
  applying,
}: {
  item: HSCode;
  itemId?: string;
  declarationId?: string;
  onApply?: (code: string, description: string) => void;
  applying?: boolean;
}) {
  const [copiedField, setCopiedField] = useState<CopiedField>(null);
  const needsSupplementary = commodityRequiresSupplementaryUnit(item.code);

  const copyText = useCallback(async (text: string, field: Exclude<CopiedField, null>) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(field === "code" ? `Code ${text} copied` : "Description copied — adapt for your invoice");
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  return (
    <div className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-slate-50/80 sm:px-4 sm:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold tracking-tight text-blue-700">{item.code}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</p>
        {needsSupplementary && (
          <p className="mt-1.5 text-[10px] font-medium text-amber-700">
            This code may require supplementary units (DE 6/2) on the goods item.
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5">
        {itemId && declarationId && onApply && (
          <button
            type="button"
            disabled={applying}
            onClick={() => onApply(item.code, item.description)}
            className="flex h-8 min-w-[88px] items-center justify-center rounded-md border border-slate-900 bg-slate-900 px-2 text-[10px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {applying ? "Applying…" : "Apply"}
          </button>
        )}
        <ResultActionButton
          label="Copy code"
          copiedLabel="Copied"
          isCopied={copiedField === "code"}
          onClick={() => copyText(item.code, "code")}
        />
        <ResultActionButton
          label="Copy text"
          copiedLabel="Copied"
          isCopied={copiedField === "description"}
          onClick={() => copyText(item.description, "description")}
          variant="secondary"
        />
        <a
          href={tariffUrl(item.code)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 min-w-[88px] items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <ExternalLink className="h-3 w-3 opacity-70" />
          Tariff
        </a>
      </div>
    </div>
  );
}

export function HSCodeLookup({
  variant = "default",
  className,
  declarationId,
  itemId,
}: HSCodeLookupProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<HSCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [staticCodes, setStaticCodes] = useState<{ code: string; desc: string }[]>(
    () => getCachedHsCodeRows() ?? [],
  );
  const [instantResults, setInstantResults] = useState<HSCode[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(() => getCachedHsCodeRows() != null);
  const [applying, setApplying] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<HsTariffSectionValue>("all");
  const filterRef = useRef<HTMLDivElement>(null);

  const searchHMRC = useAction(api.hmrc_actions.searchHSCode);
  const updateItem = useMutation(api.goods_items.updateItem);

  const handleApplyToItem = useCallback(
    async (code: string, tariffDescription: string) => {
      if (!itemId) return;
      setApplying(true);
      try {
        const normalizedCode = code.replace(/\D/g, "").slice(0, 10);
        const tradeHint = tariffDescription.slice(0, 512);
        await updateItem({
          id: itemId as Id<"goods_items">,
          commodityCode: normalizedCode,
          description: tradeHint,
        });
        toast.success("Code and reference description applied — review against your invoice");
        if (declarationId) {
          router.push(`/dashboard/declarations/${declarationId}/items?hsApplied=1`);
        }
      } catch (error) {
        toast.error(userMessageFromError(error, "Could not apply to item"));
      } finally {
        setApplying(false);
      }
    },
    [itemId, declarationId, updateItem, router],
  );

  useEffect(() => {
    let cancelled = false;
    void preloadHsCodeRows()
      .then((data) => {
        if (cancelled) return;
        setStaticCodes(data);
        setIsDbLoaded(true);
      })
      .catch((err) => console.error("Failed to load static HS codes:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showFilters) return;
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  useEffect(() => {
    if (searchTerm.length >= 2 && staticCodes.length > 0) {
      const term = searchTerm.toLowerCase();
      const filtered = staticCodes
        .filter((item) => item.code.includes(term) || item.desc.toLowerCase().includes(term))
        .filter((item) => hsCodeInSection(item.code, sectionFilter))
        .slice(0, 50)
        .map((item) => ({
          code: item.code,
          description: item.desc,
          matchType: "local",
        }));
      setInstantResults(filtered);
      setSearched(true);
    } else {
      setInstantResults([]);
      if (searchTerm.length < 2) setSearched(false);
    }
  }, [searchTerm, staticCodes, sectionFilter]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const officialResults = await searchHMRC({ query: searchTerm });
      const formatted = (officialResults || []).map(
        (r: { code: string; description: string; matchType?: string }) => ({
          code: r.code,
          description: r.description,
          matchType: r.matchType,
          isOfficial: true,
        }),
      );

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

  const displayResults = useMemo(() => {
    const raw = results.length > 0 ? results : instantResults;
    if (sectionFilter === "all") return raw;
    return raw.filter((item) => hsCodeInSection(item.code, sectionFilter));
  }, [results, instantResults, sectionFilter]);

  const selectedSectionLabel =
    HS_TARIFF_SECTIONS.find((s) => s.value === sectionFilter)?.label ?? "All sections";

  const resultsPanel =
    displayResults.length > 0 ? (
      <div
        className={cn(
          "divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-100 bg-white",
          variant === "card" ? "mt-3 max-h-[420px]" : "max-h-[560px] rounded-2xl border-slate-100 shadow-sm",
        )}
      >
        {displayResults.map((item, idx) => (
          <HSCodeResultRow
            key={`${item.code}-${idx}`}
            item={item}
            itemId={itemId}
            declarationId={declarationId}
            onApply={itemId ? handleApplyToItem : undefined}
            applying={applying}
          />
        ))}
      </div>
    ) : null;

  if (variant === "card") {
    return (
      <div className={cn("relative z-10 flex flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-none", className)}>
        <div className="relative z-20 overflow-visible border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by product description or HS Code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={!isDbLoaded}
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400 disabled:opacity-50"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-slate-600 outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-0",
                  sectionFilter !== "all" || showFilters ? "border-slate-400" : "border-slate-200",
                )}
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 z-[120] max-h-72 w-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-md">
                  {HS_TARIFF_SECTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSectionFilter(option.value);
                        setShowFilters(false);
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-xs outline-none hover:bg-slate-100 focus:outline-none focus-visible:ring-0",
                        sectionFilter === option.value && "bg-slate-100 font-medium text-black",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-col">
            <div className="min-h-0 overflow-hidden rounded-md border border-slate-100 bg-white">
              {loading && displayResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Querying Trade Tariff…
                </div>
              ) : displayResults.length > 0 ? (
                <div className="max-h-[420px] overflow-y-auto">
                  <div className="border-b border-slate-100 p-3">
                    <DescriptionGuidance compact />
                  </div>
                  <div className="divide-y divide-slate-100">
                    {displayResults.map((item, idx) => (
                      <HSCodeResultRow
                        key={`${item.code}-${idx}`}
                        item={item}
                        itemId={itemId}
                        declarationId={declarationId}
                        onApply={itemId ? handleApplyToItem : undefined}
                        applying={applying}
                      />
                    ))}
                  </div>
                </div>
              ) : searched && !loading ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <AlertCircle className="h-4 w-4 text-slate-300" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">No matching codes</h4>
                  <p className="mt-1 max-w-sm text-xs text-slate-500">
                    No HS codes found for &ldquo;{searchTerm}&rdquo;
                    {sectionFilter !== "all" ? ` in ${selectedSectionLabel.split(" — ")[0]}` : ""}.
                    Try another search or section.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <Search className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Instant tariff search</p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500">
                    {sectionFilter === "all"
                      ? "Find commodity codes from HMRC Trade Tariff. Copy the code onto your declaration item; use tariff text as a reference for your trade description."
                      : `Searching within ${selectedSectionLabel}. Enter a product description or code.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <span>
              {isDbLoaded
                ? `Database ready (${staticCodes.length.toLocaleString()} codes)`
                : "Initializing…"}
            </span>
            <span>Source: HMRC Trade Tariff API</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <DescriptionGuidance />

      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by product description or HS Code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-16 text-sm outline-none transition-colors focus:border-slate-400"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
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
            <p className="text-sm font-medium text-slate-500">Querying Trade Tariff API…</p>
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
          <div className="space-y-3">
            {resultsPanel}
          </div>
        )}

        {!searched && !loading && variant === "default" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-6 w-6 text-slate-300" />
            </div>
            <h3 className="text-base font-bold leading-tight text-slate-900">Instant tariff search</h3>
            <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
              Find commodity codes from HMRC Trade Tariff. Copy the code onto your declaration; adapt tariff text
              for your trade description.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
