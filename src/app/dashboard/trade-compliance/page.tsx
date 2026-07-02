"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileCheck2,
  FileText,
  Paperclip,
  Play,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceTab = "overview" | "assessments" | "templates" | "datasets" | "reports";
type AssessmentTab = "overview" | "export" | "sanctions" | "licences" | "documents" | "audit";
type CheckStatus = "pass" | "warning" | "fail";

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assessments", label: "Assessments" },
  { id: "templates", label: "Templates" },
  { id: "datasets", label: "Datasets" },
  { id: "reports", label: "Reports" },
];

const assessmentTabs: Array<{ id: AssessmentTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "export", label: "Export Controls" },
  { id: "sanctions", label: "Sanctions" },
  { id: "licences", label: "Licences" },
  { id: "documents", label: "Documents" },
  { id: "audit", label: "Audit Log" },
];

const checks: Record<AssessmentTab, Array<{ label: string; detail: string; status: CheckStatus }>> = {
  overview: [],
  export: [
    { label: "UK Military List", detail: "No direct match identified", status: "pass" },
    { label: "UK Dual-Use List", detail: "Possible candidate 5A002 due to encryption functionality", status: "warning" },
    { label: "End-use controls", detail: "Industrial monitoring end use declared", status: "pass" },
  ],
  sanctions: [
    { label: "Party screening", detail: "No listed party matches", status: "pass" },
    { label: "Country restrictions", detail: "Enhanced destination review recommended", status: "warning" },
    { label: "Embargoes", detail: "No embargo restriction identified", status: "pass" },
  ],
  licences: [
    { label: "Licence requirement", detail: "SIEL review recommended before declaration attachment", status: "warning" },
    { label: "Existing licence", detail: "No licence attached", status: "warning" },
  ],
  documents: [
    { label: "Commercial Invoice.pdf", detail: "Attached", status: "pass" },
    { label: "Packing List.pdf", detail: "Attached", status: "pass" },
    { label: "Technical Datasheet.pdf", detail: "Attached", status: "pass" },
  ],
  audit: [
    { label: "Assessment created", detail: "Jason Dean, 30 Jun 2026", status: "pass" },
    { label: "Datasets loaded", detail: "UK-ECO-2026.06", status: "pass" },
    { label: "Review state set", detail: "Review Required", status: "warning" },
  ],
};

function statusStyle(status: CheckStatus) {
  if (status === "pass") return "border-green-200 bg-green-50 text-green-700";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  if (status === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <XCircle className="h-3.5 w-3.5 text-red-600" />;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-black">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
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

export default function TradeCompliancePage() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("overview");
  const [activeAssessment, setActiveAssessment] = useState(false);
  const [assessmentTab, setAssessmentTab] = useState<AssessmentTab>("overview");

  if (activeAssessment) {
    return (
      <div className="space-y-8 p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <button
              type="button"
              onClick={() => setActiveAssessment(false)}
              className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Trade Compliance
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Assessment TC-2026-00184</h1>
            <p className="mt-1 text-sm text-slate-500">Review shipment compliance findings before customs submission.</p>
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

        {assessmentTab === "overview" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SectionCard title="Overview">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Overall result", "Review Required", "border-amber-200 bg-amber-50 text-amber-800"],
                  ["Shipment", "Encrypted industrial gateway module", "border-slate-200 bg-slate-50 text-slate-700"],
                  ["Destination", "United Arab Emirates", "border-slate-200 bg-slate-50 text-slate-700"],
                ].map(([label, value, tone]) => (
                  <div key={label} className={cn("rounded-lg border px-4 py-3", tone)}>
                    <p className="text-[0.625rem] font-semibold uppercase tracking-widest opacity-70">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                The technical datasheet indicates possible encryption functionality. Confirm whether candidate control 5A002 applies before attaching this assessment to a declaration.
              </p>
            </SectionCard>

            <SectionCard title="Metadata">
              <dl className="space-y-3 text-xs">
                {[
                  ["Created by", "Jason Dean"],
                  ["Assessment date", "30 Jun 2026"],
                  ["Assessment version", "1.0"],
                  ["Dataset version", "UK-ECO-2026.06"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          </div>
        ) : (
          <SectionCard title={assessmentTabs.find((tab) => tab.id === assessmentTab)?.label ?? "Assessment"}>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {checks[assessmentTab].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="flex gap-3">
                    <StatusIcon status={item.status} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", statusStyle(item.status))}>
                    {item.status === "pass" ? "Clear" : item.status === "warning" ? "Review" : "Blocked"}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Trade Compliance</h1>
          <p className="mt-1 text-sm text-slate-500">Assessments, templates, datasets and reports for shipment compliance.</p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-6 whitespace-nowrap">
          <button type="button" className="flex h-9 items-center gap-2 text-xs font-medium text-black hover:text-slate-600">
            <Paperclip className="h-3.5 w-3.5" />
            Import Template
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkspaceTab("assessments");
              setActiveAssessment(true);
            }}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Play className="h-3.5 w-3.5" />
            New Assessment
          </button>
        </div>
      </div>

      <Tabs tabs={workspaceTabs} value={workspaceTab} onChange={setWorkspaceTab} />

      {workspaceTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Open assessments", "3", ClipboardList],
            ["Review required", "1", AlertTriangle],
            ["Datasets", "4", Database],
            ["Reports", "12", FileText],
          ].map(([label, value, Icon]) => {
            const TileIcon = Icon as typeof ClipboardList;
            return (
              <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">{label as string}</p>
                  <TileIcon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-5 text-3xl font-medium tracking-tight text-slate-900">{value as string}</p>
              </div>
            );
          })}
        </div>
      )}

      {workspaceTab === "assessments" && (
        <SectionCard title="Assessments">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Assessment</th>
                  <th className="px-4 py-3 font-medium">Shipment</th>
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-900">TC-2026-00184</td>
                  <td className="px-4 py-3 text-slate-700">Encrypted industrial gateway module</td>
                  <td className="px-4 py-3 text-slate-700">United Arab Emirates</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">Review</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setActiveAssessment(true)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      Open
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {workspaceTab !== "overview" && workspaceTab !== "assessments" && (
        <SectionCard title={workspaceTabs.find((tab) => tab.id === workspaceTab)?.label ?? "Trade Compliance"}>
          <p className="text-xs leading-relaxed text-slate-500">This workspace area is ready for saved {workspaceTab} content.</p>
        </SectionCard>
      )}
    </div>
  );
}
