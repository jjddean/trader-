"use client";

import {
  formatHmrcTokenExpiry,
  resolveHmrcConnectionStatus,
  type HmrcConnectionStatus,
} from "@/lib/hmrc-connection-status";

import React, { useMemo, useState } from "react";
import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import {
  AlertCircle,
  PoundSterling,
  FileText,
  ArrowUpRight,
  TrendingUp,
  Archive,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Plus,
} from "lucide-react";

type DeclarationPreview = {
  declarationId: string;
  lastUpdated?: number;
  mrn?: string;
  status?: string;
  totalValue?: number;
  dutyAmount?: number;
  financialSource?: string;
};

type DashboardKpis = {
  totalDuty: number;
  importValue: number;
  declarationsCount: number;
  avgDuty: number;
};

type DutyChartRow = {
  code: string;
  duty: number;
};

type ReviewOpportunity = {
  title: string;
  subtitle: string;
  amount: number;
  indicative: boolean;
  href: string;
};

type RecentDeclaration = {
  id: string;
  date: string;
  mrn: string;
  status: string;
  value: number;
  duty: number;
};

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const userId = user?.id || "";
  const orgId = organization?.id || "";

  const canQuery =
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const summary = useQuery(
    api.declarations.getDashboardSummary,
    canQuery ? {} : "skip",
  );
  const declarationPreviews = useQuery(
    api.declarations.getDeclarationPreviews,
    canQuery ? {} : "skip",
  );
  const dashboardAnalytics = useQuery(
    api.declarations.getDashboardAnalytics,
    canQuery ? {} : "skip",
  );
  const treOpportunities = useQuery(
    api.tre_analytics.listOpportunities,
    canQuery ? {} : "skip",
  );
  const orgHmrcMode = useQuery(
    api.org_hmrc.getModeForOrg,
    canQuery && orgId ? { orgId } : "skip",
  );
  const hmrcEnvironment =
    orgId && orgHmrcMode?.hmrcMode === "live" ? "production" : "sandbox";
  const hmrcToken = useQuery(
    api.hmrc.getToken,
    canQuery && userId && (!orgId || orgHmrcMode !== undefined)
      ? { userId, environment: hmrcEnvironment }
      : "skip",
  );
  const hmrcStatus = useMemo(
    () => resolveHmrcConnectionStatus(hmrcToken),
    [hmrcToken],
  );
  const stats = useMemo(() => {
    if (
      !summary ||
      declarationPreviews === undefined ||
      dashboardAnalytics === undefined
    )
      return null;

    const recentDeclarations = (declarationPreviews || []).map(
      (preview: DeclarationPreview) => ({
        id: preview.declarationId,
        date: new Date(preview.lastUpdated || 0).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        mrn: preview.mrn || "Draft",
        status: preview.status || "Draft",
        value: Number(preview.totalValue || 0),
        duty: Number(
          preview.financialSource === "hmrc_confirmed"
            ? preview.dutyAmount || 0
            : (dashboardAnalytics?.dutyByDeclarationId?.[
                preview.declarationId
              ] ??
                preview.dutyAmount ??
                0),
        ),
      }),
    );

    const declarationReviews: ReviewOpportunity[] = (
      dashboardAnalytics?.overpayments ?? []
    ).map((item) => ({
      title: item.title,
      subtitle: item.subtitle,
      amount: item.amount,
      indicative: false,
      href: `/dashboard/declarations/${item.declarationId}`,
    }));
    const treReviews: ReviewOpportunity[] = (
      treOpportunities?.opportunities ?? []
    )
      .slice(0, 5)
      .map((item) => ({
        title:
          item.mrn && item.mrn !== "—"
            ? item.mrn
            : `Commodity ${item.commodityCode}`,
        subtitle: `HS ${item.commodityCode} · Possible preference opportunity`,
        amount: item.indicativeDelta,
        indicative: true,
        href: "/dashboard/tre-import",
      }));
    const reviewOpportunities = [...declarationReviews, ...treReviews]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return {
      kpis: {
        totalDuty: Number(dashboardAnalytics?.totalDuty || 0),
        importValue: Number(summary.totalValue || 0),
        declarationsCount: Number(summary.totalDeclarations || 0),
        avgDuty: Number(dashboardAnalytics?.avgDuty || 0),
      },
      chartData: dashboardAnalytics?.chartData ?? [],
      recentDeclarations,
      reviewOpportunities,
    };
  }, [summary, declarationPreviews, dashboardAnalytics, treOpportunities]);

  // Feature toggles: allow hiding specific dashboard cards via public env vars.
  // Set NEXT_PUBLIC_DASH_SHOW_DUTY_BY_HS=false to hide the Duty by HS Code table.
  // Set NEXT_PUBLIC_DASH_SHOW_OVERPAYMENTS=false to hide Review Opportunities.
  const showDutyByHs = process.env.NEXT_PUBLIC_DASH_SHOW_DUTY_BY_HS !== "false";
  const showOverpayments =
    process.env.NEXT_PUBLIC_DASH_SHOW_OVERPAYMENTS !== "false";

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user?.firstName || "Trader"}
          </p>
        </div>

        {hmrcStatus !== "loading" && (
          <HmrcDashboardAction
            status={hmrcStatus}
            expiresAt={hmrcToken?.expiresAt}
          />
        )}
      </div>

      {isLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Clerk is signed in but Convex is not connected yet — dashboard data
          will load after the session syncs.
        </div>
      )}

      {!stats ? (
        <div className="flex h-64 w-full flex-col items-center justify-center gap-4 pt-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="text-sm font-medium text-gray-500">
            Loading live database...
          </p>
        </div>
      ) : (
        <>
          {/* 1. KPI ROW */}
          <KpiRow kpis={stats.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {showDutyByHs && <DutyByHsTable data={stats.chartData} />}

            {showOverpayments && (
              <ReviewOpportunities opportunities={stats.reviewOpportunities} />
            )}
          </div>

          {/* 3. RECENT DECLARATIONS */}
          <RecentDeclarations declarations={stats.recentDeclarations} />
        </>
      )}
    </div>
  );
}

function HmrcStatusDot({ color }: { color: "green" | "amber" }) {
  const solid = color === "green" ? "bg-green-500" : "bg-amber-500";
  const ping = color === "green" ? "bg-green-400" : "bg-amber-400";

  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ping}`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${solid}`} />
    </span>
  );
}

function HmrcDashboardAction({
  status,
  expiresAt,
}: {
  status: Exclude<HmrcConnectionStatus, "loading">;
  expiresAt?: number;
}) {
  const expiryText =
    expiresAt && (status === "connected" || status === "expiring")
      ? formatHmrcTokenExpiry(expiresAt)
      : null;

  if (status === "connected") {
    return (
      <Link
        href="/dashboard/settings"
        className="flex min-h-9 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-1.5 text-green-800 transition-colors hover:bg-green-100"
      >
        <HmrcStatusDot color="green" />
        <span className="flex flex-col text-left">
          <span className="text-xs font-medium">HMRC connected</span>
          {expiryText && (
            <span className="text-[10px] font-normal text-green-700">
              {expiryText}
            </span>
          )}
        </span>
      </Link>
    );
  }

  if (status === "expiring") {
    return (
      <a
        href="/api/hmrc/auth"
        className="flex min-h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-1.5 text-amber-900 transition-colors hover:bg-amber-100"
      >
        <HmrcStatusDot color="amber" />
        <span className="flex flex-col text-left">
          <span className="text-xs font-medium">Refresh HMRC session</span>
          {expiryText && (
            <span className="text-[10px] font-normal text-amber-800">
              {expiryText}
            </span>
          )}
        </span>
      </a>
    );
  }

  return (
    <a
      href="/api/hmrc/auth"
      className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800"
    >
      <Plus className="h-4 w-4" />
      {status === "expired" ? "Reconnect HMRC" : "Connect HMRC"}
    </a>
  );
}

// 1️⃣ KPI ROW
function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        title="Total Duty (30d)"
        value={`£${kpis.totalDuty.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
        subtitle="Duty assigned across active declarations"
        icon={<PoundSterling className="h-4 w-4 text-gray-400" />}
      />
      <KpiCard
        title="Import Value"
        value={`£${kpis.importValue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
        subtitle="Total customs value of goods"
        icon={<TrendingUp className="h-4 w-4 text-gray-400" />}
      />
      <KpiCard
        title="Declarations"
        value={`${kpis.declarationsCount}`}
        subtitle="Total declarations filed"
        icon={<FileText className="h-4 w-4 text-gray-400" />}
      />
      <KpiCard
        title="Avg Duty"
        value={`£${kpis.avgDuty.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
        subtitle="Average duty per declaration"
        icon={<ArrowUpRight className="h-4 w-4 text-gray-400" />}
      />
    </div>
  );
}

// KPI CARD
function KpiCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
          {title}
        </p>
        {icon}
      </div>
      <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
        {value}
      </h2>
      {subtitle && (
        <p className="mt-1 text-[0.625rem] text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}

function DashboardEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-4 w-4 text-slate-300" />
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
    </div>
  );
}
function DutyByHsTable({ data }: { data: DutyChartRow[] }) {
  const totalDuty = data.reduce((sum, row) => sum + row.duty, 0);

  return (
    <section className="flex min-h-72 flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
      <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <Archive className="h-4 w-4 text-gray-400" />
        <div>
          <h3 className="text-sm font-medium text-black">Duty by HS Code</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Highest duty headings in the last 30 days
          </p>
        </div>
      </div>
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e9e9e7] text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">HS heading</th>
                <th className="px-5 py-3">Share of duty</th>
                <th className="px-5 py-3 text-right">Duty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e9e7]">
              {data.map((row) => {
                const share = totalDuty > 0 ? (row.duty / totalDuty) * 100 : 0;
                return (
                  <tr key={row.code} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {row.code}
                      </span>
                    </td>
                    <td className="min-w-40 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gray-900"
                            style={{ width: `${Math.max(2, share)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[11px] tabular-nums text-gray-500">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-semibold tabular-nums text-gray-900">
                      £
                      {row.duty.toLocaleString("en-GB", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <DashboardEmptyState
          icon={Archive}
          title="No duty data yet"
          description="Duty analysis will appear once declaration duty lines are available."
        />
      )}
    </section>
  );
}

// 3️⃣ RECENT DECLARATIONS TABLE
function RecentDeclarations({
  declarations,
}: {
  declarations: RecentDeclaration[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleDeclarations = showAll ? declarations : declarations.slice(0, 7);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
      <div className="flex items-center justify-between border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">
            Recent Declarations
          </h3>
        </div>
        {declarations.length > 7 && (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="text-[0.6875rem] font-semibold tracking-widest text-blue-600 uppercase transition hover:text-blue-700"
          >
            {showAll ? "Show Less" : "View All"}
          </button>
        )}
      </div>

      <div className="flex-1 p-0 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e9e9e7] bg-white">
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                MRN
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right">
                Value
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right">
                Duty
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e9e7]">
            {declarations.length > 0 ? (
              visibleDeclarations.map((decl) => {
                const isAlert =
                  decl.status === "Rejected" ||
                  decl.status === "Action Required" ||
                  decl.status === "Invalid";
                const isWarning = decl.status === "Draft";
                const hasMrn = Boolean(
                  decl.mrn && String(decl.mrn).trim().length > 0,
                );
                const isCleared = hasMrn && decl.status === "Cleared";
                const isAcceptedOrAmended =
                  hasMrn &&
                  (decl.status === "Accepted" || decl.status === "Amended");
                return (
                  <tr
                    key={decl.id}
                    className={`group cursor-pointer transition-colors ${isAlert ? "bg-red-50/50 hover:bg-red-50" : isWarning ? "bg-amber-50/50 hover:bg-amber-50" : isCleared ? "bg-green-50/50 hover:bg-green-50" : isAcceptedOrAmended ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600 whitespace-nowrap">
                      {decl.date}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold transition-colors ${isAlert ? "text-red-900" : isWarning ? "text-amber-900" : isCleared ? "text-green-900" : isAcceptedOrAmended ? "text-blue-900" : "text-black"}`}
                      >
                        {decl.mrn}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isCleared ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                          <ShieldCheck className="h-3 w-3" />
                          {decl.status}
                        </span>
                      ) : isAcceptedOrAmended ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700">
                          <ShieldCheck className="h-3 w-3" />
                          {decl.status}
                        </span>
                      ) : decl.status === "Rejected" ||
                        decl.status === "Action Required" ||
                        decl.status === "Invalid" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                          <ShieldAlert className="h-3 w-3" />
                          {decl.status === "Invalid"
                            ? "Invalid (DMSINV)"
                            : decl.status}
                        </span>
                      ) : decl.status === "Draft" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-700">
                          <FileText className="h-3 w-3" />
                          {decl.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700">
                          <AlertCircle className="h-3 w-3" />
                          {decl.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-600">
                      £
                      {decl.value.toLocaleString("en-GB", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-semibold text-gray-900">
                      £
                      {decl.duty.toLocaleString("en-GB", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <DashboardEmptyState
                    icon={FileText}
                    title="No declarations yet"
                    description="Your recent declarations will appear here once they are created."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewOpportunities({
  opportunities,
}: {
  opportunities: ReviewOpportunity[];
}) {
  const hasIndicative = opportunities.some((item) => item.indicative);

  return (
    <section className="flex min-h-72 flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
      <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <AlertCircle className="h-4 w-4 text-gray-400" />
        <div>
          <h3 className="text-sm font-medium text-black">
            Review Opportunities
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Items worth checking before taking action
          </p>
        </div>
      </div>

      {opportunities.length > 0 ? (
        <>
          <div className="divide-y divide-[#e9e9e7]">
            {opportunities.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-semibold text-gray-900">
                      {item.title}
                    </p>
                    <span
                      className={
                        item.indicative
                          ? "rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800"
                          : "rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-700"
                      }
                    >
                      {item.indicative ? "Indicative" : "Declaration review"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    {item.subtitle}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-xs font-semibold tabular-nums text-gray-900">
                    £
                    {item.amount.toLocaleString("en-GB", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <Link
                    href={item.href}
                    className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-700"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {hasIndicative && (
            <p className="mt-auto border-t border-[#e9e9e7] bg-amber-50 px-5 py-2 text-[10px] leading-relaxed text-amber-900">
              Indicative TRE flags are not reclaim amounts or guarantees of
              eligibility. HMRC determines any repayment.
            </p>
          )}
        </>
      ) : (
        <DashboardEmptyState
          icon={AlertCircle}
          title="No review opportunities"
          description="Items worth checking will appear here when a declaration needs attention."
        />
      )}
    </section>
  );
}
