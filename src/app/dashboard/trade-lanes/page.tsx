"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, ArrowRight, Ship } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Draft", label: "Draft" },
  { value: "Inactive", label: "Inactive" },
] as const;

export default function TradeLanesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const lanes: Array<{
    id: string;
    code: string;
    origin: string;
    destination: string;
    mode: string;
    status: string;
    subtitle: string;
  }> = [];

  const filteredLanes = lanes.filter((lane) => {
    if (statusFilter !== "all" && lane.status !== statusFilter) return false;
    const term = searchQuery.toLowerCase();
    if (!term) return true;
    return (
      lane.code.toLowerCase().includes(term) ||
      lane.origin.toLowerCase().includes(term) ||
      lane.destination.toLowerCase().includes(term) ||
      lane.mode.toLowerCase().includes(term) ||
      lane.status.toLowerCase().includes(term)
    );
  });

  const hasActiveFilters = statusFilter !== "all" || searchQuery.length > 0;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Trade Lanes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage contracted carrier lanes and published rates.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Trade Lane
        </button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by lane, origin, destination, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50",
                  statusFilter !== "all" ? "border-slate-400" : "border-slate-200",
                )}
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 z-[120] w-44 rounded-md border border-slate-200 bg-white p-2 shadow-md">
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option.value);
                        setShowFilters(false);
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100",
                        statusFilter === option.value && "bg-slate-100 font-medium text-black",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="w-[40%] px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    Lane
                  </th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    Route
                  </th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    Mode
                  </th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="w-[80px] px-6 py-3 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLanes.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="flex flex-col items-center py-6 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                          <Ship className="h-4 w-4 text-slate-300" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {hasActiveFilters ? "No matching trade lanes" : "No trade lanes yet"}
                        </h4>
                        <p className="mt-1 max-w-sm text-xs text-slate-500">
                          {hasActiveFilters
                            ? "No trade lanes match your search or selected filters."
                            : "Create your first trade lane to get started."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLanes.map((lane) => (
                    <tr
                      key={lane.id}
                      onClick={() => router.push(`/dashboard/trade-lanes/${lane.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-black transition-colors group-hover:text-black">
                            {lane.code}
                          </span>
                          <span className="mt-0.5 text-[0.625rem] font-medium text-slate-500">
                            {lane.subtitle}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                        {lane.origin} → {lane.destination}
                      </td>
                      <td className="px-6 py-4 text-[0.6875rem] text-slate-600">{lane.mode}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-700">
                          {lane.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
