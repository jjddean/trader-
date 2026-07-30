"use client";

import { FINANCIAL_LABELS as FL } from "@/lib/financial-labels";
import { useEffect, useState } from "react";
import { Search, Filter, ShieldAlert, ShieldCheck, Download, Copy, FileText, CheckCircle2, Printer } from "lucide-react";
import { useDirectPrint } from "@/components/print/direct-print";
import { CustomsReportPrintContent } from "@/components/print/customs-report-document";
import type { CustomsReportPrintData } from "@/lib/print-sheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth, useUser } from "@clerk/nextjs";
import type { FunctionReturnType } from "convex/server";
import {
  getRememberedReportsSnapshot,
  rememberReportsSnapshot,
} from "@/lib/dashboard-compliance-cache";

type CustomsReport = FunctionReturnType<typeof api.declarations.getReports>[number];
type CustomsReportItem = CustomsReport["items"][number];

function ReportStatusBadge({ status }: { status: string }) {
  if (status === "Clean") {
    return (
      <Badge className="rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700 hover:bg-green-100">
        <ShieldCheck className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  if (status === "Accepted") {
    return (
      <Badge className="rounded-md bg-blue-100 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700 hover:bg-blue-100">
        <CheckCircle2 className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  if (status === "Submitted") {
    return (
      <Badge className="rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700 hover:bg-amber-100">
        <ShieldAlert className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  if (status === "Draft") {
    return (
      <Badge className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-700 hover:bg-slate-100">
        <FileText className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  return (
    <Badge className="rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700 hover:bg-red-100">
      <ShieldAlert className="h-3 w-3" />
      {status}
    </Badge>
  );
}

export default function ReportsPage() {
  const { print, portal } = useDirectPrint();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerkUserId = user?.id ?? "";
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQueryReports = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;
  const reports = useQuery(api.declarations.getReports, canQueryReports ? {} : "skip");
  const treImports = useQuery(api.tre_imports.listImports, canQueryReports ? {} : "skip");

  const remembered = clerkUserId ? getRememberedReportsSnapshot(clerkUserId) : null;
  const resolvedReports = (reports ?? remembered?.reports) as typeof reports;
  const resolvedTreImports = (treImports ?? remembered?.treImports) as typeof treImports;

  useEffect(() => {
    if (!clerkUserId || reports === undefined || treImports === undefined) return;
    rememberReportsSnapshot(
      clerkUserId,
      reports as Record<string, unknown>[],
      treImports as Record<string, unknown>[],
    );
  }, [clerkUserId, reports, treImports]);

  const isReportsLoading = canQueryReports && resolvedReports === undefined;
  const includesTreHistory = (resolvedTreImports ?? []).some(
    (row: { lineItemsStored: number }) => row.lineItemsStored > 0,
  );
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<CustomsReport | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredReports = (resolvedReports || []).filter((report) => {
    const matchesSearch =
      !searchQuery ||
      report.mrn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.broker?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopy = async () => {
    if (!selectedReport) return;
    const payload = [
      `MRN: ${selectedReport.mrn || "N/A"}`,
      `Date: ${selectedReport.date || "N/A"}`,
      `Status: ${selectedReport.status || "N/A"}`,
      `Broker: ${selectedReport.broker || "N/A"}`,
      `Score: ${selectedReport.score || 0}%`,
      `Invoice Value: ${selectedReport.totalInvoiceValue || "N/A"}`,
      `Duty & VAT: ${selectedReport.totalDutyAndVat || "N/A"}`,
      `Provenance: ${selectedReport.provenanceLabel || "N/A"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable in some browsers; fail silently.
    }
  };

  const handleDownloadReport = () => {
    if (!selectedReport) return;
    const data = {
      mrn: selectedReport.mrn,
      date: selectedReport.date,
      broker: selectedReport.broker,
      status: selectedReport.status,
      score: selectedReport.score,
      ducr: selectedReport.ducr,
      lrn: selectedReport.lrn,
      importer: selectedReport.importer,
      declarant: selectedReport.declarant,
      consignor: selectedReport.consignor,
      dispatchCountry: selectedReport.dispatchCountry,
      originCountry: selectedReport.originCountry,
      portCode: selectedReport.portCode,
      acceptanceDate: selectedReport.acceptanceDate,
      clearanceDate: selectedReport.clearanceDate,
      totalInvoiceValue: selectedReport.totalInvoiceValue,
      totalCustomsValue: selectedReport.totalCustomsValue,
      totalDutyAndVat: selectedReport.totalDutyAndVat,
      items: selectedReport.items || [],
      provenance: selectedReport.provenance || "derived",
      provenanceLabel: selectedReport.provenanceLabel || FL.reportEstimated,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customs-report-${String(selectedReport.mrn || "draft").replace(/\s+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    if (!selectedReport) return;
    const data: CustomsReportPrintData = {
      mrn: selectedReport.mrn,
      date: selectedReport.date,
      broker: selectedReport.broker,
      ducr: selectedReport.ducr,
      lrn: selectedReport.lrn,
      importer: selectedReport.importer,
      declarant: selectedReport.declarant,
      acceptanceDate: selectedReport.acceptanceDate,
      clearanceDate: selectedReport.clearanceDate,
      originCountry: selectedReport.originCountry,
      dispatchCountry: selectedReport.dispatchCountry,
      portCode: selectedReport.portCode,
      totalInvoiceValue: selectedReport.totalInvoiceValue,
      totalDutyAndVat: selectedReport.totalDutyAndVat,
      status: selectedReport.status,
      score: selectedReport.score,
      items: selectedReport.items || [],
    };
    print(<CustomsReportPrintContent report={data} />);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      {portal}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex min-h-7 flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Customs Reports
            </h1>
            {includesTreHistory && (
              <Badge className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700 hover:bg-blue-50">
                <FileText className="h-3 w-3" />
                Includes TRE history
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Historical declaration batches and compliance scoring.
          </p>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by MRN or Broker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 z-10 w-44 rounded-md border border-slate-200 bg-white p-2 shadow-md">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  >
                    All statuses
                  </button>
                  <button
                    onClick={() => setStatusFilter("Clean")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  >
                    Clean
                  </button>
                  <button
                    onClick={() => setStatusFilter("Accepted")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  >
                    Accepted
                  </button>
                  <button
                    onClick={() => setStatusFilter("Submitted")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  >
                    Submitted
                  </button>
                  <button
                    onClick={() => setStatusFilter("Action Required")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  >
                    Action Required
                  </button>
                  <button
                    onClick={() => setStatusFilter("Draft")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  >
                    Draft
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

          {isReportsLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Entry No (MRN)</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Date of Entry</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Clearing Broker</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Compliance Score</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                      Loading reports…
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-4 w-4 text-slate-300" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">
                {searchQuery || statusFilter !== "all" ? "No matching reports" : "No customs reports yet"}
              </h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                {searchQuery || statusFilter !== "all"
                  ? "No reports match your search or selected filters."
                  : "Customs reports will appear here once declaration history is available."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Entry No (MRN)</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Date of Entry</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Clearing Broker</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase">Compliance Score</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-slate-500 uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="group cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-black group-hover:text-black transition-colors">
                        {report.mrn}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {report.date}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {report.broker}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              report.score === 100
                                ? "bg-green-500"
                                : report.score > 70
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${report.score}%` }}
                          />
                        </div>
                        <span className="text-[0.6875rem] font-medium text-slate-600">{report.score}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex flex-col items-end gap-1">
                        <ReportStatusBadge status={report.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
      </div>

      {/* Side Sheet for Report Details */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
          {selectedReport && (
            <div className="flex flex-col min-h-full">
              <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-6 sm:px-8">
                <div className="relative rounded-xl border border-slate-100/80 bg-slate-50/80 px-4 py-3 shadow-sm">
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={isCopied ? "Copied" : "Copy report"}
                      onClick={handleCopy}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    >
                      {isCopied ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="Print report"
                      onClick={handlePrintReport}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    >
                      <Printer className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Download report"
                      onClick={handleDownloadReport}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex gap-2 pr-20">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <SheetTitle className="text-sm font-semibold text-slate-900">
                        {selectedReport.mrn}
                      </SheetTitle>
                      <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>{selectedReport.date}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{selectedReport.broker}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Populated Body Rendering Header Info and Line Items */}
              <div className="pt-6 px-6 sm:px-8 pb-12 space-y-8">
                {/* Header Summary Section */}
                <section className="bg-slate-50/80 rounded-xl p-6 border border-slate-100/80 shadow-sm">
                  <h3 className="mb-6 text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3">Declaration Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">DUCR</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.ducr || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">LRN</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.lrn || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Importer</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.importer || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Declarant</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.declarant || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Acceptance Date</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.acceptanceDate || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Clearance Date</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.clearanceDate || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Routing</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">
                        {selectedReport.originCountry} → {selectedReport.dispatchCountry} → {selectedReport.portCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Total Invoice Value</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.totalInvoiceValue || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Total Duty & VAT</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedReport.totalDutyAndVat || "N/A"}</p>
                    </div>
                  </div>
                </section>

                {/* Line Items Section */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">Line Items</h3>
                  {selectedReport.items && selectedReport.items.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-xs">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-white">
                          <tr>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">#</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Classification</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Values</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500 text-right">Taxes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {selectedReport.items.map((item: CustomsReportItem) => (
                            <tr key={item.sequence} className="align-top hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-4 text-xs font-medium text-slate-400">
                                {item.sequence}
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <p className="text-xs font-mono font-medium text-slate-900">{item.commodityCode}</p>
                                  <p className="text-[0.6875rem] text-slate-600 max-w-[200px] leading-tight flex-wrap">{item.description}</p>
                                  <p className="text-[0.625rem] text-slate-400 mt-2">Net: {item.netMass}</p>
                                  <p className="text-[0.625rem] text-slate-400">CPC: {item.cpc}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <p className="text-[0.6875rem] text-slate-600"><span className="text-slate-400 text-[0.625rem]">Inv:</span> {item.itemPrice}</p>
                                  <p className="text-[0.6875rem] font-medium text-slate-900"><span className="text-slate-400 text-[0.625rem] font-normal">Customs:</span> {item.customsValue}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="space-y-1">
                                  <p className="text-[0.6875rem] text-red-600"><span className="text-slate-400 text-[0.625rem]">Duty:</span> {item.dutyPaid}</p>
                                  <p className="text-[0.6875rem] text-red-600"><span className="text-slate-400 text-[0.625rem]">VAT:</span> {item.vatAmount}</p>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-lg">
                      <p className="text-xs text-slate-500">No goods items available.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
