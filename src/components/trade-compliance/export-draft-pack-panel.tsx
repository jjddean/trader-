"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, FileJson, Loader2 } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  buildDraftPackBundle,
  openDraftPackPrintDialog,
  type DraftPackAssessmentInput,
  type DraftPackBundle,
  type DraftPackLicenceInput,
  type DraftPackProductInput,
  type DraftPackScreeningInput,
} from "@/lib/export-controls/draft-pack";
import { ConsultantSignoffCard } from "@/components/trade-compliance/consultant-signoff-card";
import { EndUserSendCard } from "@/components/trade-compliance/end-user-send-card";
import { cn } from "@/lib/utils";

interface ExportDraftPackPanelProps {
  assessmentId: Id<"export_assessments">;
  assessmentStatus: string;
  onOpenLicences?: () => void;
}

function CopyFieldButton({ value, disabled }: { value: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value.trim() || disabled) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      disabled={disabled || !value.trim()}
      onClick={() => void handleCopy()}
      className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function groupLabel(group: string) {
  if (group === "assessment") return "Shipment";
  if (group === "parties") return "Parties & end use";
  if (group === "products") return "Items";
  return "Compliance";
}

export function ExportDraftPackPanel({
  assessmentId,
  assessmentStatus,
  onOpenLicences,
}: ExportDraftPackPanelProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const detail = useQuery(
    api.export_controls.getAssessment,
    canQuery ? { assessmentId } : "skip",
  );

  const [reviewerNotes, setReviewerNotes] = useState("");
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const [printError, setPrintError] = useState<string | null>(null);

  const bundle = useMemo<DraftPackBundle | null>(() => {
    if (!detail?.assessment) return null;
    return buildDraftPackBundle({
      assessment: detail.assessment,
      products: detail.products,
      screenings: detail.screenings,
      licences: detail.licences,
    });
  }, [detail]);

  if (!detail) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading draft pack…
      </div>
    );
  }

  if (!bundle) return null;

  const groupedFields = ["assessment", "parties", "products", "compliance"] as const;
  const canCopyAll = bundle.missingMandatory.length === 0;

  const handlePrintPdf = () => {
    setPrintError(null);
    const ok = openDraftPackPrintDialog(bundle, reviewerNotes);
    if (!ok) {
      setPrintError("Could not open print view. Allow pop-ups for this site and try again.");
    }
  };

  const handleDownloadJson = () => {
    const payload = { ...bundle, reviewerNotes: reviewerNotes.trim() || undefined };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${bundle.reference}-draft-pack.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <ConsultantSignoffCard assessmentId={assessmentId} status={assessmentStatus} variant="send" />

      {/* Timeline */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-black">Assessment timeline</h2>
        <ol className="mt-4 space-y-3">
          {bundle.timeline.map((step) => (
            <li key={step.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  step.status === "done" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400",
                )}
              >
                {step.status === "done" ? "✓" : "·"}
              </span>
              <div className="min-w-0">
                <p className={cn("text-xs font-medium", step.status === "done" ? "text-slate-900" : "text-slate-500")}>
                  {step.label}
                  {step.date && <span className="ml-2 font-normal text-slate-400">{step.date}</span>}
                </p>
                {step.hint && step.status === "pending" && (
                  <p className="mt-0.5 text-[11px] text-slate-400">{step.hint}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px] text-slate-500">{bundle.ecjuNote}</p>
      </section>

      {/* GOV.UK handoff */}
      <section
        className={cn(
          "rounded-xl border p-5",
          bundle.routing.route === "spire"
            ? "border-amber-200 bg-amber-50"
            : bundle.routing.route === "lite"
              ? "border-blue-200 bg-blue-50"
              : "border-slate-200 bg-slate-50",
        )}
      >
        <h2 className="text-sm font-semibold text-black">GOV.UK handoff</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">{bundle.routing.headline}</p>
        {bundle.routing.route !== "none" && (
          <a
            href={bundle.routing.govUkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-900 underline underline-offset-2"
          >
            {bundle.routing.route === "spire"
              ? "View SPIRE / SIEL guidance on GOV.UK"
              : "Open official GOV.UK SIEL service"}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          Copy fields below into the official form. After submitting, record your application reference on the{" "}
          {onOpenLicences ? (
            <button type="button" onClick={onOpenLicences} className="font-medium underline">
              Licences
            </button>
          ) : (
            "Licences"
          )}{" "}
          tab.
        </p>
      </section>

      <EndUserSendCard assessmentId={assessmentId} variant="send" />

      {/* Missing fields warning */}
      {bundle.missingMandatory.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>{bundle.missingMandatory.length} mandatory field(s) missing</strong> — you can still view the pack,
          but Copy is disabled for empty mandatory fields until extraction or classification is complete.
        </p>
      )}

      {/* Draft pack fields */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-black">Draft pack fields</h2>
            <p className="mt-1 text-xs text-slate-500">{bundle.disclaimer}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileJson className="h-3.5 w-3.5" />
              JSON bundle
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Print / save PDF
            </button>
          </div>
        </div>

        {printError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{printError}</p>
        )}

        <div className="mt-5 space-y-6">
          {groupedFields.map((group) => {
            const fields = bundle.fields.filter((f) => f.group === group);
            if (fields.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                  {groupLabel(group)}
                </h3>
                <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {fields.map((field) => {
                    const isMissing = field.mandatory && !field.value.trim();
                    return (
                      <div key={field.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-slate-600">
                            {field.label}
                            {field.mandatory && <span className="text-amber-600"> *</span>}
                          </p>
                          <p className={cn("mt-0.5 text-xs", isMissing ? "text-amber-700 italic" : "text-slate-900")}>
                            {field.value.trim() || (isMissing ? "Missing — complete on Documents or Export Controls" : "—")}
                          </p>
                        </div>
                        <CopyFieldButton value={field.value} disabled={isMissing} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <label htmlFor="reviewer-notes" className="text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
            Reviewer notes (optional)
          </label>
          <textarea
            id="reviewer-notes"
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes — included in print/PDF only"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
          />
          {reviewerNotes.trim() && <CopyFieldButton value={reviewerNotes} />}
        </div>
      </section>

      {/* Supporting docs checklist */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-black">Supporting documents</h2>
        <p className="mt-1 text-xs text-slate-500">Tick when attached to your GOV.UK application pack.</p>
        <ul className="mt-4 space-y-3">
          {bundle.supportingDocs.map((doc) => (
            <li key={doc.id} className="flex items-start gap-3">
              <input
                id={`doc-${doc.id}`}
                type="checkbox"
                checked={checkedDocs[doc.id] ?? false}
                onChange={(e) => setCheckedDocs((prev) => ({ ...prev, [doc.id]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor={`doc-${doc.id}`} className="min-w-0 cursor-pointer">
                <p className="text-xs font-medium text-slate-900">{doc.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{doc.note}</p>
              </label>
            </li>
          ))}
        </ul>
        {canCopyAll && (
          <p className="mt-4 text-[11px] text-green-700">All mandatory draft pack fields are populated.</p>
        )}
      </section>
    </div>
  );
}

export function buildDraftPackFromDetail(detail: {
  assessment: DraftPackAssessmentInput & { _id: string };
  products: DraftPackProductInput[];
  screenings: DraftPackScreeningInput[];
  licences: DraftPackLicenceInput[];
}) {
  if (!detail?.assessment) return null;
  return buildDraftPackBundle({
    assessment: detail.assessment,
    products: detail.products,
    screenings: detail.screenings,
    licences: detail.licences,
  });
}
