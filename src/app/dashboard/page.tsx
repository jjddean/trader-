"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { AlertCircle, TrendingDown, CheckCircle2, Factory, FileSpreadsheet, Scale, RefreshCw, UploadCloud, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useUser();
  const userId = user?.id || "";

  // The backend function is fully intact
  const analyticsData = useQuery(api.analytics.getDashboardAnalytics, userId ? { userId } : "skip");
  const loadMockData = useMutation(api.analytics.loadMockData);
  const [loadingDemodata, setLoadingDemoData] = useState(false);

  const handleLoadDemoData = async () => {
    if (!userId) return;
    setLoadingDemoData(true);
    try {
      await loadMockData({ userId });
    } finally {
      setLoadingDemoData(false);
    }
  };

  if (!analyticsData) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/60" />
           <p className="text-sm font-medium text-muted-foreground">Loading HMRC Analytics...</p>
        </div>
      </div>
    );
  }

  const { kpis, alerts, brokerAccuracy } = analyticsData;

  // Render Empty State if no records
  if (kpis.totalRecords === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted shadow-inner">
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mb-4 text-2xl font-medium tracking-tight text-foreground">
          No Historical Declarations Found
        </h2>
        <p className="mx-auto mb-8 max-w-lg text-muted-foreground leading-relaxed">
          Connect your HMRC Government Gateway account or upload a historic CSV export to begin uncovering missed duty savings and running compliance audits.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="h-11 px-8">Connect HMRC Account</Button>
          <Button 
            variant="outline" 
            className="h-11 px-8"
            onClick={handleLoadDemoData}
            disabled={loadingDemodata}
          >
            {loadingDemodata ? "Loading..." : "Inject Demo Data"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customs Analytics & Audit</h1>
        <p className="text-sm text-gray-500">Historical HMRC data analysis and compliance scoring.</p>
      </div>

      {/* Top Main KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Compliance Score */}
        <div className="flex flex-col justify-between rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">
              Compliance Health
            </h3>
            <CheckCircle2 className={cn("h-4 w-4", Number(kpis.complianceScore) > 90 ? "text-green-500" : "text-amber-500")} />
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-medium tracking-tight text-gray-900">
              {kpis.complianceScore}%
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {kpis.anomaliesCount} anomalies detected across {kpis.totalRecords} records
            </p>
          </div>
        </div>

        {/* Missed Duty Savings */}
        <div className="flex flex-col justify-between rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">
              Identified Missed Savings
            </h3>
            <TrendingDown className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-medium tracking-tight text-gray-900">
              £{kpis.totalMissedSavings.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Capital tied up in unclaimed trade preferences
            </p>
          </div>
        </div>

        {/* Total Duty Paid */}
        <div className="flex flex-col justify-between rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">
              Total Duty Paid (Historical)
            </h3>
            <Scale className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-medium tracking-tight text-gray-900">
              £{(kpis.totalDutyPaid / 1000).toFixed(1)}k
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Across {kpis.totalRecords} imported records
            </p>
          </div>
        </div>
      </div>

      {/* Alert Cards Row */}
      <h3 className="text-base font-semibold text-foreground">Actionable Audits</h3>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Preference Alert */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
          <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-[#fbfbfa] px-5 py-3">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-normal text-gray-500">Missed DCTS/EU Preference</h3>
            <span className="ml-auto rounded-[4px] bg-[#f7f7f5] px-2 py-0.5 text-[0.625rem] font-semibold text-muted-foreground border border-[#e9e9e7]">
              {alerts.missedPreferences.length} FLAGS
            </span>
          </div>
          <div className="flex-1 p-5">
            {alerts.missedPreferences.length > 0 ? (
              <div className="space-y-4">
                {alerts.missedPreferences.slice(0, 3).map((alert: any) => (
                  <div key={alert.entryIdentifierMrn} className="flex justify-between items-center text-sm">
                     <div>
                       <p className="font-semibold text-foreground">{alert.entryIdentifierMrn}</p>
                       <p className="text-xs text-muted-foreground">Origin: {alert.countryOfOriginCode} · Pref Code: {alert.preferenceCode || 'None'}</p>
                     </div>
                     <span className="text-sm font-semibold text-red-600">
                      +£{(alert.taxLineTotalAmount || 0).toFixed(2)}
                     </span>
                  </div>
                ))}
              </div>
            ) : (
               <p className="text-sm text-muted-foreground">No missed preference opportunities detected.</p>
            )}
          </div>
        </div>

        {/* Anti-Dumping Alert */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
          <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-[#fbfbfa] px-5 py-3">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-normal text-gray-500">Anti-Dumping & High Tax Types</h3>
            <span className="ml-auto rounded-[4px] bg-[#f7f7f5] px-2 py-0.5 text-[0.625rem] font-semibold text-muted-foreground border border-[#e9e9e7]">
              {alerts.antiDumpingPenalties.length} FLAGS
            </span>
          </div>
          <div className="flex-1 p-5">
            {alerts.antiDumpingPenalties.length > 0 ? (
              <div className="space-y-4">
                {alerts.antiDumpingPenalties.map((alert: any, idx: number) => (
                  <div key={idx} className="flex flex-col border-b border-[#e9e9e7] pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">
                        {alert.entryIdentifierMrn || alert.mrn}
                      </span>
                      <span className="text-sm font-semibold text-red-600">
                        +£{(alert.taxLineTotalAmount || alert.value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                       <p className="text-xs text-muted-foreground">Type: {alert.taxType} · Broker: {alert.declarantEori}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
               <p className="text-sm text-muted-foreground">No penalty tax types detected.</p>
            )}
          </div>
        </div>

        {/* PVA Alert */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
          <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-[#fbfbfa] px-5 py-3">
            <FileSpreadsheet className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-normal text-gray-500">Postponed VAT Accounting (PVA)</h3>
            <span className="ml-auto rounded-[4px] bg-[#f7f7f5] px-2 py-0.5 text-[0.625rem] font-semibold text-muted-foreground border border-[#e9e9e7]">
              {alerts.pvaChecks.length} FLAGS
            </span>
          </div>
          <div className="flex-1 p-5">
             <p className="text-sm text-muted-foreground mb-4">
               {alerts.pvaChecks.length} imports flagged with Method of Payment &quot;G&quot;. Ensure these figures are accurately logged on your next VAT return to prevent HMRC audits.
             </p>
             <Button variant="outline" size="sm" className="w-full text-xs h-8">Download PVA Reconciliation Report</Button>
          </div>
        </div>

        {/* Broker Accuracy Table */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
          <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-[#fbfbfa] px-5 py-3">
            <Users className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-normal text-gray-500">Broker Accuracy Benchmarks</h3>
          </div>
          <div className="flex-1 p-0">
            {brokerAccuracy.length > 0 ? (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#fbfbfa] border-b border-[#e9e9e7]">
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Declarant EORI</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right">Accuracy Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9e9e7]">
                   {brokerAccuracy.map((b: any) => (
                     <tr key={b.eori} className="group transition-colors hover:bg-[#f7f7f5]">
                       <td className="px-6 py-4 font-mono text-[0.6875rem] text-gray-600">{b.eori}</td>
                       <td className="px-6 py-4 text-right">
                         <span className={cn(
                           "font-medium text-xs rounded-md px-2 py-0.5",
                           b.accuracy > 95 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                         )}>
                           {b.accuracy.toFixed(1)}%
                         </span>
                         <span className="block text-[0.625rem] text-gray-400 mt-1">{b.totalDeclarations} records</span>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            ) : (
               <div className="p-5">
                 <p className="text-sm text-muted-foreground">Not enough data to benchmark brokers.</p>
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
