"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { History, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminLoading } from "../page";

type AuditLog = {
  _id: string;
  userId?: string;
  action?: string;
  details?: Record<string, unknown>;
  entityId?: string;
  ipAddress?: string;
  timestamp?: number;
};

type ActionFilter = "all" | "submissions" | "hmrc" | "platform" | "errors";

function actionCategory(action: string): ActionFilter {
  if (action.includes("fail") || action.includes("error")) return "errors";
  if (action.includes("declaration") || action.includes("submit") || action.includes("amend") || action.includes("cancel")) {
    return "submissions";
  }
  if (action.includes("hmrc") || action.includes("auth") || action.includes("cds_file")) return "hmrc";
  return "platform";
}

function formatActionLabel(action: string) {
  return action.replace(/_/g, " ");
}

function formatTimestamp(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatUserId(userId?: string) {
  if (!userId) return "—";
  if (userId.includes("@")) return userId;
  if (userId.startsWith("user_") && userId.length > 16) return `${userId.slice(0, 14)}…`;
  return userId;
}

function summarizeDetails(details?: Record<string, unknown>) {
  if (!details || typeof details !== "object") return [];
  const keys = ["mrn", "declarationId", "conversationId", "notificationType", "status", "error", "message"];
  return keys
    .filter((key) => details[key] != null && String(details[key]).trim() !== "")
    .map((key) => ({ key, value: String(details[key]) }));
}

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const logs = useQuery(api.audit.getRecentLogs);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const term = searchQuery.toLowerCase().trim();
    return (logs as AuditLog[]).filter((log) => {
      const action = log.action ?? "";
      const category = actionCategory(action);
      if (actionFilter !== "all" && category !== actionFilter) return false;

      if (!term) return true;

      const haystack = [
        action,
        log.userId,
        log.entityId,
        log.ipAddress,
        JSON.stringify(log.details ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [logs, searchQuery, actionFilter]);

  const stats = useMemo(() => {
    if (!logs) return { total: 0, submissions: 0, hmrc: 0, errors: 0 };
    const rows = logs as AuditLog[];
    return {
      total: rows.length,
      submissions: rows.filter((l) => actionCategory(l.action ?? "") === "submissions").length,
      hmrc: rows.filter((l) => actionCategory(l.action ?? "") === "hmrc").length,
      errors: rows.filter((l) => actionCategory(l.action ?? "") === "errors").length,
    };
  }, [logs]);

  if (logs === undefined) {
    return <AdminLoading label="Loading activity log…" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
          <History className="h-5 w-5 text-slate-400" />
          Activity Log
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Submissions, HMRC OAuth, and platform actions across all users.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Recent events" value={stats.total} hint="Last 100 stored" />
        <StatTile label="Submissions" value={stats.submissions} hint="Submit, amend, cancel" />
        <StatTile label="HMRC auth" value={stats.hmrc} hint="OAuth & file upload" />
        <StatTile label="Errors" value={stats.errors} accent={stats.errors > 0 ? "danger" : undefined} hint="Failed operations" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, user, MRN, declaration…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
        >
          <option value="all">All categories</option>
          <option value="submissions">Submissions</option>
          <option value="hmrc">HMRC OAuth</option>
          <option value="platform">Platform</option>
          <option value="errors">Errors</option>
        </select>
        <span className="text-xs tabular-nums text-slate-400">{filteredLogs.length} shown</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredLogs.length === 0 ? (
          <p className="px-6 py-12 text-center text-xs text-slate-500">No activity matches your filters.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Time</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const action = log.action ?? "unknown";
                const category = actionCategory(action);
                const summary = summarizeDetails(log.details);
                const declarationId = log.details?.declarationId
                  ? String(log.details.declarationId)
                  : null;

                return (
                  <tr key={log._id} className="align-top hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-3 text-[11px] font-mono text-slate-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          category === "errors" && "border-red-100 bg-red-50 text-red-700",
                          category === "submissions" && "border-blue-100 bg-blue-50 text-blue-700",
                          category === "hmrc" && "border-green-100 bg-green-50 text-green-700",
                          category === "platform" && "border-slate-100 bg-slate-50 text-slate-700",
                        )}
                      >
                        {formatActionLabel(action)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-xs font-medium text-slate-900">{formatUserId(log.userId)}</p>
                      {log.ipAddress ? (
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{log.ipAddress}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-3">
                      {summary.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <dl className="space-y-0.5">
                          {summary.map(({ key, value }) => (
                            <div key={key} className="flex flex-wrap gap-x-2 text-[11px]">
                              <dt className="font-medium text-slate-500">{key}</dt>
                              <dd className="font-mono text-slate-700">
                                {key === "declarationId" && declarationId ? (
                                  <Link
                                    href={`/dashboard/declarations/${declarationId}/status`}
                                    className="text-blue-600 hover:underline"
                                  >
                                    {value.length > 20 ? `${value.slice(0, 18)}…` : value}
                                  </Link>
                                ) : (
                                  value.length > 48 ? `${value.slice(0, 46)}…` : value
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {log.details && Object.keys(log.details).length > summary.length ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[10px] font-medium text-slate-400 hover:text-slate-600">
                            Full payload
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded border border-slate-100 bg-slate-50/80 p-2 font-mono text-[10px] text-slate-600 whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Showing the 100 most recent events. For HMRC DMS correspondence, see{" "}
        <Link href="/dashboard/admin/notifications" className="text-blue-600 hover:underline">
          HMRC Notifications
        </Link>
        . Per-declaration audit rows appear on each declaration timeline.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  accent?: "danger";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", accent === "danger" ? "text-red-700" : "text-slate-900")}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
