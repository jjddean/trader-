"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Lightbulb, ExternalLink, Info, ShieldCheck } from "lucide-react";

const C285_GUIDANCE_URL =
  "https://www.gov.uk/guidance/how-to-claim-a-repayment-of-import-duty-and-vat-if-youve-overpaid";

function formatGbp(amount: number): string {
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Panel({ embedded, children }: { embedded?: boolean; children: ReactNode }) {
  if (embedded) return <div className="space-y-4">{children}</div>;
  return <div className="rounded-xl border border-slate-200 bg-white p-6">{children}</div>;
}

export function TreOpportunities({ embedded = false }: { embedded?: boolean }) {
  const data = useQuery(api.tre_analytics.listOpportunities, {});

  if (data === undefined) {
    return (
      <Panel embedded={embedded}>
        <p className="text-xs text-slate-400">Scanning imported history for preference opportunities…</p>
      </Panel>
    );
  }

  if (data.totalRowsScanned === 0) {
    return (
      <Panel embedded={embedded}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black">
          <Lightbulb className="h-4 w-4 text-slate-400" />
          Duty review
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Import HMRC TRE data in the Imports tab to scan your history for declarations where a
          preferential duty rate may have applied.
        </p>
      </Panel>
    );
  }

  if (data.opportunityCount === 0) {
    return (
      <Panel embedded={embedded}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          No duty reviews needed
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          We scanned {data.totalRowsScanned.toLocaleString("en-GB")} imported line items and found no
          declarations where a cheaper preferential rate clearly applied. This is a deterministic check
          against UK Trade Tariff measures, not advice on eligibility.
        </p>
      </Panel>
    );
  }

  return (
    <Panel embedded={embedded}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-black">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        Declarations to review
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        {data.opportunityCount.toLocaleString("en-GB")} of {data.candidateCount.toLocaleString("en-GB")}{" "}
        reviewed line items show a preferential rate that may have applied but was not claimed.
        Indicative difference across all flags:{" "}
        <span className="font-semibold text-slate-900">{formatGbp(data.indicativeTotalDelta)}</span>.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {data.disclaimer}
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">MRN</th>
              <th className="px-3 py-2 font-medium">Commodity</th>
              <th className="px-3 py-2 font-medium">Origin</th>
              <th className="px-3 py-2 font-medium">MFN rate</th>
              <th className="px-3 py-2 font-medium">Preferential rate</th>
              <th className="px-3 py-2 font-medium text-right">Indicative difference</th>
              <th className="px-3 py-2 font-medium">Within 3yr window</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.opportunities.map((opp, idx) => (
              <tr key={`${opp.mrn}-${opp.commodityCode}-${idx}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-[11px]">{opp.mrn}</td>
                <td className="px-3 py-2 font-mono">{opp.commodityCode}</td>
                <td className="px-3 py-2">{opp.countryOfOriginCode}</td>
                <td className="px-3 py-2 text-slate-600">{opp.mfnRateLabel || "—"}</td>
                <td className="px-3 py-2">
                  <span className="text-slate-900">{opp.preferenceRateLabel || "—"}</span>
                  {opp.requiresProofOfOrigin && (
                    <span className="ml-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      origin proof
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                  {formatGbp(opp.indicativeDelta)}
                </td>
                <td className="px-3 py-2">
                  {opp.withinRepaymentWindow ? (
                    <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Outside / unknown
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-medium text-slate-800">Think a flag applies to you?</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Whether duty can be repaid is decided by HMRC, not by Freightcode. If you hold valid proof of
          origin, you can apply to HMRC for a repayment of overpaid import duty and VAT (form C285).
        </p>
        <a
          href={C285_GUIDANCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          How to claim a repayment (HMRC C285 guidance)
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Panel>
  );
}
