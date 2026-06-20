"use client";

import { FINANCIAL_LABELS as FL } from "@/lib/financial-labels";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { AlertCircle, PoundSterling, FileText, ArrowUpRight, TrendingUp, Archive, ShieldCheck, ShieldAlert, Plus } from "lucide-react";

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const userId = user?.id || "";

  const canQuery =
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const declarationPreviews = useQuery(api.declarations.getDeclarationPreviews, canQuery ? {} : "skip");
  const dashboardAnalytics = useQuery(api.declarations.getDashboardAnalytics, canQuery ? {} : "skip");
  const hmrcConnection = useQuery(api.hmrc_internal.getTokens, userId ? { userId } : "skip");

  const hmrcStatus = useMemo(() => {
    if (hmrcConnection === undefined) return "loading" as const;
    if (!hmrcConnection) return "disconnected" as const;
    if (hmrcConnection.expiresAt < Date.now()) return "expired" as const;
    if (hmrcConnection.expiresAt - Date.now() < 30 * 60 * 1000) return "expiring" as const;
    return "connected" as const;
  }, [hmrcConnection]);

  const stats = useMemo(() => {
    const previews = declarationPreviews ?? [];
    const importValue = previews.reduce(
      (sum: number, preview: { totalValue?: number }) => sum + Number(preview.totalValue || 0),
      0,
    );

    const dutyByDeclarationId = dashboardAnalytics?.dutyByDeclarationId ?? {};
    const recentDeclarations = previews.slice(0, 7).map((preview: {
      declarationId: string;
      lastUpdated?: number;
      mrn?: string;
      status?: string;
      totalValue?: number;
      dutyAmount?: number;
      financialSource?: string;
    }) => ({
      id: preview.declarationId,
      date: new Date(preview.lastUpdated || 0).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      mrn: preview.mrn || "Draft",
      status: preview.status || "Draft",
      value: Number(preview.totalValue || 0),
      duty: Number(
        preview.financialSource === "hmrc_confirmed"
          ? preview.dutyAmount || 0
          : dutyByDeclarationId[preview.declarationId] ?? preview.dutyAmount ?? 0,
      ),
    }));

    const totalDuty = Number(dashboardAnalytics?.totalDuty || 0);
    const avgDuty = Number(dashboardAnalytics?.avgDuty || 0);

    return {
      kpis: {
        totalDuty,
        importValue,
        declarationsCount: previews.length,
        avgDuty,
      },
      chartData: (dashboardAnalytics?.chartData ?? []) as Array<{ code: string; duty: number }>,
      recentDeclarations,
      overpayments: (dashboardAnalytics?.overpayments ?? []) as Array<{
        title: string;
        subtitle: string;
        amount: number;
      }>,
      recentLoading: canQuery && declarationPreviews === undefined,
      analyticsLoading: canQuery && dashboardAnalytics === undefined,
    };
  }, [canQuery, declarationPreviews, dashboardAnalytics]);

  // Feature toggles: allow hiding specific dashboard cards via public env vars.
  // Set NEXT_PUBLIC_DASH_SHOW_DUTY_BY_HS=false to hide the Duty by HS Code chart.
  // Set NEXT_PUBLIC_DASH_SHOW_OVERPAYMENTS=false to hide the Potential Overpayments card.
  const showDutyByHs = process.env.NEXT_PUBLIC_DASH_SHOW_DUTY_BY_HS !== "false";
  const showOverpayments = process.env.NEXT_PUBLIC_DASH_SHOW_OVERPAYMENTS !== "false";


  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">


      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">Welcome back, {user?.firstName || "Trader"}</p>
        </div>
        
        {hmrcStatus !== "loading" && (
          <HmrcDashboardAction status={hmrcStatus} />
        )}
      </div>

      {isLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Clerk is signed in but Convex is not connected yet — declaration list may be empty until
          the session syncs.
        </div>
      )}

      <p className="text-xs text-gray-400">
        Duty figures are estimates from Trade Tariff measures until HMRC confirms tax on clearance.
      </p>

      <KpiRow kpis={stats.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {showDutyByHs && <DutyByHsChart data={stats.chartData} />}
        {showOverpayments && <ActionableAudits overpayments={stats.overpayments} />}
      </div>

      <RecentDeclarations
        declarations={stats.recentDeclarations}
        isLoading={stats.recentLoading}
      />
    </div>
  );
}

// 1️⃣ KPI ROW
function KpiRow({ kpis }: { kpis: any }) {
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
function KpiCard({ title, value, subtitle, icon }: { title: string; value: string; subtitle?: string; icon: React.ReactNode }) {
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

// HMRC connection — always visible (button hid when connected; that confused users)
function HmrcStatusDot({ color }: { color: "green" | "amber" | "red" }) {
  const solid =
    color === "green" ? "bg-green-500" : color === "amber" ? "bg-amber-500" : "bg-red-500";
  const ping =
    color === "green" ? "bg-green-400" : color === "amber" ? "bg-amber-400" : "bg-red-400";

  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ping}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${solid}`} />
    </span>
  );
}

function HmrcDashboardAction({ status }: { status: "connected" | "expiring" | "expired" | "disconnected" }) {
  if (status === "connected") {
    return (
      <Link
        href="/dashboard/settings"
        className="flex h-9 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 text-xs font-medium text-green-800 transition-colors hover:bg-green-100"
      >
        <HmrcStatusDot color="green" />
        HMRC connected
      </Link>
    );
  }

  if (status === "expiring") {
    return (
      <a
        href="/api/hmrc/auth"
        className="flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
      >
        <Plus className="h-4 w-4" />
        Refresh HMRC session
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

const DUTY_CHART_COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#64748b"];

// 2️⃣ DUTY BY HS CODE CHART
const CustomChartTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { label?: string; duty?: number } }> }) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{row.label}</p>
      <p className="text-sm font-semibold tabular-nums text-gray-900">
        £{Number(row.duty || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

function DutyByHsChart({ data }: { data: Array<{ code: string; duty: number }> }) {
  const chartRows = data.map((row) => ({
    ...row,
    label: `HS ${row.code}`,
  }));
  const hasData = chartRows.length > 0;

  return (
    <div className="flex h-80 flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
      <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <Archive className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-black">Duty by HS heading (4-digit)</h3>
      </div>
      <div className="min-h-0 flex-1 p-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(val) => `£${val}`}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={76}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} content={<CustomChartTooltip />} />
              <Bar dataKey="duty" radius={[0, 6, 6, 0]} barSize={22} maxBarSize={28}>
                {chartRows.map((entry, index) => (
                  <Cell key={entry.code} fill={DUTY_CHART_COLORS[index % DUTY_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-xs text-gray-500">
            Duty breakdown available after declarations with duty in the last 30 days.
          </div>
        )}
      </div>
    </div>
  );
}

// 3️⃣ RECENT DECLARATIONS TABLE
function RecentDeclarations({
  declarations,
  isLoading,
}: {
  declarations: any[];
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
      <div className="flex items-center justify-between border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">Recent Declarations</h3>
        </div>
        <Link
          href="/dashboard/declarations"
          className="text-[0.6875rem] font-semibold tracking-widest text-blue-600 uppercase transition hover:text-blue-700"
        >
          View All
        </Link>
      </div>

      <div className="flex-1 p-0 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-[#e9e9e7]">
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">MRN</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right">Value</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right">Duty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e9e7]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading declarations…
                </td>
              </tr>
            ) : declarations.length > 0 ? (
              declarations.map((decl: any) => {
                const isAlert = decl.status === "Rejected" || decl.status === "Action Required" || decl.status === "Invalid";
                const isWarning = decl.status === "Draft";
                const hasMrn = Boolean(decl.mrn && String(decl.mrn).trim().length > 0);
                const isCleared = hasMrn && decl.status === "Cleared";
                const isAcceptedOrAmended =
                  hasMrn &&
                  (decl.status === "Accepted" || decl.status === "Amended");
                return (
                <tr
                  key={decl.id}
                  className={`group cursor-pointer transition-colors ${isAlert ? "bg-red-50/50 hover:bg-red-50" : isWarning ? "bg-amber-50/50 hover:bg-amber-50" : isCleared ? "bg-green-50/50 hover:bg-green-50" : isAcceptedOrAmended ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="px-6 py-4 text-[0.6875rem] text-gray-600 whitespace-nowrap">{decl.date}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold transition-colors ${isAlert ? "text-red-900" : isWarning ? "text-amber-900" : isCleared ? "text-green-900" : isAcceptedOrAmended ? "text-blue-900" : "text-black"}`}>{decl.mrn}</span>
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
                    ) : decl.status === "Rejected" || decl.status === "Action Required" || decl.status === "Invalid" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                        <ShieldAlert className="h-3 w-3" />
                        {decl.status === "Invalid" ? "Invalid (DMSINV)" : decl.status}
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
                    £{decl.value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-semibold text-gray-900">
                    £{decl.duty.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No declarations found in your live data stream.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 4️⃣ ACTIONABLE AUDITS (SIMPLIFIED)
function ActionableAudits({ overpayments }: { overpayments: Array<{ title: string; subtitle: string; amount: number }> }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none h-80">
      <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <AlertCircle className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-black">Potential Overpayments</h3>
      </div>
      
      <div className="flex-1 p-5 overflow-y-auto space-y-3">
        {overpayments.length > 0 ? (
          overpayments.map((item, idx) => (
            <div key={`${item.title}-${idx}`} className="border border-[#e9e9e7] rounded-lg p-4 flex justify-between items-center transition-all hover:bg-gray-50 cursor-pointer">
              <div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
              </div>
              <p className="text-red-600 font-semibold text-sm">+£{item.amount.toFixed(2)}</p>
            </div>
          ))
        ) : (
          <div className="border border-[#e9e9e7] rounded-lg p-4 text-xs text-gray-500">
            {FL.overpaymentAfterAssessment}
          </div>
        )}
      </div>
    </div>
  );
}
