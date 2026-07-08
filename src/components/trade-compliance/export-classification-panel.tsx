"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, ShieldAlert } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface ClassificationResponse {
  classification: {
    matches: Array<{
      entryCode: string;
      clausePath: string;
      title: string;
      citation: string;
      rationale: string;
      missingDiscriminators: string[];
    }>;
    possible_matches: Array<{
      entryCode: string;
      clausePath: string;
      title: string;
      citation: string;
      rationale: string;
      missingDiscriminators: string[];
    }>;
    predicateHits: Array<{
      entryCode: string;
      label: string;
      outcome: string;
      detail: string;
    }>;
    confidence: number;
    requiresReview: boolean;
    controlListVersion: string;
    disclaimer: string;
  };
  runId?: string;
}

interface ExportClassificationPanelProps {
  assessmentId: Id<"export_assessments">;
}

export function ExportClassificationPanel({ assessmentId }: ExportClassificationPanelProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const detail = useQuery(
    api.export_controls.getAssessment,
    canQuery ? { assessmentId } : "skip",
  );

  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<Id<"export_products"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsByProduct, setResultsByProduct] = useState<Record<string, ClassificationResponse>>({});

  const products = detail?.products ?? [];

  const handleClassify = async (productId: Id<"export_products">) => {
    if (!canQuery) return;
    setActiveProductId(productId);
    setLoadingProductId(productId);
    setError(null);

    try {
      const res = await fetch("/api/export-controls/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, persist: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Classification failed (${res.status})`);
      }

      const data = (await res.json()) as ClassificationResponse;
      setResultsByProduct((prev) => ({ ...prev, [productId]: data }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setLoadingProductId(null);
    }
  };

  const activeProduct =
    activeProductId ? products.find((p) => p._id === activeProductId) : undefined;
  const activeResult = activeProductId ? resultsByProduct[activeProductId]?.classification : undefined;
  const hasCandidates =
    activeResult ? [...activeResult.matches, ...activeResult.possible_matches].length > 0 : false;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-black">Control entry classification</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Runs retrieval against the UK control list (R2), deterministic predicates, and a Groq candidate pass.
            Upload documents first to populate product facts — results are recommendations only.
          </p>
        </div>

        {!detail ? (
          <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No products on this assessment yet. Upload a commercial invoice or tech spec on the Documents tab.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {products.map((product) => {
              const latestRun = product.classificationRuns?.[0];
              const liveResult = resultsByProduct[product._id];
              const isLoading = loadingProductId === product._id;
              const isActive = activeProductId === product._id;
              const candidateCount = liveResult
                ? [
                    ...liveResult.classification.matches,
                    ...liveResult.classification.possible_matches,
                  ].length
                : 0;

              return (
                <div
                  key={product._id}
                  className={cn(
                    "rounded-lg border p-4",
                    isActive ? "border-slate-400 bg-slate-50/40" : "border-slate-200",
                  )}
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-medium text-slate-900">{product.name}</p>
                      {product.techDescription && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.techDescription}</p>
                      )}
                      {liveResult && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Latest: {candidateCount === 0 ? "no candidates" : `${candidateCount} candidate${candidateCount === 1 ? "" : "s"}`} ·{" "}
                          {Math.round(liveResult.classification.confidence * 100)}% confidence
                        </p>
                      )}
                      {latestRun && !liveResult && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Last run: {latestRun.finalControlEntry ?? "pending review"} ·{" "}
                          {latestRun.controlListVersion ?? "—"}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!canQuery || isLoading}
                      onClick={() => void handleClassify(product._id)}
                      className="flex h-8 shrink-0 items-center gap-2 rounded-md bg-black px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Classify
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
      </section>

      {activeProductId && !resultsByProduct[activeProductId] && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Running classification{activeProduct?.name ? ` for ${activeProduct.name}` : ""}…
          </div>
        </section>
      )}

      {activeResult && (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Confidence", `${Math.round(activeResult.confidence * 100)}%`, "border-slate-200 bg-slate-50 text-slate-800"],
              ["Control list", activeResult.controlListVersion, "border-slate-200 bg-slate-50 text-slate-800"],
              [
                "Outcome",
                activeResult.requiresReview ? "Review" : hasCandidates ? "Check" : "No candidates",
                activeResult.requiresReview
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : hasCandidates
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : "border-green-200 bg-green-50 text-green-800",
              ],
            ].map(([label, value, tone]) => (
              <div key={label as string} className={cn("rounded-lg border px-4 py-3", tone)}>
                <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">{label as string}</p>
                <p className="mt-1 text-sm font-semibold">{value as string}</p>
              </div>
            ))}
          </div>

          <p
            className={cn(
              "rounded-lg border p-3 text-xs",
              hasCandidates ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            <ShieldAlert className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
            {activeResult.disclaimer}
          </p>

          {activeResult.predicateHits.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-xs font-semibold text-slate-900">Deterministic predicates</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {activeResult.predicateHits.map((hit) => (
                  <div key={`${hit.entryCode}-${hit.label}`} className="flex gap-3 py-3">
                    {hit.outcome === "threshold_met" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        {hit.entryCode} — {hit.label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{hit.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-xs font-semibold text-slate-900">Candidate control entries</h3>
            <div className="mt-3 space-y-3">
              {![...activeResult.matches, ...activeResult.possible_matches].length ? (
                <p className="text-xs text-slate-600">
                  No candidates found for this product. If you expected a control entry, upload a technical datasheet (crypto, ranges, accuracy, materials, tolerances) and re-run.
                </p>
              ) : (
                [...activeResult.matches, ...activeResult.possible_matches].map((item) => (
                  <div key={`${item.entryCode}-${item.clausePath}`} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-slate-900">{item.entryCode}</p>
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 uppercase">
                        Review
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-700">{item.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.rationale}</p>
                    {item.citation && (
                      <p className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-500 italic">
                        &ldquo;{item.citation.slice(0, 280)}{item.citation.length > 280 ? "…" : ""}&rdquo;
                      </p>
                    )}
                    {item.missingDiscriminators.length > 0 && (
                      <p className="mt-2 text-[11px] text-amber-700">
                        Missing: {item.missingDiscriminators.join(", ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
