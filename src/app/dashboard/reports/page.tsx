"use client";

import { useState } from "react";
import { Search, Filter, ShieldAlert, ShieldCheck, Download, Copy, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth, useUser } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";

export default function ReportsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const userId = user?.id || "";
  const canQueryReports = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;
  const declarationPreviews = useQuery(api.declarations.getDeclarationPreviews, canQueryReports ? {} : "skip");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const reportsData = (declarationPreviews || []).map((preview: any) => {
    const date = new Date(preview.lastUpdated || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const status = preview.status || "Draft";
    const score = status === "Cleared" || status === "Accepted" ? 100 : status === "Draft" ? 50 : 25;
    return {
      id: preview.declarationId,
      mrn: preview.mrn || "Draft",
      date,
      broker: preview.eori || "Unknown Broker",
      score,
      status: status === "Cleared" || status === "Accepted" ? "Clean" : status === "Draft" ? "Draft" : "Action Required",
      ducr: `1GB${preview.eori || "000000000000"}-${String(preview.declarationId).substring(0, 4)}`,
      lrn: `LRN${preview.lastUpdated || Date.now()}`,
      importer: preview.eori || "Unknown",
      declarant: `${preview.eori || "Unknown"} (Self-filed)`,
      consignor: "N/A",
      dispatchCountry: "GB",
      originCountry: "GB",
      portCode: "GBSOU",
      acceptanceDate: new Date(preview.lastUpdated || Date.now()).toLocaleString("en-GB"),
      clearanceDate: status === "Cleared" || status === "Accepted" ? new Date(preview.lastUpdated || Date.now()).toLocaleString("en-GB") : "Pending",
      totalInvoiceValue: `GBP ${Number(preview.totalValue || 0).toFixed(2)}`,
      totalCustomsValue: `GBP ${Number(preview.totalValue || 0).toFixed(2)}`,
      totalDutyAndVat: "GBP 0.00",
      items: [],
    };
  });
  const filteredReports = reportsData.filter((report: any) => {
    const matchesSearch =
      !searchQuery ||
      report.mrn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.broker?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Customs Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Historical declaration batches and compliance scoring.
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between border-b border-[#e9e9e7] pb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by MRN or Broker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-gray-400 md:max-w-md"
          />
        </div>
        <div className="relative">
        <Button variant="ghost" className="h-9 px-3 text-foreground" onClick={() => setShowFilters((prev) => !prev)}>
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
          {showFilters && (
            <div className="absolute right-0 top-10 z-10 w-44 rounded-md border border-gray-200 bg-white p-2 shadow-md">
              <button
                onClick={() => setStatusFilter("all")}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100"
              >
                All statuses
              </button>
              <button
                onClick={() => setStatusFilter("Clean")}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100"
              >
                Clean
              </button>
              <button
                onClick={() => setStatusFilter("Warning")}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100"
              >
                Warning
              </button>
              <button
                onClick={() => setStatusFilter("Action Required")}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100"
              >
                Action Required
              </button>
              <button
                onClick={() => setStatusFilter("Draft")}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100"
              >
                Draft
              </button>
            </div>
          )}
        </div>
      </div>

      <Card className="bg-white shadow-none border-[#e9e9e7]">
        <CardContent className="p-0">
          {!isLoaded || isConvexAuthLoading || (canQueryReports && declarationPreviews === undefined) ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
              <p className="text-xs text-gray-400">Loading Historical Reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-4 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No historical reports generated yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-[#e9e9e7]">
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Entry No (MRN)</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Date of Entry</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Clearing Broker</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Compliance Score</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9e9e7]">
                {filteredReports.map((report: any) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="group cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-black group-hover:text-black transition-colors">
                        {report.mrn}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600">
                      {report.date}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600">
                      {report.broker}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
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
                        <span className="text-[0.6875rem] font-medium text-gray-600">{report.score}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {report.status === "Clean" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                          <ShieldCheck className="h-3 w-3" />
                          {report.status}
                        </span>
                      ) : report.status === "Warning" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700">
                          <ShieldAlert className="h-3 w-3" />
                          {report.status}
                        </span>
                      ) : report.status === "Draft" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-700">
                          <FileText className="h-3 w-3" />
                          {report.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                          <ShieldAlert className="h-3 w-3" />
                          {report.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Side Sheet for Report Details */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
          {selectedReport && (
            <div className="flex flex-col min-h-full">
              <SheetHeader className="px-6 sm:px-8 pt-6 pb-6 border-b border-gray-100 flex flex-row items-center justify-between shrink-0 sticky top-0 bg-white z-10">
                <div>
                  <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <FileText className="h-4 w-4 text-gray-400" />
                    {selectedReport.mrn}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2 text-xs">
                    <span>{selectedReport.date}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>{selectedReport.broker}</span>
                  </SheetDescription>
                </div>
                
                {/* Minimal Action Buttons Matching Documents Page Style */}
                <div className="flex items-center gap-2 mr-8">
                  <button onClick={handleCopy} className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 transition-colors hover:bg-gray-100 cursor-pointer">
                    <span className="text-[0.6875rem] text-gray-700 font-medium tracking-wide">
                        {isCopied ? "COPIED" : "COPY"}
                    </span>
                    {isCopied ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                        <Copy className="h-3 w-3 text-gray-300 transition-colors group-hover:text-gray-500" />
                    )}
                  </button>
                  <button className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 transition-colors hover:bg-gray-100 cursor-pointer">
                    <span className="text-[0.6875rem] text-gray-700 font-medium tracking-wide">DOWNLOAD</span>
                    <Download className="h-3 w-3 text-gray-300 transition-colors group-hover:text-gray-500" />
                  </button>
                </div>
              </SheetHeader>

              {/* Populated Body Rendering Header Info and Line Items */}
              <div className="pt-6 px-6 sm:px-8 pb-12 space-y-8">
                {/* Header Summary Section */}
                <section className="bg-gray-50/80 rounded-xl p-6 border border-gray-100/80 shadow-sm">
                  <h3 className="mb-6 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3">Declaration Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">DUCR</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.ducr || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">LRN</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.lrn || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Importer</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.importer || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Declarant</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.declarant || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Acceptance Date</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.acceptanceDate || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Clearance Date</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.clearanceDate || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Routing</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">
                        {selectedReport.originCountry} → {selectedReport.dispatchCountry} → {selectedReport.portCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Total Invoice Value</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.totalInvoiceValue || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Total Duty & VAT</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedReport.totalDutyAndVat || "N/A"}</p>
                    </div>
                  </div>
                </section>

                {/* Line Items Section */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">Line Items</h3>
                  {selectedReport.items && selectedReport.items.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-xs">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100/50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">#</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Classification</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Values</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500 text-right">Taxes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {selectedReport.items.map((item: any) => (
                            <tr key={item.sequence} className="align-top hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-4 text-xs font-medium text-gray-400">
                                {item.sequence}
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <p className="text-xs font-mono font-medium text-gray-900">{item.commodityCode}</p>
                                  <p className="text-[0.6875rem] text-gray-600 max-w-[200px] leading-tight flex-wrap">{item.description}</p>
                                  <p className="text-[0.625rem] text-gray-400 mt-2">Net: {item.netMass}</p>
                                  <p className="text-[0.625rem] text-gray-400">CPC: {item.cpc}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <p className="text-[0.6875rem] text-gray-600"><span className="text-gray-400 text-[0.625rem]">Inv:</span> {item.itemPrice}</p>
                                  <p className="text-[0.6875rem] font-medium text-gray-900"><span className="text-gray-400 text-[0.625rem] font-normal">Customs:</span> {item.customsValue}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="space-y-1">
                                  <p className="text-[0.6875rem] text-red-600"><span className="text-gray-400 text-[0.625rem]">Duty:</span> {item.dutyPaid}</p>
                                  <p className="text-[0.6875rem] text-red-600"><span className="text-gray-400 text-[0.625rem]">VAT:</span> {item.vatAmount}</p>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 border border-dashed border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-500">No goods items available.</p>
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
