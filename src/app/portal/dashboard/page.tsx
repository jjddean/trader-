"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { AlertTriangle, ChevronRight, FileText, MessageSquare, Upload } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  DeclarationStatusBadge,
  resolveDeclarationRowBadge,
} from "@/lib/declaration-status-display";
import { portalDayGreeting } from "@/components/portal/portal-status";

function attentionIcon(kind: string) {
  if (kind === "unread_message") return MessageSquare;
  if (kind === "missing_document") return Upload;
  return AlertTriangle;
}

export default function PortalDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const dashboard = useQuery(api.client_portal.getMyDashboard, authReady ? {} : "skip");
  const profile = useQuery(api.client_portal.getMyClientProfile, authReady ? {} : "skip");
  const isLoading = dashboard === undefined;
  const greeting = portalDayGreeting();
  const companyName = profile?.name?.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {greeting}
          {companyName ? `, ${companyName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Here’s what needs you today.</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-medium text-slate-900">Needs your attention</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="h-[72px]" aria-hidden />
          ) : dashboard === null || dashboard.attention.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Nothing needs your attention right now.</p>
          ) : (
            dashboard.attention.map((item, i) => {
              const Icon = attentionIcon(item.kind);
              return (
                <Link
                  key={`${item.kind}-${item.href}-${i}`}
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-amber-700" strokeWidth={2.25} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{item.title}</div>
                    <div className="truncate text-xs text-slate-500">{item.subtitle}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-medium text-slate-900">Recent declarations</h2>
          <Link
            href="/portal/declarations"
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="h-[72px]" aria-hidden />
          ) : !dashboard?.recent.length ? (
            <div className="flex flex-col items-center px-5 py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-4 w-4 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-900">No declarations yet</p>
              <p className="mt-1 text-xs text-slate-500">
                When your broker links filings to your account, they will appear here.
              </p>
            </div>
          ) : (
            dashboard.recent.map((decl) => {
              const { label, tone } = resolveDeclarationRowBadge({ status: decl.status });
              const updated =
                decl.lastUpdated != null
                  ? new Date(Number(decl.lastUpdated)).toLocaleDateString()
                  : "—";
              return (
                <Link
                  key={decl._id}
                  href={`/portal/declarations/${decl._id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {decl.mrn || "Pending CDS"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {decl.declarationType || "—"} · {updated}
                    </div>
                  </div>
                  <DeclarationStatusBadge tone={tone} label={label} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
