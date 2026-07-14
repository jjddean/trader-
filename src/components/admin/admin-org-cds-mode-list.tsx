"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  collectLiveFlipBlockers,
  confirmLiveFlip,
  confirmPracticeFlip,
} from "@/lib/admin-live-flip";

export function AdminOrgCdsModeList() {
  const convex = useConvex();
  const { organization } = useOrganization();
  const activeOrgId = organization?.id ?? "";
  const orgs = useQuery(api.org_hmrc.listOrganisationsForAdmin, {});
  const setOrgHmrcMode = useMutation(api.org_hmrc.setOrgMode);
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function flipOrg(
    orgId: string,
    currentMode: "practice" | "live",
    displayLabel: string,
    orgName?: string,
  ) {
    const resolvedOrgName =
      orgName ?? (orgId === activeOrgId ? organization?.name : undefined);

    if (currentMode === "live") {
      if (!confirmPracticeFlip(displayLabel)) return;
      setPendingOrgId(orgId);
      setError(null);
      try {
        await setOrgHmrcMode({ orgId, hmrcMode: "practice", orgName: resolvedOrgName });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update CDS mode");
      } finally {
        setPendingOrgId(null);
      }
      return;
    }

    setPendingOrgId(orgId);
    setError(null);
    try {
      const blockers = await collectLiveFlipBlockers(convex, orgId);
      if (blockers.length > 0) {
        window.alert(blockers.join("\n\n"));
        return;
      }
      if (!confirmLiveFlip(displayLabel)) return;

      await setOrgHmrcMode({ orgId, hmrcMode: "live", orgName: resolvedOrgName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update CDS mode");
    } finally {
      setPendingOrgId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Organisation CDS mode</h2>
      </div>

      {orgs === undefined ? (
        <p className="px-6 py-8 text-center text-xs text-slate-400">Loading organisations…</p>
      ) : orgs.length === 0 ? (
        <p className="px-6 py-8 text-center text-xs text-slate-500">No organisations yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-white">
              <tr>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Organisation
                </th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Mode
                </th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.map((row) => {
                const isLive = row.hmrcMode === "live";
                const isActive = row.orgId === activeOrgId;
                const isPending = pendingOrgId === row.orgId;
                const label =
                  isActive && organization?.name
                    ? organization.name
                    : row.displayLabel;

                return (
                  <tr
                    key={row.orgId}
                    className={cn("hover:bg-slate-50/50", isActive && "bg-blue-50/40")}
                  >
                    <td className="px-6 py-3">
                      <p className="text-xs font-medium text-slate-900" title={label}>
                        {label}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-600" title={row.orgId}>
                        {row.orgId}
                      </p>
                      {isActive && (
                        <p className="mt-0.5 text-[10px] font-medium text-blue-700">Selected</p>
                      )}
                      {!row.hasSettingsRow && (
                        <p className="mt-0.5 text-[10px] text-slate-400">Default test environment</p>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          isLive ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800",
                        )}
                      >
                        {isLive ? "Live CDS" : "Test environment"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600">
                      {row.updatedAt > 0
                        ? new Date(row.updatedAt).toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          void flipOrg(row.orgId, row.hmrcMode, label, row.orgName)
                        }
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {isPending ? "Saving…" : isLive ? "→ Test environment" : "→ Live"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="border-t border-slate-100 px-6 py-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
