"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowLeft, FileText, History } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

function statusBadgeClass(status: string) {
  if (status === "Clean" || status === "Accepted") return "bg-green-100 text-green-700";
  if (status === "Action Required" || status === "Rejected") return "bg-red-100 text-red-700";
  if (status === "Submitted") return "bg-blue-100 text-blue-700";
  if (status === "Draft") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-800";
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Filing facts only — documents, charges, messages live in their sidebar pages. */
export default function PortalDeclarationPage() {
  const params = useParams();
  const declarationId = params.id as Id<"declarations">;

  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);
  const args = authReady ? { declarationId } : "skip";

  const declaration = useQuery(api.client_portal.getMyDeclaration, args);
  const timeline = useQuery(api.client_portal.getMyDeclarationStatusTimeline, args);

  if (declaration === undefined) {
    return <div className="h-40" aria-hidden />;
  }

  if (declaration === null) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h1 className="text-sm font-medium text-black">Declaration not found</h1>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs text-slate-600">This declaration is not available in your portal.</p>
          <Link
            href="/portal/declarations"
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 underline hover:text-black"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to declarations
          </Link>
        </div>
      </div>
    );
  }

  const latest = timeline?.[0];

  return (
    <div className="space-y-6">
      <Link
        href="/portal/declarations"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-black"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All declarations
      </Link>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <FileText className="h-4 w-4 text-slate-400" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-black">
              {declaration.mrn || "MRN pending"}
            </h1>
            <p className="text-[11px] text-slate-500">Clearance status</p>
          </div>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[0.625rem] font-medium",
              statusBadgeClass(declaration.status),
            )}
          >
            {declaration.status}
          </span>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>Declaration type</label>
            <p className="text-xs text-black">{declaration.declarationType || "—"}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Origin</label>
            <p className="text-xs text-black">{declaration.originCountry || "—"}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Dispatch</label>
            <p className="text-xs text-black">{declaration.dispatchCountry || "—"}</p>
          </div>
          {latest ? (
            <div className="sm:col-span-2">
              <label className={FIELD_LABEL}>Latest update</label>
              <p className="text-xs text-black">{latest.label}</p>
              {latest.detail ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{latest.detail}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-medium text-black">Parties</h2>
          <p className="text-[11px] text-slate-500">Who is filed for, and who filed</p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>Importer</label>
            <p className="text-xs text-black">{declaration.importerName || "—"}</p>
            {declaration.importerCountry ? (
              <p className="mt-0.5 text-[10px] text-slate-400">{declaration.importerCountry}</p>
            ) : null}
          </div>
          <div>
            <label className={FIELD_LABEL}>Representative</label>
            <p className="text-xs text-black">{declaration.representativeName || "—"}</p>
            {declaration.representativeEori ? (
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                {declaration.representativeEori}
              </p>
            ) : null}
          </div>
          <div>
            <label className={FIELD_LABEL}>Representation</label>
            <p className="text-xs capitalize text-black">
              {declaration.representationType || "—"}
            </p>
          </div>
        </div>
        {declaration.representationType === "indirect" && (
          <div className="border-t border-slate-100 bg-amber-50/60 px-6 py-3">
            <p className="text-[11px] leading-relaxed text-amber-950">
              Indirect representation: the representative files in their own name on your behalf.
              You and the representative are jointly and severally liable for any customs debt
              (HMRC guidance).
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <History className="h-4 w-4 text-slate-400" />
          <div>
            <h2 className="text-sm font-medium text-black">History</h2>
            <p className="text-[11px] text-slate-500">HMRC notifications and submission events</p>
          </div>
        </div>
        <div className="p-6">
          {timeline === undefined ? (
            <div className="h-16" aria-hidden />
          ) : timeline.length === 0 ? (
            <p className="text-xs text-slate-500">No history events yet.</p>
          ) : (
            <ul className="space-y-2">
              {timeline.map((event, idx) => (
                <li
                  key={`${event.kind}-${event.at}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-black">{event.label}</p>
                    {event.detail && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{event.detail}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatTime(event.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
