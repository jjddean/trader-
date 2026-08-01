"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, FileText } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  DeclarationStatusBadge,
  declarationHumanSubtitle,
  mrnSubtitleClass,
  mrnTitleClass,
  resolveDeclarationRowBadge,
  rowTintClass,
} from "@/lib/declaration-status-display";
import { cn } from "@/lib/utils";

export default function PortalDeclarationsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const declarations = useQuery(api.client_portal.listMyDeclarations, authReady ? {} : "skip");
  const isLoading = declarations === undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Declarations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clearance filings your broker submitted for you.
        </p>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="w-[40%] px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  MRN
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Updated
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
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="h-24" aria-hidden />
                </tr>
              ) : declarations.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <FileText className="h-4 w-4 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">No declarations yet</h4>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        When your broker links filings to your account, they will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                declarations.map((decl) => {
                  const { label: badgeLabel, tone } = resolveDeclarationRowBadge({
                    status: decl.status,
                  });
                  const subtitleLabel = declarationHumanSubtitle(
                    badgeLabel,
                    decl.rawStatus ?? decl.status,
                    tone,
                  );
                  const updated =
                    decl.lastUpdated != null
                      ? new Date(Number(decl.lastUpdated)).toLocaleDateString()
                      : "—";

                  return (
                    <tr
                      key={decl._id}
                      onClick={() => router.push(`/portal/declarations/${decl._id}`)}
                      className={cn("group cursor-pointer transition-colors", rowTintClass(tone))}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={cn("text-xs font-semibold transition-colors", mrnTitleClass(tone))}>
                            {decl.mrn || "Pending CDS"}
                          </span>
                          <span className={cn("mt-0.5 text-[0.625rem] font-medium", mrnSubtitleClass(tone))}>
                            {subtitleLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                        {decl.declarationType || "—"}
                      </td>
                      <td className="px-6 py-4 text-[0.6875rem] text-slate-600">{updated}</td>
                      <td className="px-6 py-4">
                        <DeclarationStatusBadge tone={tone} label={badgeLabel} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
