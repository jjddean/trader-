"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, Play, ShieldAlert, X } from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface ExportSanctionsPanelProps {
  assessmentId: Id<"export_assessments">;
}

export function ExportSanctionsPanel({ assessmentId }: ExportSanctionsPanelProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canMutate = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const detail = useQuery(
    api.export_controls.getAssessment,
    canMutate ? { assessmentId } : "skip",
  );
  const reviewScreening = useMutation(api.export_controls.reviewSanctionsScreening);

  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const assessment = detail?.assessment;
  const parties = [
    assessment?.consignee?.name ? { type: "consignee", name: assessment.consignee.name as string } : null,
    assessment?.endUser?.name ? { type: "end user", name: assessment.endUser.name as string } : null,
  ].filter(Boolean) as Array<{ type: string; name: string }>;

  const handleScreen = async () => {
    if (!canMutate) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/export-controls/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, persist: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Screening failed (${res.status})`);
      }

      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (screeningId: Id<"sanctions_screenings">, reviewStatus: "confirmed" | "dismissed") => {
    if (!canMutate) return;
    setReviewingId(screeningId);
    try {
      await reviewScreening({ screeningId, reviewStatus });
    } finally {
      setReviewingId(null);
    }
  };

  const pendingScreenings = detail?.screenings?.filter((s) => s.reviewStatus === "pending") ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-sm font-semibold text-black">UK Sanctions List screening</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              Deterministic name and identifier matching against UKSL (R2). All hits require human confirmation — never auto-clear.
            </p>
          </div>
          <button
            type="button"
            disabled={!canMutate || loading || parties.length === 0}
            onClick={() => void handleScreen()}
            className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Screen parties
          </button>
        </div>

        {parties.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No consignee or end user on this assessment. Upload documents on the Documents tab first.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {parties.map((party) => (
              <span
                key={`${party.type}-${party.name}`}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
              >
                {party.type}: {party.name}
              </span>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
      </section>

      {pendingScreenings.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-white p-5">
          <h3 className="text-xs font-semibold text-slate-900">Pending review ({pendingScreenings.length})</h3>
          <div className="mt-3 space-y-3">
            {pendingScreenings.map((screening) => (
              <div key={screening._id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-900">
                      {screening.subjectType}: {screening.subjectName}
                    </p>
                    {screening.matchedUniqueId && (
                      <p className="mt-1 text-xs text-slate-600">
                        {screening.matchedUniqueId} · score {screening.score ?? "—"}
                      </p>
                    )}
                    {screening.matchReason && (
                      <p className="mt-1 text-xs text-slate-500">{screening.matchReason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={reviewingId === screening._id}
                      onClick={() => void handleReview(screening._id, "confirmed")}
                      className="flex h-8 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                    >
                      {reviewingId === screening._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Confirm hit
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === screening._id}
                      onClick={() => void handleReview(screening._id, "dismissed")}
                      className="flex h-8 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {result && (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["UKSL version", result.sanctionsVersion, "border-slate-200 bg-slate-50"],
              [
                "Snapshot fresh",
                result.snapshotFresh?.fresh ? "Yes" : `No (${result.snapshotFresh?.reason})`,
                result.snapshotFresh?.fresh ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50",
              ],
              ["Auto-clear", "Blocked", "border-amber-200 bg-amber-50"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className={cn("rounded-lg border px-4 py-3", tone)}>
                <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">{label as string}</p>
                <p className="mt-1 text-sm font-semibold">{value as string}</p>
              </div>
            ))}
          </div>

          {!result.snapshotFresh?.fresh && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
              Snapshot is stale or missing — CLEAR would be refused until daily refresh runs (RT-08/RT-09).
            </p>
          )}

          {result.results?.map((party: any) => (
            <div key={party.subject.name} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-900">
                {party.subject.subjectType}: {party.subject.name}
              </p>
              {party.matches.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No matches above threshold.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {party.matches.map((match: any) => (
                    <div key={match.uniqueId} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{match.uniqueId}</p>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase",
                            match.band.band === "block"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-amber-200 bg-amber-50 text-amber-800",
                          )}
                        >
                          {match.band.band}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{match.regimeName}</p>
                      <p className="mt-2 text-xs text-slate-700">
                        {match.matchReason} · score {match.score}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {(detail?.screenings?.length ?? 0) > 0 && pendingScreenings.length === 0 && !result && (
        <p className="text-xs text-slate-500">All screenings reviewed. Run again after party details change.</p>
      )}
    </div>
  );
}
