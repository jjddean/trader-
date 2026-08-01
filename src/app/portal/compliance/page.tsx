"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { cn } from "@/lib/utils";

export default function PortalCompliancePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const rows = useQuery(api.client_portal.listMyComplianceAssessments, authReady ? {} : "skip");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Export controls</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your compliance assessments. Licence applications are submitted on GOV.UK, not here.
        </p>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Reference
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Destination
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Detail
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Status
                </th>
                <th className="w-[80px] px-6 py-3 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows === undefined ? (
                <tr>
                  <td colSpan={5} className="h-24" aria-hidden />
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center py-10 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <ShieldCheck className="h-4 w-4 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">No cases yet</h4>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        When your broker links an export assessment to your account, it will appear
                        here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => router.push(`/portal/compliance/${row._id}`)}
                    className="group cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                      {row.reference}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {row.destinationCountry || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{row.detail}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[0.625rem] font-medium capitalize",
                          row.status === "clear"
                            ? "bg-green-100 text-green-700"
                            : row.status === "flagged"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {row.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ArrowRight className="ml-auto h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
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
