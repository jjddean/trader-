"use client";

import { useState } from "react";
import { Download, Search, Building2, Landmark, CheckCircle2, Copy, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";

export default function RecordsPage() {
  const { user } = useUser();
  const declarationPreviews = useQuery(api.declarations.getDeclarationPreviews, user?.id ? {} : "skip");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const recordsData = (declarationPreviews || [])
    .filter((preview: any) => preview.status !== "Draft")
    .map((preview: any) => ({
      id: `${preview.declarationId}-duty`,
      mrn: preview.mrn || "Draft",
      type: "Duty (A00)",
      amount: 0,
      method: "Deferment Account (DAN)",
      date: new Date(preview.lastUpdated || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      accountNumber: "DAN 8931234",
      statementContext: "Monthly Statement",
      paymentLimit: "£1,200,000.00",
      calculationMethod: `Derived from declaration preview total value £${Number(preview.totalValue || 0).toFixed(2)}`,
      natureOfTransaction: "11 (Outright Purchase)",
    }));
  const filteredRecords = recordsData.filter((record: any) =>
    !searchQuery || record.mrn?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalDuty = recordsData.filter((r: any) => r.type.includes("Duty")).reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const totalPVA = recordsData.filter((r: any) => r.type.includes("VAT")).reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const handleExportCsv = () => {
    const grouped = filteredRecords.reduce((acc: Record<string, { mrn: string; date: string; dutyPaid: number; vat: number }>, record: any) => {
      const key = `${record.mrn}__${record.date}`;
      if (!acc[key]) {
        acc[key] = { mrn: record.mrn, date: record.date, dutyPaid: 0, vat: 0 };
      }
      if (record.type?.includes("Duty")) acc[key].dutyPaid += Number(record.amount) || 0;
      if (record.type?.includes("VAT")) acc[key].vat += Number(record.amount) || 0;
      return acc;
    }, {});

    const csvRows = [
      "MRN,date,duty paid,VAT,total",
      ...Object.values(grouped).map((row) => {
        const total = row.dutyPaid + row.vat;
        return `${row.mrn},${row.date},${row.dutyPaid.toFixed(2)},${row.vat.toFixed(2)},${total.toFixed(2)}`;
      }),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial-records.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Financial Records
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            VAT and Duty ledgers generated from your historic HMRC declarations.
          </p>
        </div>
        <button onClick={handleExportCsv} className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800">
          <Download className="h-4 w-4" />
          Export to CSV
        </button>
      </div>

      {/* Top Tax Summary Blocks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
              Total Duty Paid
            </p>
            <Landmark className="h-4 w-4 text-gray-400" />
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            £{totalDuty.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">Historical duty calculated from ledgers</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
              Postponed VAT (PVA)
            </p>
            <Building2 className="h-4 w-4 text-gray-400" />
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            £{totalPVA.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">Total deferred import VAT payments</p>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search ledger by MRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-gray-400"
          />
        </div>
      </div>

      <Card className="bg-white shadow-none border-[#e9e9e7]">
        <CardContent className="p-0">
          {declarationPreviews === undefined ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
              <p className="text-xs text-gray-400">Loading Financial Records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="mb-4 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No financial ledgers generated yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-[#e9e9e7]">
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Declaration MRN</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Tax Type</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Payment Method</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9e9e7]">
                {filteredRecords.map((record: any, idx: number) => (
                  <tr
                    key={record.id || idx}
                    onClick={() => setSelectedRecord(record)}
                    className="group cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-black">
                        {record.mrn}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600">
                      {record.date}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-medium ${
                          record.type?.includes("Duty")
                            ? "bg-amber-100 text-amber-700"
                            : record.type?.includes("VAT")
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600">
                      {record.method}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-black">
                        £{record.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Side Sheet for Financial Record Details */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
          {selectedRecord && (
            <div className="flex flex-col min-h-full">
              <SheetHeader className="px-6 sm:px-8 pt-6 pb-6 border-b border-gray-100 flex flex-row items-center justify-between shrink-0 sticky top-0 bg-white z-10">
                <div>
                  <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Landmark className="h-4 w-4 text-gray-400" />
                    Tax Line Record
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2 text-xs">
                    <span>{selectedRecord.date}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>{selectedRecord.mrn}</span>
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

              {/* Populated Body Rendering Financial Tax Ledgers */}
              <div className="pt-6 px-6 sm:px-8 pb-12 space-y-8">
                {/* Transaction & Account Details Section */}
                <section className="bg-gray-50/80 rounded-xl p-6 border border-gray-100/80 shadow-sm">
                  <h3 className="mb-6 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3">Transaction & Account Details</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Account Used</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedRecord.method}</p>
                      <p className="text-[0.6875rem] text-gray-600 mt-1 font-mono">{selectedRecord.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Statement Context</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedRecord.statementContext}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Payment Limits / Balance</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedRecord.paymentLimit}</p>
                    </div>
                  </div>
                </section>

                {/* Tax Line Breakdown Section */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">Tax Line Breakdown</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Specific Tax Type</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedRecord.type}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Calculation Method</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedRecord.calculationMethod}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Nature of Transaction</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedRecord.natureOfTransaction}</p>
                    </div>
                  </div>
                  
                  <div className="mt-8 rounded-lg bg-gray-50 p-4 border border-gray-100 flex items-center justify-between">
                     <div>
                       <p className="text-xs font-semibold text-gray-900">Total Tax Amount</p>
                       <p className="text-[0.625rem] text-gray-500 mt-0.5">Calculated value for this ledger line</p>
                     </div>
                     <p className="text-xl font-bold tracking-tight text-gray-900">
                       £{selectedRecord.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <Link href="/dashboard/reports" className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                      View Full Declaration Report <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </section>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
