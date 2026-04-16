"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { 
  Search, 
  Filter, 
  Loader2, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  Bot,
  Activity,
  History
} from "lucide-react";

export default function OnlineClerkPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const declarations = useQuery(api.declarations.getAllDecls, { limit: 300 });

  const filteredDeclarations = declarations?.filter((dec: any) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = !term || 
      (dec.mrn || "Pending").toLowerCase().includes(term) ||
      (dec.eori || "").toLowerCase().includes(term) ||
      (dec.userId || "").toLowerCase().includes(term);
    
    const matchesStatus = statusFilter === "all" || dec.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Online Clerk Hub</h1>
          <p className="mt-1 text-sm text-gray-500">
            Operational control plane for all platform-wide declarations and notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex h-8 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-600">
             <Activity className="h-3 w-3 text-blue-500" />
             {declarations?.length || 0} Total Entries
           </div>
           <div className="flex h-8 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-600">
             <Bot className="h-3 w-3 text-indigo-500" />
             AI Clerk Active
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by MRN, EORI, or User ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-gray-400 md:max-w-md"
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-700 outline-none focus:border-gray-400 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Cleared">Cleared</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Draft">Draft</option>
          </select>
          <button className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Filter className="h-3 w-3" />
            Filters
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {declarations === undefined ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : filteredDeclarations && filteredDeclarations.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">MRN / LRN</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Merchant EORI</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">User ID</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Type</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-[10px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDeclarations.map((dec: any) => (
                <tr
                  key={dec._id}
                  className="group cursor-pointer transition-colors hover:bg-gray-50/50"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-bold text-gray-900 tracking-tight">
                      {dec.mrn || "WAITING_CDS"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-600">{dec.eori || " GB—UNSET"}</td>
                  <td className="px-6 py-4 text-xs font-mono text-gray-400">
                    {dec.userId.slice(0, 12)}...
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 font-medium">{dec.declarationType || "IM"}</td>
                  <td className="px-6 py-4">
                    {dec.status === "Cleared" || dec.status === "Accepted" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase tracking-wider border border-green-200">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        {dec.status}
                      </span>
                    ) : dec.status === "Rejected" || dec.status === "Action Required" || dec.status === "Invalid" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wider border border-red-200">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        {dec.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider border border-blue-200">
                        <History className="h-2.5 w-2.5" />
                        {dec.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="rounded-md bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-600 transition-colors hover:bg-gray-100">
                      View Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
           <div className="flex flex-col items-center justify-center py-16 text-center">
             <FileText className="mb-4 h-8 w-8 text-gray-300" />
             <h3 className="text-sm font-medium text-gray-900">No global declarations found</h3>
             <p className="mt-1 text-xs text-gray-500">
               Check system connectivity or filter parameters.
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
