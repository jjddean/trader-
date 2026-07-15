"use client";

import { useEffect, useState } from "react";
import { Download, Search, Building2, Landmark, CheckCircle2, Copy, ChevronRight, Printer } from "lucide-react";
import { useDirectPrint } from "@/components/print/direct-print";
import { FinancialRecordPrintContent } from "@/components/print/financial-record-document";
import type { FinancialRecordPrintData } from "@/lib/print-sheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FINANCIAL_LABELS as FL } from "@/lib/financial-labels";
import Link from "next/link";
import { useQuery, useConvexAuth } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  getRememberedRecordsSnapshot,
  rememberRecordsSnapshot,
} from "@/lib/dashboard-compliance-cache";

type FinancialRecord = FunctionReturnType<typeof api.declarations.getFinancialRecords>[number];
export default function RecordsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerkUserId = user?.id ?? "";
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const { print, portal } = useDirectPrint();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;
  const recordsData = useQuery(api.declarations.getFinancialRecords, canQuery ? {} : "skip");

  const remembered = clerkUserId ? getRememberedRecordsSnapshot(clerkUserId) : null;
  const resolvedRecordsData = recordsData ?? remembered?.records;

  useEffect(() => {
    if (!clerkUserId || recordsData === undefined) return;
    rememberRecordsSnapshot(clerkUserId, recordsData);
  }, [clerkUserId, recordsData]);

  const isRecordsLoading = canQuery && resolvedRecordsData === undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!selectedRecord) return;
    const payload = [
      `MRN: ${selectedRecord.mrn || "N/A"}`,
      `Date: ${selectedRecord.date || "N/A"}`,
      `Tax Type: ${selectedRecord.type || "N/A"}`,
      `Method: ${selectedRecord.method || "N/A"}`,
      `Amount: £${Number(selectedRecord.amount || 0).toFixed(2)}`,
      `Account: ${selectedRecord.accountNumber || "N/A"}`,
      `Calculation: ${selectedRecord.calculationMethod || "N/A"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable in some browsers; fail silently.
    }
  };

  const handleDownloadRecord = () => {
    if (!selectedRecord) return;
    const data = {
      id: selectedRecord.id,
      mrn: selectedRecord.mrn,
      date: selectedRecord.date,
      type: selectedRecord.type,
      amount: selectedRecord.amount,
      method: selectedRecord.method,
      accountNumber: selectedRecord.accountNumber,
      statementContext: selectedRecord.statementContext,
      paymentLimit: selectedRecord.paymentLimit,
      calculationMethod: selectedRecord.calculationMethod,
      natureOfTransaction: selectedRecord.natureOfTransaction,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-record-${String(selectedRecord.mrn || "draft").replace(/\s+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredRecords = (resolvedRecordsData || []).filter((record) => {
    const term = searchQuery.toLowerCase();
    if (!term) return true;

    return (
      record.mrn?.toLowerCase().includes(term) ||
      record.date?.toLowerCase().includes(term) ||
      record.type?.toLowerCase().includes(term) ||
      record.method?.toLowerCase().includes(term) ||
      record.accountNumber?.toLowerCase().includes(term) ||
      record.provenanceLabel?.toLowerCase().includes(term)
    );
  });

  const formatAmount = (value: number) =>
    value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const sumByType = (records: FinancialRecord[], typeMatch: string, authoritativeOnly?: boolean) =>
    records
      .filter((r) => r.type?.includes(typeMatch))
      .filter((r) => authoritativeOnly === undefined || r.isAuthoritative === authoritativeOnly)
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const allRecords = resolvedRecordsData || [];
  const totalDuty = sumByType(allRecords, "Duty");
  const totalVat = sumByType(allRecords, "VAT");
  const confirmedDuty = sumByType(allRecords, "Duty", true);
  const estimatedDuty = sumByType(allRecords, "Duty", false);
  const confirmedVat = sumByType(allRecords, "VAT", true);
  const estimatedVat = sumByType(allRecords, "VAT", false);

  const dutySubtitle =
    confirmedDuty > 0 && estimatedDuty > 0
      ? `£${formatAmount(confirmedDuty)} ${FL.confirmedProvenance.toLowerCase()} · £${formatAmount(estimatedDuty)} estimated`
      : confirmedDuty > 0
        ? FL.confirmedProvenance
        : estimatedDuty > 0
          ? FL.pendingAssessment
          : "Historical duty from declaration ledgers";

  const vatSubtitle =
    confirmedVat > 0 && estimatedVat > 0
      ? `£${formatAmount(confirmedVat)} ${FL.confirmedProvenance.toLowerCase()} · £${formatAmount(estimatedVat)} estimated`
      : confirmedVat > 0
        ? FL.confirmedProvenance
        : estimatedVat > 0
          ? FL.pendingAssessment
          : "Import VAT from declaration ledgers";
  const handleExportCsv = () => {
    const grouped = filteredRecords.reduce((acc: Record<string, { mrn: string; date: string; dutyPaid: number; vat: number }>, record) => {
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

  const handlePrintRecord = () => {
    if (!selectedRecord) return;
    const data: FinancialRecordPrintData = {
      mrn: selectedRecord.mrn,
      date: selectedRecord.date,
      method: selectedRecord.method,
      accountNumber: selectedRecord.accountNumber,
      statementContext: selectedRecord.statementContext,
      paymentLimit: selectedRecord.paymentLimit,
      type: selectedRecord.type,
      calculationMethod: selectedRecord.calculationMethod,
      natureOfTransaction: selectedRecord.natureOfTransaction,
      amount: selectedRecord.amount,
    };
    print(<FinancialRecordPrintContent record={data} />);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      {portal}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Financial Records
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {FL.recordsPageIntro}
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Export to CSV
        </button>
      </div>

      {/* Top Tax Summary Blocks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
              Total Duty Paid
            </p>
            <Landmark className="h-4 w-4 text-slate-400" />
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            {isRecordsLoading ? "—" : `£${formatAmount(totalDuty)}`}
          </h2>
          <p className="mt-1 text-[0.625rem] text-slate-500">{dutySubtitle}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
              Import VAT (B00)
            </p>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            {isRecordsLoading ? "—" : `£${formatAmount(totalVat)}`}
          </h2>
          <p className="mt-1 text-[0.625rem] text-slate-500">{vatSubtitle}</p>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by MRN, Date, Tax Type, or Payment Method..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400"
            />
          </div>
        </div>

        {isRecordsLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Declaration MRN</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tax Type</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Payment Method</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                    Loading records…
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Landmark className="h-4 w-4 text-slate-300" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              {searchQuery ? "No matching financial records" : "No financial records yet"}
            </h4>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              {searchQuery
                ? "No financial records match your search. Try using a different term."
                : "Financial records will appear here once declaration charges are available."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Declaration MRN</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tax Type</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Payment Method</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record, idx) => (
                  <tr
                    key={record.id || idx}
                    onClick={() => setSelectedRecord(record)}
                    className="group cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-black">
                        {record.mrn}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {record.date}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-medium ${
                          record.type?.includes("Duty")
                            ? "bg-amber-100 text-amber-700"
                            : record.type?.includes("VAT")
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span>{record.method}</span>
                        {record.accountNumber && record.accountNumber !== "—" && (
                          <span className="font-mono text-[0.625rem] text-slate-500">{record.accountNumber}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-medium ${
                          record.isAuthoritative
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {record.isAuthoritative ? "HMRC" : "Estimate"}
                      </span>
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
      </div>

      {/* Side Sheet for Financial Record Details */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
          {selectedRecord && (
            <div className="flex flex-col min-h-full">
              <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-6 sm:px-8">
                <div className="relative rounded-xl border border-slate-100/80 bg-slate-50/80 px-4 py-3 shadow-sm">
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={isCopied ? "Copied" : "Copy record"}
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
                      aria-label="Print record"
                      onClick={handlePrintRecord}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    >
                      <Printer className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Download record"
                      onClick={handleDownloadRecord}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex gap-2 pr-20">
                    <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <SheetTitle className="text-sm font-semibold text-slate-900">
                        Tax Line Record
                      </SheetTitle>
                      <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>{selectedRecord.date}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{selectedRecord.mrn}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Populated Body Rendering Financial Tax Ledgers */}
              <div className="pt-6 px-6 sm:px-8 pb-12 space-y-8">
                <div
                  className={`rounded-lg border px-4 py-3 text-xs ${
                    selectedRecord.isAuthoritative
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {selectedRecord.provenanceLabel ||
                    (selectedRecord.isAuthoritative
                      ? FL.confirmedSettlement
                      : FL.estimatedFromDeclaration)}
                </div>

                {/* Transaction & Account Details Section */}
                <section className="bg-slate-50/80 rounded-xl p-6 border border-slate-100/80 shadow-sm">
                  <h3 className="mb-6 text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3">Transaction & Account Details</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Account Used</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedRecord.method}</p>
                      <p className="text-[0.6875rem] text-slate-600 mt-1 font-mono">{selectedRecord.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Statement Context</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedRecord.statementContext}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Payment Limits / Balance</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedRecord.paymentLimit}</p>
                    </div>
                  </div>
                </section>

                {/* Tax Line Breakdown Section */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">Tax Line Breakdown</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Specific Tax Type</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedRecord.type}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Calculation Method</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedRecord.calculationMethod}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Nature of Transaction</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedRecord.natureOfTransaction}</p>
                    </div>
                  </div>
                  
                  <div className="mt-8 rounded-lg bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                     <div>
                       <p className="text-xs font-semibold text-slate-900">Total Tax Amount</p>
                       <p className="text-[0.625rem] text-slate-500 mt-0.5">Calculated value for this ledger line</p>
                     </div>
                     <p className="text-xl font-bold tracking-tight text-slate-900">
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
