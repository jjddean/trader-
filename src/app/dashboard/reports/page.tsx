"use client";

import { useState } from "react";
import { Search, Filter, ShieldAlert, ShieldCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Static mock data for UI review
const MOCK_REPORTS = [
  {
    id: "r_1",
    mrn: "MRN_8839201A",
    date: "17 Mar 2026",
    broker: "GB_FREIGHT_FWD_1",
    score: 100,
    status: "Clean",
  },
  {
    id: "r_2",
    mrn: "MRN_9100223B",
    date: "16 Mar 2026",
    broker: "GB_EXPRESS_LOGISTICS",
    score: 65,
    status: "Action Required",
  },
  {
    id: "r_3",
    mrn: "MRN_4431109C",
    date: "12 Mar 2026",
    broker: "GB_FREIGHT_FWD_1",
    score: 85,
    status: "Warning",
  },
  {
    id: "r_4",
    mrn: "MRN_2209551D",
    date: "10 Mar 2026",
    broker: "EU_CUSTOMS_SECURE",
    score: 100,
    status: "Clean",
  },
];

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");

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
    </div>
  );
}
