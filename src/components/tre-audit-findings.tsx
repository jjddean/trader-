"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { TreAuditFinding } from "../../convex/tre_audit";
import { AlertTriangle, ChevronRight, ClipboardCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function Panel({ embedded, children }: { embedded?: boolean; children: ReactNode }) {
  if (embedded) return <div className="space-y-4">{children}</div>;
  return <div className="rounded-xl border border-slate-200 bg-white p-6">{children}</div>;
}

export function TreAuditFindings({ embedded = false }: { embedded?: boolean }) {
  const [showFindings, setShowFindings] = useState(false);
  const data = useQuery(api.tre_audit.listAuditFindings, {});
  const findingsOpen = embedded || showFindings;

  if (data === undefined) {
    return (
      <Panel embedded={embedded}>
        <p className="text-xs text-slate-400">Scanning TRE history…</p>
      </Panel>
    );
  }

  if (data.totalRowsScanned === 0) {
    return (
      <Panel embedded={embedded}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black">
          <ClipboardCheck className="h-4 w-4 text-slate-400" />
          Compliance checks
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Import TRE data to run HS consistency, history gap, and preference document checks.
        </p>
      </Panel>
    );
  }

  return (
    <Panel embedded={embedded}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-black">
            <ClipboardCheck className="h-4 w-4 text-slate-400" />
            Compliance checks
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-slate-600 uppercase">
              {data.findingCount} findings
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Scanned {data.totalRowsScanned.toLocaleString("en-GB")} imported rows.
          </p>
        </div>
        {!embedded && data.findingCount > 0 && (
          <button
            type="button"
            onClick={() => setShowFindings((open) => !open)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              showFindings
                ? "bg-black text-white"
                : "text-blue-600 hover:bg-slate-100 hover:text-blue-700",
            )}
          >
            {showFindings ? "Hide" : "View"}
            <ChevronRight className={cn("h-3 w-3 transition-transform", showFindings && "rotate-90")} />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {data.disclaimer}
      </div>

      {data.findingCount === 0 ? (
        <p className="mt-4 text-xs text-slate-500">No issues flagged on imported history.</p>
      ) : findingsOpen ? (
        <ul className="mt-4 space-y-2">
          {data.findings.map((finding: TreAuditFinding) => (
            <li
              key={finding.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                finding.severity === "review"
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-slate-200 bg-white",
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    finding.severity === "review" ? "text-amber-600" : "text-slate-400",
                  )}
                />
                <div>
                  <p className="text-xs font-medium text-slate-900">{finding.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{finding.detail}</p>
                  {finding.mrn && (
                    <Link
                      href={`/dashboard/declarations?search=${encodeURIComponent(finding.mrn)}`}
                      className="mt-1 inline-block text-[11px] font-medium text-blue-600 hover:text-blue-700"
                    >
                      Search declarations for {finding.mrn}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
