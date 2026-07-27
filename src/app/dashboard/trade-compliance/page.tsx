"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AssessmentAuditPanel } from "@/components/trade-compliance/assessment-audit-panel";
import { DocumentAuditPanel } from "@/components/trade-compliance/document-audit-panel";
import { ExportClassificationPanel } from "@/components/trade-compliance/export-classification-panel";
import { ExportSanctionsPanel } from "@/components/trade-compliance/export-sanctions-panel";
import { ExportRoutingBanner } from "@/components/trade-compliance/export-routing-banner";
import { ConsultantSignoffCard } from "@/components/trade-compliance/consultant-signoff-card";
import { EndUserSendCard } from "@/components/trade-compliance/end-user-send-card";
import { ExportDraftPackPanel, buildDraftPackFromDetail } from "@/components/trade-compliance/export-draft-pack-panel";
import { openDraftPackPrintDialog } from "@/lib/export-controls/draft-pack";
import { countries } from "@/lib/data/countries";
import {
  getRememberedAssessmentsSnapshot,
  rememberAssessmentsSnapshot,
} from "@/lib/dashboard-compliance-cache";

type AssessmentTab = "overview" | "export" | "sanctions" | "draft" | "documents" | "audit";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review_required", label: "Review required" },
  { value: "flagged", label: "Flagged" },
  { value: "clear", label: "Clear" },
] as const;

const assessmentTabs: Array<{ id: AssessmentTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "export", label: "Export Controls" },
  { id: "sanctions", label: "Sanctions" },
  { id: "draft", label: "Licence management" },
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
  if (status === "review_required") return "Review required";
  return "Draft";
}

function formatAssessmentDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function resolveCountryLabel(code?: string) {
  if (!code) return "—";
  const match = countries.find((country) => country.code === code);
  return match ? `${match.name} (${code})` : code;
}

function routeLabel(route?: string) {
  if (!route || route === "none") return "—";
  return route.toUpperCase();
}

function AssessmentStatusBadge({ status }: { status: string }) {
  if (status === "clear") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
        <ShieldCheck className="h-3 w-3" />
        Clear
      </span>
    );
  }
  if (status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
        <ShieldAlert className="h-3 w-3" />
        Flagged
      </span>
    );
  }
  if (status === "review_required") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700">
        <ShieldAlert className="h-3 w-3" />
        Review required
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-700">
      Draft
    </span>
  );
}

function rowTintClass(status: string) {
  if (status === "flagged") return "bg-red-50/40 hover:bg-red-50";
  if (status === "review_required") return "bg-amber-50/40 hover:bg-amber-50";
  return "hover:bg-slate-50";
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

function AssessmentSheetBody({
  assessmentId,
  assessmentTab,
  onTabChange,
  assessmentDetail,
}: {
  assessmentId: Id<"export_assessments">;
  assessmentTab: AssessmentTab;
  onTabChange: (tab: AssessmentTab) => void;
  assessmentDetail: ReturnType<typeof useQuery<typeof api.export_controls.getAssessment>>;
}) {
  const assessment = assessmentDetail?.assessment;
  const firstProduct = assessmentDetail?.products?.[0];
  const draftBundle = assessmentDetail ? buildDraftPackFromDetail(assessmentDetail) : null;

  const handleDownloadPdf = () => {
    if (!draftBundle) return;
    openDraftPackPrintDialog(draftBundle);
  };

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-5 sm:px-8">
        <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg font-semibold text-slate-900">
              {assessment?.reference ?? "…"}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-slate-500">
              Export control assessment for this shipment
            </SheetDescription>
            {assessment && (
              <span
                className={cn(
                  "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                  statusTone(assessment.status),
                )}
              >
                {statusLabel(assessment.status)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!draftBundle}
              onClick={handleDownloadPdf}
              className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Print / save PDF
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Attach to Declaration
            </button>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-6 px-6 py-6 sm:px-8">
        <Tabs tabs={assessmentTabs} value={assessmentTab} onChange={onTabChange} />

        {assessmentTab === "overview" && (
          <div className="space-y-6">
            {assessment && assessmentDetail?.products && (
              <ExportRoutingBanner
                originJurisdiction={assessment.originJurisdiction}
                destinationCountry={assessment.destinationCountry}
                products={assessmentDetail.products}
              />
            )}
            {assessment && (
              <ConsultantSignoffCard
                assessmentId={assessmentId}
                status={assessment.status}
                variant="result"
              />
            )}
            {assessment && (
              <EndUserSendCard assessmentId={assessmentId} variant="result" />
            )}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-black">Overview</h2>
              {!assessment ? (
                <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className={cn("rounded-lg border px-4 py-3", statusTone(assessment.status))}>
                      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">Status</p>
                      <p className="mt-1 text-sm font-semibold">{statusLabel(assessment.status)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">Destination</p>
                      <p className="mt-1 text-sm font-semibold">{assessment.destinationCountry ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">Products</p>
                      <p className="mt-1 text-sm font-semibold">{assessmentDetail?.products.length ?? 0}</p>
                    </div>
                  </div>
                  {firstProduct && (
                    <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                      {firstProduct.name}
                      {firstProduct.techDescription ? ` — ${firstProduct.techDescription}` : ""}
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
                    ["Reference", assessment.reference ?? "—"],
                    ["Control list", assessment.controlListVersion ?? "—"],
                    ["Sanctions list", assessment.sanctionsVersion ?? "—"],
                    ["Route", assessment.submissionRoute ?? "—"],
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
          </div>
        )}

        {assessmentTab === "documents" && (
          <DocumentAuditPanel
            assessmentId={assessmentId}
            onExtractionComplete={() => onTabChange("export")}
          />
        )}

        {assessmentTab === "export" && <ExportClassificationPanel assessmentId={assessmentId} />}

        {assessmentTab === "sanctions" && <ExportSanctionsPanel assessmentId={assessmentId} />}

        {assessmentTab === "draft" && assessment && (
          <ExportDraftPackPanel
            assessmentId={assessmentId}
            assessmentStatus={assessment.status}
          />
        )}

        {assessmentTab === "audit" && (
          <AssessmentAuditPanel assessmentId={assessmentId} reference={assessment?.reference} />
        )}
      </div>
    </div>
  );
}

export default function TradeCompliancePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerkUserId = user?.id ?? "";
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<Id<"export_assessments"> | null>(null);
  const [assessmentTab, setAssessmentTab] = useState<AssessmentTab>("overview");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER_OPTIONS)[number]["value"]>("all");

  const assessments = useQuery(api.export_controls.listAssessments, canQuery ? {} : "skip");
  const remembered = clerkUserId ? getRememberedAssessmentsSnapshot(clerkUserId) : null;
  const resolvedAssessments = assessments ?? remembered?.assessments;

  useEffect(() => {
    if (!clerkUserId || assessments === undefined) return;
    rememberAssessmentsSnapshot(clerkUserId, assessments);
  }, [clerkUserId, assessments]);

  const assessmentDetail = useQuery(
    api.export_controls.getAssessment,
    canQuery && selectedAssessmentId ? { assessmentId: selectedAssessmentId } : "skip",
  );
  const createAssessment = useMutation(api.export_controls.createAssessment);

  const openAssessment = (id: Id<"export_assessments">, tab: AssessmentTab = "overview") => {
    setSelectedAssessmentId(id);
    setAssessmentTab(tab);
  };

  const closeAssessment = () => {
    setSelectedAssessmentId(null);
  };

  const handleNewAssessment = async () => {
    if (!canQuery) return;
    setCreating(true);
    try {
      const id = await createAssessment({ originJurisdiction: "GB" });
      openAssessment(id, "documents");
    } finally {
      setCreating(false);
    }
  };

  // Only first load (no live query and no remembered snapshot) shows placeholders.
  const isAssessmentsLoading = resolvedAssessments === undefined;
  const reviewCount = resolvedAssessments
    ? resolvedAssessments.filter((a) => a.status === "flagged" || a.status === "review_required").length
    : null;
  const draftCount = resolvedAssessments
    ? resolvedAssessments.filter((a) => a.status === "draft").length
    : null;
  const openCount = resolvedAssessments ? resolvedAssessments.length : null;

  const filteredAssessments = useMemo(() => {
    if (!resolvedAssessments) return [];

    return resolvedAssessments.filter((row) => {
      const query = searchQuery.trim().toLowerCase();
      const destinationLabel = resolveCountryLabel(row.destinationCountry).toLowerCase();
      const matchesSearch =
        !query ||
        row.reference.toLowerCase().includes(query) ||
        (row.destinationCountry?.toLowerCase().includes(query) ?? false) ||
        destinationLabel.includes(query);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [resolvedAssessments, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Trade Compliance</h1>
          <p className="mt-1 text-sm text-slate-500">Shipment compliance checks and assessments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Open assessments", value: openCount, icon: ClipboardList, hint: "All active checks" },
          { label: "Review required", value: reviewCount, icon: AlertTriangle, hint: "Flagged or needs review" },
          { label: "Draft", value: draftCount, icon: CheckCircle2, hint: "Not yet submitted" },
        ].map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">{label}</p>
              <Icon className="h-4 w-4 text-slate-400" />
            </div>
            {value === null ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" aria-hidden />
            ) : (
              <p className="mt-3 text-2xl font-medium tracking-tight text-slate-900 tabular-nums">{value}</p>
            )}
            <p className="mt-1 text-[0.625rem] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="relative z-20 overflow-visible border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by reference or destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50",
                  statusFilter !== "all" ? "border-slate-400" : "border-slate-200",
                )}
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 z-[120] w-48 rounded-md border border-slate-200 bg-white p-2 shadow-md">
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option.value);
                        setShowFilters(false);
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100",
                        statusFilter === option.value && "bg-slate-100 font-medium text-black",
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

        {isAssessmentsLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Destination</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Origin</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Route</th>
                  <th className="px-6 py-3 text-right text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                    Loading assessments…
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <FileText className="h-4 w-4 text-slate-300" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              {hasActiveFilters ? "No matching assessments" : "No assessments yet"}
            </h4>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              {hasActiveFilters
                ? "No assessments match your search or selected filters."
                : "Create one to upload documents and run export control checks."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Destination</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Origin</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Route</th>
                  <th className="px-6 py-3 text-right text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAssessments.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => openAssessment(row._id)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      rowTintClass(row.status),
                      selectedAssessmentId === row._id && "bg-slate-50",
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-black transition-colors group-hover:text-black">
                          {row.reference}
                        </span>
                        <span className="mt-0.5 text-[0.625rem] font-medium text-slate-500">
                          Export control assessment
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {formatAssessmentDate(row.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {resolveCountryLabel(row.destinationCountry)}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {row.originJurisdiction ?? "GB"}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {routeLabel(row.submissionRoute)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <AssessmentStatusBadge status={row.status} />
                        <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!selectedAssessmentId} onOpenChange={(open) => !open && closeAssessment()}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-none"
          style={{ width: "calc(100vw - 15rem)", maxWidth: "calc(100vw - 15rem)" }}
        >
          {selectedAssessmentId && (
            <AssessmentSheetBody
              assessmentId={selectedAssessmentId}
              assessmentTab={assessmentTab}
              onTabChange={setAssessmentTab}
              assessmentDetail={assessmentDetail}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
