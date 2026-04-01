"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AlertCircle, PoundSterling, FileText, ArrowUpRight, TrendingUp, Archive, RefreshCw, ShieldCheck, ShieldAlert, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useUser();
  const userId = user?.id || "";

  const stats = useQuery(api.declarations.getDashboardStats, userId ? { userId } : "skip");
  const hmrcToken = useQuery(api.hmrc.getToken, userId ? { userId } : "skip");

  // Keep a live clock to trigger banner changes even if the user is idle
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);



  const hmrcEnvironment = (process.env.NEXT_PUBLIC_HMRC_ENV || "sandbox").toLowerCase() === "live" ? "Live" : "Sandbox";
  const tokenRemainingMs = hmrcToken?.expiresAt ? hmrcToken.expiresAt - now : null;
  const tokenExpiryText = tokenRemainingMs === null
    ? "—"
    : tokenRemainingMs <= 0
      ? "Expired"
      : `Expires in ${Math.floor(tokenRemainingMs / 3600000)}h ${Math.floor((tokenRemainingMs % 3600000) / 60000)}m`;


  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">


      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">Welcome back, {user?.firstName || "Trader"}</p>
        </div>
        
        {hmrcToken !== undefined && (
          hmrcToken ? (
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-medium", tokenRemainingMs !== null && tokenRemainingMs <= 0 ? "text-red-600" : "text-gray-500")}>
                {tokenExpiryText}
              </span>
              <a
                href="/api/hmrc/auth"
                className={cn("flex h-9 items-center gap-2 rounded-md px-4 text-xs font-medium transition-opacity hover:opacity-90", tokenRemainingMs !== null && tokenRemainingMs <= 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}
              >
                <ShieldCheck className="h-4 w-4" />
                {tokenRemainingMs !== null && tokenRemainingMs <= 0 ? "HMRC Expired - Reconnect" : `HMRC Connected (${hmrcEnvironment})`}
              </a>
            </div>
          ) : (
            <a
              href="/api/hmrc/auth"
              className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              Connect HMRC
            </a>
          )
        )}
      </div>

      {!stats ? (
        <div className="flex h-64 w-full flex-col items-center justify-center gap-4 pt-12">
           <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
           <p className="text-sm font-medium text-gray-500">Loading live database...</p>
        </div>
      ) : (
        <>
          {/* 1. KPI ROW */}
          <KpiRow kpis={stats.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* 2. CHART */}
            <DutyByHsChart data={stats.chartData} />

            {/* 4. AUDITS (STATIC UNTIL WIRING) */}
            <ActionableAudits overpayments={stats.overpayments || []} />
          </div>

          {/* 3. RECENT DECLARATIONS */}
          <RecentDeclarations declarations={stats.recentDeclarations} />
        </>
      )}
    </div>
  );
}

// 1️⃣ KPI ROW
function KpiRow({ kpis }: { kpis: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

// 2️⃣ DUTY BY HS CODE CHART
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#e9e9e7] bg-white px-4 py-3 shadow-sm min-w-[120px]">
        <p className="text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase mb-1">
          HS Code {label}
        </p>
        <p className="text-base font-semibold tracking-tight text-gray-900 tabular-nums">
          £{payload[0].value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

function DutyByHsChart({ data }: { data: any[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none h-80">
      <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <Archive className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-black">Duty by HS Code</h3>
      </div>
      <div className="flex-1 min-h-0 p-5 pt-8 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="code" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }} 
              dy={10} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }} 
              tickFormatter={(val) => `£${val}`} 
            />
            <Tooltip 
              cursor={{ fill: '#f9fafb' }}
              content={<CustomChartTooltip />}
            />
            <Bar 
              dataKey="duty" 
              fill="#000000" 
              radius={[4, 4, 0, 0]} 
              maxBarSize={48} 
              animationDuration={1000}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 3️⃣ RECENT DECLARATIONS TABLE
function RecentDeclarations({ declarations }: { declarations: any[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
      <div className="flex items-center justify-between border-b border-[#e9e9e7] bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">Recent Declarations</h3>
        </div>
        <button className="text-[0.6875rem] font-semibold tracking-widest text-blue-600 uppercase transition hover:text-blue-700">View All</button>
      </div>

      <div className="flex-1 p-0 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-white border-b border-[#e9e9e7]">
              <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">MRN</th>
              <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right">Value</th>
              <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right">Duty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e9e7]">
            {declarations.length > 0 ? (
              declarations.map((decl: any) => (
                <tr key={decl.id} className="group transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{decl.date}</td>
                  <td className="px-6 py-4 font-mono text-[0.6875rem] text-gray-900 font-semibold">{decl.mrn}</td>
                  <td className="px-6 py-4">
                    {Boolean(decl.mrn && String(decl.mrn).trim().length > 0) && (decl.status === "Cleared" || decl.status === "Accepted") ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
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
              ))
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
            No potential overpayments identified from current declarations.
          </div>
        )}
      </div>
    </div>
  );
}
