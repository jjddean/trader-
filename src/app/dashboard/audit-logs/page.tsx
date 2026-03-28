"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { 
  ShieldCheck, 
  History, 
  Search, 
  Filter, 
  Download, 
  ArrowUpRight,
  Clock,
  User,
  Activity,
  FileText,
  Key
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const logs = useQuery(api.audit.getRecentLogs);

  const filteredLogs = logs?.filter((log: any) => 
    !searchQuery || 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(log.metadata || {}).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionIcon = (action: string) => {
    if (action.includes("submitted")) return <ArrowUpRight className="h-3.5 w-3.5" />;
    if (action.includes("auth") || action.includes("link")) return <Key className="h-3.5 w-3.5" />;
    return <Activity className="h-3.5 w-3.5" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("submitted")) return "bg-blue-50 text-blue-700 border-blue-100";
    if (action.includes("auth") || action.includes("link")) return "bg-green-50 text-green-700 border-green-100";
    if (action.includes("error") || action.includes("fail")) return "bg-red-50 text-red-700 border-red-100";
    return "bg-gray-50 text-gray-700 border-gray-100";
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">System Audit Logs</h1>
          <p className="mt-1 text-sm text-gray-500">Immutable trail of platform actions for HMRC compliance.</p>
        </div>
        <button className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Export Audit Trail
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Total Logs" value={logs?.length || 0} icon={<History className="h-4 w-4" />} />
        <StatsCard title="Security Events" value={logs?.filter((l: any) => l.action.includes("auth")).length || 0} icon={<Key className="h-4 w-4" />} />
        <StatsCard title="Last Activity" value={logs?.[0] ? "Just now" : "None"} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by action, ID, or metadata..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition-colors focus:border-gray-400"
        />
      </div>

      <Card className="overflow-hidden border-gray-200 shadow-none">
        <CardContent className="p-0">
          {!logs ? (
            <div className="py-20 text-center text-gray-400">Loading audit trail...</div>
          ) : filteredLogs?.length === 0 ? (
            <div className="py-20 text-center text-gray-500">No matching audit events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs?.map((log: any) => (
                    <tr key={log._id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-[11px] font-mono text-gray-400">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          getActionColor(log.action)
                        )}>
                          {getActionIcon(log.action)}
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                            <User className="h-3 w-3 text-gray-400" />
                          </div>
                          <span className="text-xs font-semibold text-gray-900 truncate max-w-[120px]">
                            {log.userId.startsWith("user_") ? log.userId.slice(0, 12) + "..." : log.userId}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-md">
                          <pre className="text-[10px] font-mono text-gray-600 bg-gray-50/50 p-2 rounded border border-gray-100/50 truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                            {JSON.stringify(log.metadata || log.details || {}, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
          {title}
        </p>
        <div className="text-gray-300">{icon}</div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
        {value}
      </h2>
    </div>
  );
}
