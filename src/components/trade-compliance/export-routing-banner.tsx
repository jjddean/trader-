"use client";

import { ExternalLink } from "lucide-react";
import { resolveSubmissionRoute } from "@/lib/export-controls/routing";
import { cn } from "@/lib/utils";

interface ExportRoutingBannerProps {
  originJurisdiction?: "GB" | "NI";
  destinationCountry?: string;
  products: Array<{
    classificationRuns?: Array<{
      requiresReview: boolean;
      finalControlEntry?: string;
    }>;
  }>;
}

export function ExportRoutingBanner({
  originJurisdiction,
  destinationCountry,
  products,
}: ExportRoutingBannerProps) {
  const approvedControlEntries = products.flatMap((product) => {
    const run = product.classificationRuns?.[0];
    if (run && run.requiresReview === false) {
      return [run.finalControlEntry ?? ""];
    }
    return [];
  });

  const routing = resolveSubmissionRoute({
    originJurisdiction,
    destinationCountry,
    approvedControlEntries,
  });

  const tone =
    routing.route === "spire"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : routing.route === "lite"
        ? "border-blue-200 bg-blue-50 text-blue-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <section className={cn("rounded-xl border p-5", tone)}>
      <h3 className="text-sm font-semibold">Submission route</h3>
      <p className="mt-2 text-xs leading-relaxed">{routing.headline}</p>
      {routing.niReviewRequired && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          Northern Ireland origin — review required before export decision.
        </p>
      )}
      {routing.reasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] opacity-90">
          {routing.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {routing.route !== "none" && (
        <a
          href={routing.govUkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2"
        >
          {routing.route === "spire" ? "View SPIRE / SIEL guidance on GOV.UK" : "Open official GOV.UK SIEL service"}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <p className="mt-3 text-[10px] opacity-60">
        Routing tables verified {routing.verifiedAt} ·{" "}
        <a href={routing.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Source
        </a>
      </p>
    </section>
  );
}
