"use client";

import { useState } from "react";
import { Search, Filter, ShieldAlert, ShieldCheck, ChevronRight, Download, Copy, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

// Detailed mock data replicating HMRC Import Header & Import Item data report structure
const MOCK_REPORTS = [
  {
    id: "r_1",
    mrn: "MRN_8839201A",
    date: "17 Mar 2026",
    broker: "GB_FREIGHT_FWD_1",
    score: 100,
    status: "Clean",
    ducr: "1GB123456789000-01",
    lrn: "LRN20260317001",
    importer: "GB123456789000 (TechCorp Ltd)",
    declarant: "GB987654321000 (Fast Freight)",
    consignor: "US_SUPPLIER_INC",
    dispatchCountry: "US",
    originCountry: "US",
    portCode: "GBSOU",
    acceptanceDate: "17-03-2026 08:30:00",
    clearanceDate: "17-03-2026 09:15:00",
    totalInvoiceValue: "USD 32,000.00",
    totalCustomsValue: "GBP 25,000.00",
    totalDutyAndVat: "GBP 5,000.00",
    items: [
      {
        sequence: 1,
        commodityCode: "8517620000",
        description: "Networking Equipment",
        netMass: "150.5 kg",
        cpc: "4000 000",
        itemPrice: "USD 32,000.00",
        customsValue: "GBP 25,000.00",
        dutyPaid: "£0.00",
        vatAmount: "£5,000.00",
      }
    ]
  },
  {
    id: "r_2",
    mrn: "MRN_9100223B",
    date: "16 Mar 2026",
    broker: "GB_EXPRESS_LOGISTICS",
    score: 65,
    status: "Action Required",
    ducr: "1GB987654321000-05",
    lrn: "LRN20260316044",
    importer: "GB123456789000 (TechCorp Ltd)",
    declarant: "GB112233445566 (Express Logs)",
    consignor: "CN_MANUFACTURING",
    dispatchCountry: "CN",
    originCountry: "CN",
    portCode: "GBFXT",
    acceptanceDate: "16-03-2026 11:10:00",
    clearanceDate: "Pending",
    totalInvoiceValue: "CNY 150,000.00",
    totalCustomsValue: "GBP 18,500.00",
    totalDutyAndVat: "GBP 4,200.00",
    items: [
      {
        sequence: 1,
        commodityCode: "8544429090",
        description: "Telecommunication Cables",
        netMass: "800.0 kg",
        cpc: "4000 000",
        itemPrice: "CNY 150,000.00",
        customsValue: "GBP 18,500.00",
        dutyPaid: "£500.00",
        vatAmount: "£3,700.00",
      }
    ]
  },
  {
    id: "r_3",
    mrn: "MRN_4431109C",
    date: "12 Mar 2026",
    broker: "GB_FREIGHT_FWD_1",
    score: 85,
    status: "Warning",
    ducr: "1GB555444333222-02",
    lrn: "LRN20260312019",
    importer: "GB123456789000 (TechCorp Ltd)",
    declarant: "GB987654321000 (Fast Freight)",
    consignor: "FR_DISTRIBUTOR",
    dispatchCountry: "FR",
    originCountry: "FR",
    portCode: "GBDOV",
    acceptanceDate: "12-03-2026 14:00:00",
    clearanceDate: "12-03-2026 14:45:00",
    totalInvoiceValue: "EUR 10,000.00",
    totalCustomsValue: "GBP 8,500.00",
    totalDutyAndVat: "GBP 1,700.00",
    items: [
      {
        sequence: 1,
        commodityCode: "3926909790",
        description: "Plastic Components",
        netMass: "45.0 kg",
        cpc: "4000 000",
        itemPrice: "EUR 10,000.00",
        customsValue: "GBP 8,500.00",
        dutyPaid: "£0.00",
        vatAmount: "£1,700.00",
      }
    ]
  },
];

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<typeof MOCK_REPORTS[0] | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Customs Reports</h1>
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
        <Button variant="ghost" className="h-9 px-3 text-foreground">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Reports Table */}
      <Card className="bg-white shadow-none border-[#e9e9e7]">
        <CardContent className="p-0">
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
                {MOCK_REPORTS.map((report) => (
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
                        <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[0.625rem] font-medium text-orange-700">
                          <ShieldAlert className="h-3 w-3" />
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
        </CardContent>
      </Card>

      {/* Side Sheet for Report Details */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent side="right" className="overflow-y-auto custom-scrollbar sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
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
                <section>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">Header Info (Import Header)</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">DUCR</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.ducr || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">LRN</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.lrn || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Importer</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.importer || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Declarant (Agent)</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.declarant || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Acceptance Date</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.acceptanceDate || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Clearance Date</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.clearanceDate || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Routing</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">
                        {selectedReport.originCountry} → {selectedReport.dispatchCountry} → {selectedReport.portCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Total Invoice Value</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.totalInvoiceValue || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Total Duty & VAT</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedReport.totalDutyAndVat || "N/A"}</p>
                    </div>
                  </div>
                </section>

                {/* Line Items Section */}
                <section>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">Goods Items (Import Item)</h3>
                  {selectedReport.items && selectedReport.items.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-xs">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/80 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Seq</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Classification</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Financials</th>
                            <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500 text-right">Tax Breakdown</th>
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
