"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  ClipboardCheck,
  Database,
  Lightbulb,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TreImportUpload } from "@/components/tre-import-upload";
import { TreOpportunities } from "@/components/tre-opportunities";
import { TreAuditFindings } from "@/components/tre-audit-findings";
import { TreHsSuggest } from "@/components/tre-hs-suggest";

type TreTab = "overview" | "duty" | "compliance" | "imports";

const tabs: Array<{ id: TreTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "duty", label: "Duty review" },
  { id: "compliance", label: "Compliance" },
  { id: "imports", label: "Imports" },
];

function formatGbp(amount: number): string {
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function WorkspaceTabs({
  value,
  onChange,
  dutyCount,
  complianceCount,
}: {
  value: TreTab;
  onChange: (tab: TreTab) => void;
  dutyCount: number;
  complianceCount: number;
}) {
  const badges: Partial<Record<TreTab, number>> = {
    duty: dutyCount,
    compliance: complianceCount,
  };

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-2 border-b-2 px-1 pb-3 text-xs font-medium transition-colors",
            value === tab.id
              ? "border-black text-black"
              : "border-transparent text-slate-500 hover:text-black",
          )}
        >
          {tab.label}
          {badges[tab.id] != null && badges[tab.id]! > 0 && (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {badges[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function OverviewPanel({
  onGoTo,
}: {
  onGoTo: (tab: TreTab) => void;
}) {
  const imports = useQuery(api.tre_imports.listImports);
  const opportunities = useQuery(api.tre_analytics.listOpportunities);
  const audit = useQuery(api.tre_audit.listAuditFindings);

  const rowsScanned = opportunities?.totalRowsScanned ?? audit?.totalRowsScanned ?? 0;
  const importCount = imports?.length ?? 0;
  const storedRows = imports?.reduce((sum, row) => sum + row.lineItemsStored, 0) ?? 0;
  const hasData = rowsScanned > 0;

  if (!hasData && imports === undefined) {
    return <p className="text-xs text-slate-400">Loading workspace…</p>;
  }

  if (!hasData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Upload your HMRC TRE export to scan past declarations for duty reviews and compliance checks.
        </p>
        <button
          type="button"
          onClick={() => onGoTo("imports")}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload TRE data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Rows in history",
            value: rowsScanned.toLocaleString("en-GB"),
            icon: Database,
          },
          {
            label: "Imports",
            value: `${importCount} file${importCount === 1 ? "" : "s"} · ${storedRows} rows`,
            icon: Upload,
          },
          {
            label: "Duty reviews",
            value:
              opportunities && opportunities.opportunityCount > 0
                ? `${opportunities.opportunityCount} to check`
                : "None flagged",
            icon: Lightbulb,
            highlight: (opportunities?.opportunityCount ?? 0) > 0,
          },
          {
            label: "Compliance flags",
            value:
              audit && audit.findingCount > 0
                ? `${audit.findingCount} to review`
                : "None flagged",
            icon: ClipboardCheck,
            highlight: (audit?.findingCount ?? 0) > 0,
          },
        ].map(({ label, value, icon: Icon, highlight }) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border p-4",
              highlight ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">{label}</p>
              <Icon className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {opportunities && opportunities.opportunityCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-medium text-amber-900">
            {opportunities.opportunityCount} declaration
            {opportunities.opportunityCount === 1 ? "" : "s"} may have paid full duty when a preferential
            rate existed.
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            Indicative difference for review: {formatGbp(opportunities.indicativeTotalDelta)} — not a
            reclaim amount.
          </p>
          <button
            type="button"
            onClick={() => onGoTo("duty")}
            className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Review duty flags →
          </button>
        </div>
      )}

      {audit && audit.findingCount > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-900">
            {audit.findingCount} compliance check{audit.findingCount === 1 ? "" : "s"} on your imported
            history.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            HS consistency, missing periods, and preference documentation gaps.
          </p>
          <button
            type="button"
            onClick={() => onGoTo("compliance")}
            className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Review compliance flags →
          </button>
        </div>
      )}

      {opportunities?.opportunityCount === 0 && audit?.findingCount === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50/50 px-4 py-3 text-xs text-green-800">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No duty or compliance flags on imported history. Data is saved for HS suggestions on new
          declarations.
        </div>
      )}

      <TreHsSuggest embedded />
    </div>
  );
}

export function TreWorkspace() {
  const [tab, setTab] = useState<TreTab>("overview");
  const opportunities = useQuery(api.tre_analytics.listOpportunities);
  const audit = useQuery(api.tre_audit.listAuditFindings);

  return (
    <div className="space-y-6">
      <WorkspaceTabs
        value={tab}
        onChange={setTab}
        dutyCount={opportunities?.opportunityCount ?? 0}
        complianceCount={audit?.findingCount ?? 0}
      />

      <div>
        {tab === "overview" && <OverviewPanel onGoTo={setTab} />}
        {tab === "duty" && <TreOpportunities embedded />}
        {tab === "compliance" && <TreAuditFindings embedded />}
        {tab === "imports" && <TreImportUpload embedded />}
      </div>
    </div>
  );
}
