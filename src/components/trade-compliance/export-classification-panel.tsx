"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Loader2, Play, ShieldAlert, X } from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
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
  runId?: Id<"export_classification_runs">;
}

const CLASSIFICATION_DISCLAIMER =
  "Candidate control entries identified — human review required before any export decision.";

type StoredRun = {
  _id: Id<"export_classification_runs">;
  candidates?: {
    matches?: ClassificationResponse["classification"]["matches"];
    possible_matches?: ClassificationResponse["classification"]["possible_matches"];
    predicateHits?: ClassificationResponse["classification"]["predicateHits"];
  };
  confidence?: number;
  requiresReview: boolean;
  controlListVersion?: string;
  finalControlEntry?: string;
};

type ProductRow = {
  _id: Id<"export_products">;
  name: string;
  techDescription?: string;
  classificationRuns?: StoredRun[];
};

function classificationFromRun(run: StoredRun): ClassificationResponse {
  return {
    runId: run._id,
    classification: {
      matches: run.candidates?.matches ?? [],
      possible_matches: run.candidates?.possible_matches ?? [],
      predicateHits: run.candidates?.predicateHits ?? [],
      confidence: run.confidence ?? 0,
      requiresReview: run.requiresReview,
      controlListVersion: run.controlListVersion ?? "—",
      disclaimer: CLASSIFICATION_DISCLAIMER,
    },
  };
}

function reviewLabel(approval: string | null) {
  if (approval === null) return "Pending review";
  if (approval === "") return "Not controlled";
  return approval;
}

function productApproval(run?: StoredRun, localOverride?: string | null) {
  if (localOverride !== undefined) return localOverride;
  if (!run || run.requiresReview !== false) return null;
  return run.finalControlEntry ?? "";
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
  const reviewRun = useMutation(api.export_controls.reviewClassificationRun);

  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<Id<"export_products"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsByProduct, setResultsByProduct] = useState<Record<string, ClassificationResponse>>({});
  const [reviewingRunId, setReviewingRunId] = useState<Id<"export_classification_runs"> | null>(null);
  const [localApprovedByProduct, setLocalApprovedByProduct] = useState<Record<string, string | null>>({});

  const products = (detail?.products ?? []) as ProductRow[];

  useEffect(() => {
    if (products.length > 0 && !activeProductId) {
      setActiveProductId(products[0]._id);
    }
  }, [products, activeProductId]);

  const openProduct = (productId: Id<"export_products">) => {
    setActiveProductId(productId);
    setError(null);
    if (resultsByProduct[productId]) return;

    const product = products.find((p) => p._id === productId);
    const run = product?.classificationRuns?.[0];
    if (run?.candidates) {
      setResultsByProduct((prev) => ({
        ...prev,
        [productId]: classificationFromRun(run),
      }));
    }
  };

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
      setResultsByProduct((prev) => ({
        ...prev,
        [productId]: {
          ...data,
          runId: data.runId as Id<"export_classification_runs"> | undefined,
        },
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setLoadingProductId(null);
    }
  };

  const activeProduct = activeProductId ? products.find((p) => p._id === activeProductId) : undefined;
  const activeResult = activeProductId ? resultsByProduct[activeProductId]?.classification : undefined;
  const activeRunId: Id<"export_classification_runs"> | undefined =
    (activeProductId ? resultsByProduct[activeProductId]?.runId : undefined) ??
    activeProduct?.classificationRuns?.[0]?._id;
  const latestRun = activeProduct?.classificationRuns?.[0];
  const localApproval = activeProductId ? localApprovedByProduct[activeProductId] : undefined;
  const resolvedApproval = productApproval(latestRun, localApproval);
  const isReviewBusy = reviewingRunId != null;
  const isClassifying = activeProductId != null && loadingProductId === activeProductId;
  const hasCandidates =
    activeResult ? [...activeResult.matches, ...activeResult.possible_matches].length > 0 : false;

  const handleReview = async ({
    approved,
    finalControlEntry,
  }: {
    approved: boolean;
    finalControlEntry?: string;
  }) => {
    if (!canQuery || !activeProductId) return;
    if (!activeRunId) {
      setError("No classification run to review yet. Run Classify first.");
      return;
    }

    setError(null);
    setReviewingRunId(activeRunId);
    try {
      await reviewRun({ runId: activeRunId, approved, finalControlEntry });
      setLocalApprovedByProduct((prev) => ({
        ...prev,
        [activeProductId]: approved ? (finalControlEntry ?? "") : null,
      }));
      setResultsByProduct((prev) => {
        const existing = prev[activeProductId];
        if (!existing) return prev;
        return {
          ...prev,
          [activeProductId]: {
            ...existing,
            classification: {
              ...existing.classification,
              requiresReview: !approved,
            },
          },
        };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save review decision");
    } finally {
      setReviewingRunId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-black">Control entry classification</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Select a product, run Classify, then approve one control entry — all in the same panel.
        </p>
      </div>

      {!detail ? (
        <div className="flex items-center gap-2 p-6 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading products…
        </div>
      ) : products.length === 0 ? (
        <p className="m-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No products on this assessment yet. Upload a commercial invoice or tech spec on the Documents tab.
        </p>
      ) : (
        <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Product picker */}
          <div className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
            <p className="px-4 pt-4 text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
              Products ({products.length})
            </p>
            <ul className="space-y-1 p-2">
              {products.map((product) => {
                const run = product.classificationRuns?.[0];
                const approval = productApproval(run, localApprovedByProduct[product._id]);
                const isActive = activeProductId === product._id;
                const isLoading = loadingProductId === product._id;

                return (
                  <li key={product._id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product._id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "border-slate-400 bg-slate-100"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <p className="line-clamp-2 text-xs font-medium text-slate-900">{product.name}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                        ) : approval === null ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            Pending
                          </span>
                        ) : approval === "" ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            Not controlled
                          </span>
                        ) : (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            {approval}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Review workspace — classify + candidates for selected product only */}
          <div className="flex flex-col">
            {!activeProduct ? (
              <p className="p-6 text-xs text-slate-500">Select a product to classify.</p>
            ) : (
              <>
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{activeProduct.name}</h3>
                      {activeProduct.techDescription && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{activeProduct.techDescription}</p>
                      )}
                      {resolvedApproval !== null && (
                        <p className="mt-2 text-[11px] font-medium text-slate-600">
                          Decision: {reviewLabel(resolvedApproval)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!canQuery || isClassifying}
                      onClick={() => void handleClassify(activeProduct._id)}
                      className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isClassifying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {activeResult ? "Re-run Classify" : "Classify"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {error && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
                  )}

                  {isClassifying && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running classification…
                    </div>
                  )}

                  {!isClassifying && !activeResult && (
                    <p className="text-xs text-slate-500">
                      Click <strong>Classify</strong> to find control entry candidates for this product.
                    </p>
                  )}

                  {activeResult && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          ["Confidence", `${Math.round(activeResult.confidence * 100)}%`],
                          ["Control list", activeResult.controlListVersion],
                          [
                            "Outcome",
                            activeResult.requiresReview ? "Review" : hasCandidates ? "Check" : "No candidates",
                          ],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
                              {label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                          </div>
                        ))}
                      </div>

                      <p
                        className={cn(
                          "rounded-lg border p-3 text-xs",
                          hasCandidates
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                        )}
                      >
                        <ShieldAlert className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
                        {activeResult.disclaimer}
                      </p>

                      {activeResult.predicateHits.length > 0 && (
                        <div className="rounded-lg border border-slate-200 p-4">
                          <h4 className="text-xs font-semibold text-slate-900">Deterministic predicates</h4>
                          <div className="mt-2 divide-y divide-slate-100">
                            {activeResult.predicateHits.map((hit) => (
                              <div key={`${hit.entryCode}-${hit.label}`} className="flex gap-3 py-2.5">
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

                      <div className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-xs font-semibold text-slate-900">Pick one control entry</h4>
                          {hasCandidates && (
                            <button
                              type="button"
                              disabled={!activeRunId || isReviewBusy}
                              onClick={() => void handleReview({ approved: false })}
                              className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {isReviewBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              Needs more info
                            </button>
                          )}
                        </div>

                        <div className="mt-3 space-y-3">
                          {!hasCandidates ? (
                            <div className="space-y-3">
                              <p className="text-xs text-slate-600">
                                No candidates found. Upload a technical datasheet and re-run Classify.
                              </p>
                              <button
                                type="button"
                                disabled={!activeRunId || isReviewBusy}
                                onClick={() => void handleReview({ approved: true })}
                                className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve: not controlled
                              </button>
                            </div>
                          ) : (
                            [...activeResult.matches, ...activeResult.possible_matches].map((item) => {
                              const isApproved = resolvedApproval === item.entryCode;
                              return (
                                <div
                                  key={`${item.entryCode}-${item.clausePath}`}
                                  className={cn(
                                    "rounded-lg border p-3",
                                    isApproved ? "border-green-300 bg-green-50/50" : "border-slate-200",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900">{item.entryCode}</p>
                                      <p className="mt-0.5 text-[11px] text-slate-500">{item.clausePath}</p>
                                    </div>
                                    {isApproved ? (
                                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                        <Check className="h-3.5 w-3.5" />
                                        Approved
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={!activeRunId || isReviewBusy}
                                        onClick={() =>
                                          void handleReview({ approved: true, finalControlEntry: item.entryCode })
                                        }
                                        className="flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-black px-2.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                      >
                                        Approve
                                      </button>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs font-medium text-slate-700">{item.title}</p>
                                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.rationale}</p>
                                  {item.missingDiscriminators.length > 0 && (
                                    <p className="mt-2 text-[11px] text-amber-700">
                                      Missing: {item.missingDiscriminators.join(", ")}
                                    </p>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
