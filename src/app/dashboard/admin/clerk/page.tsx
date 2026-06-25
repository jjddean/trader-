"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DeclarationStatusBadge,
  declarationHumanSubtitle,
  mrnSubtitleClass,
  mrnTitleClass,
  resolveDeclarationRowBadge,
  rowTintClass,
} from "@/lib/declaration-status-display";
import { AdminLoading } from "../page";

export default function AdminDeclarationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") === "needs-action" ? "needs-action" : "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter);

  const rows = useQuery(api.admin_ops.getDeclarationRows, { limit: 100 });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = searchQuery.toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        (row.mrn || "").toLowerCase().includes(term) ||
        (row.eori || "").toLowerCase().includes(term) ||
        (row.ownerEmail || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "needs-action" &&
          ["Rejected", "Invalid", "Action Required"].includes(row.status)) ||
        row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  if (rows === undefined) {
    return <AdminLoading label="Loading declarations…" />;
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Declarations</h1>
        <p className="mt-1 text-sm text-slate-500">
          All broker filings — searchable audit view with HMRC status. Open any row for the full timeline.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search MRN, EORI, owner…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
        >
          <option value="all">All statuses</option>
          <option value="needs-action">Needs action</option>
          <option value="Draft">Draft</option>
          <option value="Accepted">Accepted</option>
          <option value="Amended">Amended</option>
        </select>
        <span className="text-xs text-slate-400 tabular-nums">{filtered.length} shown</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-xs text-slate-500">No declarations match.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">MRN / LRN</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Owner</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">EORI</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Updated</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const { label, tone } = resolveDeclarationRowBadge(row);
                const subtitle = declarationHumanSubtitle(label, row.status, tone);
                return (
                  <tr
                    key={row.declarationId}
                    onClick={() => router.push(`/dashboard/declarations/${row.declarationId}/status`)}
                    className={cn("group cursor-pointer transition-colors", rowTintClass(tone))}
                  >
                    <td className="px-6 py-4">
                      <p className={cn("text-xs font-semibold", mrnTitleClass(tone))}>{row.mrn || "Pending CDS"}</p>
                      <p className={cn("text-[10px] font-medium", mrnSubtitleClass(tone))}>{subtitle}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{row.ownerEmail || "—"}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{row.eori || "—"}</td>
                    <td className="px-6 py-4 text-[10px] text-slate-500">
                      {row.lastUpdated ? new Date(row.lastUpdated).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <DeclarationStatusBadge tone={tone} label={label} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/declarations/${row.declarationId}/status`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100"
                      >
                        Timeline <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
