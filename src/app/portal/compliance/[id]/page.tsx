"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowLeft, ExternalLink, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

export default function PortalComplianceDetailPage() {
  const params = useParams();
  const assessmentId = params.id as Id<"export_assessments">;

  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const assessment = useQuery(
    api.client_portal.getMyComplianceAssessment,
    authReady ? { assessmentId } : "skip",
  );

  if (assessment === undefined) {
    return <div className="h-40" aria-hidden />;
  }

  if (assessment === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/portal/compliance"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-black"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All cases
        </Link>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h1 className="text-sm font-medium text-black">Case not available</h1>
          </div>
          <p className="px-6 py-6 text-xs text-slate-600">
            This assessment is not linked to your portal account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/portal/compliance"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-black"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All cases
      </Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-black">{assessment.reference}</h1>
            <p className="text-[11px] text-slate-500">Export control assessment</p>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium capitalize text-slate-700">
            {assessment.status.replaceAll("_", " ")}
          </span>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>Destination</label>
            <p className="text-xs text-black">{assessment.destinationCountry || "—"}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Control entry</label>
            <p className="font-mono text-xs text-black">{assessment.controlEntry || "—"}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Licence reference</label>
            <p className="font-mono text-xs text-black">{assessment.licenceRef || "—"}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>EUSU</label>
            <p className="text-xs text-black">
              {assessment.eusuCompleted ? "Submitted" : assessment.eusuPath ? "Pending" : "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>Screening</label>
            <p className="text-xs text-black">{assessment.screeningSummary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-6 py-4">
          {assessment.eusuPath ? (
            <a
              href={assessment.eusuPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Complete EUSU
            </a>
          ) : null}
          {assessment.govUkApplyUrl ? (
            <a
              href={assessment.govUkApplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-medium text-white hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open GOV.UK to apply
            </a>
          ) : null}
          <Link
            href={`/portal/messages?assessmentId=${assessmentId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message broker
          </Link>
          {!assessment.eusuPath && !assessment.govUkApplyUrl ? (
            <p className="w-full text-[11px] text-slate-500">
              {assessment.govUkHeadline || "No government actions available on this case yet."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
