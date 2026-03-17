"use client";

import { useState } from "react";
import { Download, Search, Building2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Static mock data for UI review
const MOCK_RECORDS = [
  {
    mrn: "MRN_8839201A",
    type: "Duty (A00)",
    amount: 12500.00,
    method: "Deferment Account (DAN)",
    date: "17 Mar 2026",
  },
  {
    mrn: "MRN_8839201A",
    type: "Postponed VAT (B00)",
    amount: 4200.50,
    method: "Postponed VAT Accounting",
    date: "17 Mar 2026",
  },
  {
    mrn: "MRN_9100223B",
    type: "Duty (A00)",
    amount: 800.00,
    method: "Cash / Immediate Payment",
    date: "16 Mar 2026",
  },
];

export default function RecordsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const totalDuty = MOCK_RECORDS.filter(r => r.type.includes("Duty")).reduce((acc, curr) => acc + curr.amount, 0);
  const totalPVA = MOCK_RECORDS.filter(r => r.type.includes("VAT")).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financial Records</h1>
          <p className="text-sm text-muted-foreground">
            VAT and Duty ledgers generated from your historic HMRC declarations.
          </p>
        </div>
        <Button variant="outline" className="h-9 px-4">
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      {/* Top Tax Summary Blocks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">
              Total Duty Paid
            </h3>
            <Landmark className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-medium tracking-tight text-gray-900">
              £{totalDuty.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="mt-1 text-xs text-gray-500">Historical duty calculated from ledgers</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">
              Postponed VAT (PVA)
            </h3>
            <Building2 className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-medium tracking-tight text-gray-900">
              £{totalPVA.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="mt-1 text-xs text-gray-500">Total deferred import VAT payments</p>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="relative w-72">
        <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search ledger by MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="focus:border-ring focus:ring-ring/50 h-[32px] w-full rounded-md border border-gray-200 bg-gray-50 pr-3 pl-8 text-xs text-gray-700 placeholder:text-gray-400 transition-[color,box-shadow] outline-none focus:ring-[2px]"
        />
      </div>

      <Card className="bg-white shadow-none border-[#e9e9e7]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#fbfbfa] border-b border-[#e9e9e7]">
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Declaration MRN</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Tax Type</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Payment Method</th>
                  <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9e9e7]">
                {MOCK_RECORDS.map((record, idx) => (
                  <tr
                    key={idx}
                    className="group transition-colors hover:bg-[#f7f7f5]"
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
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-700">
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
        </CardContent>
      </Card>
    </div>
  );
}
