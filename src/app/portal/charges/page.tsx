"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { PoundSterling } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { cn } from "@/lib/utils";

function formatMoney(amount: number) {
  return `£${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortalChargesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const rows = useQuery(api.client_portal.listMyCharges, authReady ? {} : "skip");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Charges</h1>
        <p className="mt-1 text-sm text-slate-500">
          Duty and VAT for your filings — Estimate or HMRC confirmed.
        </p>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Declaration
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Duty
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  VAT
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows === undefined ? (
                <tr>
                  <td colSpan={4} className="h-24" aria-hidden />
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="flex flex-col items-center py-10 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <PoundSterling className="h-4 w-4 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">No charges yet</h4>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        Amounts appear when filings have duty/VAT estimates or HMRC figures.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.declarationId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                      {row.mrn || "Pending CDS"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      {row.dutyAmount != null ? formatMoney(row.dutyAmount) : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      {row.vatAmount != null ? formatMoney(row.vatAmount) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[0.625rem] font-medium",
                          row.source === "hmrc_confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {row.source === "hmrc_confirmed" ? "HMRC confirmed" : "Estimate"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
