"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { AlertTriangle, BarChart3, ShieldAlert, ShieldCheck } from "lucide-react";

export default function TelemetryPage() {
  const { user } = useUser();
  const data = useQuery(api.documents.getRequirementTelemetry, user?.id ? {} : "skip");

  const summary = data?.summary;
  const trend = data?.trend || [];
  const alerts = data?.alerts || [];
  const errorPanel = data?.errorPanel;

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Telemetry Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Requirement and submit-gate anomaly indicators for operational monitoring.
        </p>
      </div>

      {!data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading telemetry...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Blocking Missing</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary?.blockingMissingCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Advisory Missing</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary?.advisoryMissingCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Mismatch Signals</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary?.potentialMismatchCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Unmapped Docs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary?.unmappedDocsCount ?? 0}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Active Alerts</h2>
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500">No active anomaly alerts.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert: any) => (
                  <div
                    key={alert.key}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      alert.level === "critical"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="font-medium uppercase">{alert.level}</span>
                    </div>
                    <p className="mt-1">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Doc Action Error Rate (7d)</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Errors</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{errorPanel?.totalErrors7d ?? 0}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Docs Saved</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{errorPanel?.docsSaved7d ?? 0}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Error Rate</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{errorPanel?.errorRatePercent ?? 0}%</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Top Signatures</p>
              {(errorPanel?.topSignatures || []).length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No doc-action/auth error signatures in the last 7 days.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {(errorPanel?.topSignatures || []).map((sig: any) => (
                    <div key={sig.signature} className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5 text-xs">
                      <span className="font-mono text-slate-700">{sig.signature}</span>
                      <span className="text-slate-500">count: {sig.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">7-Day Trend</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Requirement Updates</th>
                    <th className="px-3 py-2 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Docs Saved</th>
                    <th className="px-3 py-2 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">Unresolved Mismatch Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {trend.map((row: any) => (
                    <tr key={row.date}>
                      <td className="px-3 py-2 text-xs text-slate-700">{row.date}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{row.requirementUpdates}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{row.docsSaved}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{row.unresolvedMismatches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Runbook reference: {data.runbook}</span>
          </div>
        </>
      )}
    </div>
  );
}
