"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  Loader2,
  Play,
} from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { DocumentAuditPanel } from "@/components/trade-compliance/document-audit-panel";
import { ExportClassificationPanel } from "@/components/trade-compliance/export-classification-panel";
import { ExportSanctionsPanel } from "@/components/trade-compliance/export-sanctions-panel";

type WorkspaceTab = "overview" | "assessments";
type AssessmentTab = "overview" | "export" | "sanctions" | "licences" | "documents" | "audit";

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assessments", label: "Assessments" },
];

const assessmentTabs: Array<{ id: AssessmentTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "export", label: "Export Controls" },
  { id: "sanctions", label: "Sanctions" },
  { id: "licences", label: "Licences" },
  { id: "audit", label: "Audit Log" },
];

function statusTone(status: string) {
  if (status === "clear") return "border-green-200 bg-green-50 text-green-800";
  if (status === "flagged") return "border-red-200 bg-red-50 text-red-800";
  if (status === "review_required") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusLabel(status: string) {
  if (status === "clear") return "Clear";
  if (status === "flagged") return "Flagged";
  if (status === "review_required") return "Review";
  return "Draft";
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-2 px-1 pb-3 text-xs font-medium transition-colors",
            value === tab.id
              ? "border-black text-black"
              : "border-transparent text-slate-500 hover:text-black",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PlaceholderPane({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-black">{title}</h2>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{detail}</p>
    </section>
  );
}

export default function TradeCompliancePage() {
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("assessments");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<Id<"export_assessments"> | null>(null);
  const [assessmentTab, setAssessmentTab] = useState<AssessmentTab>("overview");
  const [creating, setCreating] = useState(false);

  const assessments = useQuery(api.export_controls.listAssessments, canQuery ? {} : "skip");
  const assessmentDetail = useQuery(
    api.export_controls.getAssessment,
    canQuery && selectedAssessmentId ? { assessmentId: selectedAssessmentId } : "skip",
  );
  const createAssessment = useMutation(api.export_controls.createAssessment);

  const openAssessment = (id: Id<"export_assessments">) => {
    setSelectedAssessmentId(id);
    setAssessmentTab("overview");
  };

  const closeAssessment = () => {
    setSelectedAssessmentId(null);
    setWorkspaceTab("assessments");
  };

  const handleNewAssessment = async () => {
    if (!canQuery) return;
    setCreating(true);
    try {
      const id = await createAssessment({ originJurisdiction: "GB" });
      openAssessment(id);
      setAssessmentTab("documents");
    } finally {
      setCreating(false);
    }
  };

  const reviewCount =
    assessments?.filter((a) => a.status === "flagged" || a.status === "review_required").length ?? 0;

  if (selectedAssessmentId) {
    const assessment = assessmentDetail?.assessment;
    const reference = assessment?.reference ?? "ÔÇª";
    const firstProduct = assessmentDetail?.products?.[0];

    return (
      <div className="space-y-8 p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <button
              type="button"
              onClick={closeAssessment}
              className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Assessments
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{reference}</h1>
            <p className="mt-1 text-sm text-slate-500">Export control assessment for this shipment.</p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-6 whitespace-nowrap">
            <button type="button" className="flex h-9 items-center gap-2 text-xs font-medium text-black hover:text-slate-600">
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
            <button type="button" className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800">
              <FileCheck2 className="h-3.5 w-3.5" />
              Attach to Declaration
            </button>
          </div>
        </div>

        <Tabs tabs={assessmentTabs} value={assessmentTab} onChange={setAssessmentTab} />

        {assessmentTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-black">Overview</h2>
              {!assessment ? (
                <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  LoadingÔÇª
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className={cn("rounded-lg border px-4 py-3", statusTone(assessment.status))}>
                      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">Status</p>
                      <p className="mt-1 text-sm font-semibold">{statusLabel(assessment.status)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">Destination</p>
                      <p className="mt-1 text-sm font-semibold">{assessment.destinationCountry ?? "ÔÇö"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">Products</p>
                      <p className="mt-1 text-sm font-semibold">{assessmentDetail?.products.length ?? 0}</p>
                    </div>
                  </div>
                  {firstProduct && (
                    <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                      {firstProduct.name}
                      {firstProduct.techDescription ? ` ÔÇö ${firstProduct.techDescription}` : ""}
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-black">Metadata</h2>
              {assessment && (
                <dl className="mt-5 space-y-3 text-xs">
                  {[
                    ["Reference", assessment.reference ?? "ÔÇö"],
                    ["Control list", assessment.controlListVersion ?? "ÔÇö"],
                    ["Sanctions list", assessment.sanctionsVersion ?? "ÔÇö"],
                    ["Route", assessment.submissionRoute ?? "ÔÇö"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        )}

        {assessmentTab === "documents" && selectedAssessmentId && (
          <DocumentAuditPanel assessmentId={selectedAssessmentId} />
        )}

        {assessmentTab === "export" && selectedAssessmentId && (
          <ExportClassificationPanel assessmentId={selectedAssessmentId} />
        )}

        {assessmentTab === "sanctions" && selectedAssessmentId && (
          <ExportSanctionsPanel assessmentId={selectedAssessmentId} />
        )}

        {assessmentTab === "licences" && (
          <PlaceholderPane
            title="Licences"
            detail="Record SIEL or F680 application and licence references after GOV.UK submission (Phase 6)."
          />
        )}

        {assessmentTab === "audit" && (
          <PlaceholderPane
            title="Audit Log"
            detail="Assessment audit trail from auditLogs ÔÇö wired in a later pass."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Export Control</h1>
          <p className="mt-1 text-sm text-slate-500">Shipment compliance checks and assessments.</p>
        </div>
        <button
          type="button"
          disabled={!canQuery || creating}
          onClick={() => void handleNewAssessment()}
          className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          New Assessment
        </button>
      </div>

      <Tabs tabs={workspaceTabs} value={workspaceTab} onChange={setWorkspaceTab} />

      {workspaceTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Open assessments", String(assessments?.length ?? "ÔÇö"), ClipboardList],
            ["Review required", String(reviewCount), AlertTriangle],
            ["Draft", String(assessments?.filter((a) => a.status === "draft").length ?? "ÔÇö"), CheckCircle2],
          ].map(([label, value, Icon]) => {
            const TileIcon = Icon as typeof ClipboardList;
            return (
              <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">{label as string}</p>
                  <TileIcon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-5 text-3xl font-medium tracking-tight text-slate-900">{value as string}</p>
              </div>
            );
          })}
        </div>
      )}

      {workspaceTab === "assessments" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-black">Assessments</h2>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            {!assessments ? (
              <div className="flex items-center gap-2 px-4 py-8 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                LoadingÔÇª
              </div>
            ) : assessments.length === 0 ? (
              <p className="px-4 py-8 text-xs text-slate-500">No assessments yet. Create one to start.</p>
            ) : (
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Destination</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((row) => (
                    <tr key={row._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-900">{row.reference ?? row._id}</td>
                      <td className="px-4 py-3 text-slate-700">{row.destinationCountry ?? "ÔÇö"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                            statusTone(row.status),
                          )}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openAssessment(row._id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
