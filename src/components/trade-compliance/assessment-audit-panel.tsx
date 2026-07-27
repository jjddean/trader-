"use client";

import { useState } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface AssessmentAuditPanelProps {
  assessmentId: Id<"export_assessments">;
  reference?: string;
}

interface AuditEntry {
  _id: string;
  action: string;
  actor?: string;
  timestamp: number;
  details: Record<string, unknown>;
}

const ACTION_LABELS: Record<string, string> = {
  export_assessment_created: "Assessment created",
  export_assessment_updated: "Assessment updated",
  export_evidence_added: "Product evidence added",
  export_evidence_removed: "Product evidence removed",
  export_extraction_persisted: "Document data extracted",
  classification_run_reviewed: "Classification reviewed",
  sanctions_screening_reviewed: "Sanctions screening reviewed",
  expert_request_created: "Expert review requested",
  export_licence_recorded: "Licence reference recorded",
  consultant_dispatch_created: "Sent to consultant for review",
  consultant_review_completed: "Consultant sign-off completed",
  end_user_dispatch_created: "Undertaking sent to end user",
  end_user_statement_submitted: "Undertaking submitted by end user",
};

/** Identifiers carry no meaning for the reader. */
const HIDDEN_DETAIL_KEYS = new Set([
  "assessmentId",
  "declarationId",
  "documentId",
  "entityId",
  "ipAddress",
  "licenceId",
  "productId",
  "runId",
  "screeningId",
  "tokenId",
]);

const DETAIL_LABELS: Record<string, string> = {
  applicationRef: "Application ref",
  approved: "Approved",
  consultantEmail: "Consultant",
  controlEntry: "Control entry",
  decision: "Decision",
  destinationCountry: "Destination",
  endUserCountry: "End-user country",
  endUserName: "End user",
  finalControlEntry: "Control entry",
  licenceRef: "Licence",
  licenceType: "Licence type",
  outcome: "Outcome",
  priorStatus: "Prior status",
  productCount: "Products",
  recipientEmail: "Recipient",
  reviewStatus: "Review status",
  route: "Route",
  signedBy: "Signed by",
  status: "Status",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

function detailLabel(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** On-screen label — "You" is fine in the live UI. */
function formatActorForUi(
  actor: string | undefined,
  currentUserId: string | undefined,
): string {
  if (!actor) return "System";
  if (currentUserId && actor === currentUserId) return "You";
  if (actor.includes("@")) return actor;
  return "Team member";
}

/**
 * Export label — never write "You". Prefer an email when available, otherwise
 * the stored actor string (Clerk id or third-party email).
 */
function formatActorForExport(
  actor: string | undefined,
  currentUserId: string | undefined,
  currentUserEmail: string | undefined,
): string {
  if (!actor) return "System";
  if (currentUserId && actor === currentUserId) {
    return currentUserEmail?.trim() || actor;
  }
  return actor;
}

function readableDetails(details: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(details)
    .filter(([key, value]) => {
      if (HIDDEN_DETAIL_KEYS.has(key)) return false;
      return (
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      );
    })
    .map(([key, value]) => ({
      key,
      value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
    }))
    .filter((entry) => entry.value.trim().length > 0);
}

function detailsSummary(details: Record<string, unknown>): string {
  return readableDetails(details)
    .map((entry) => `${detailLabel(entry.key)}: ${entry.value}`)
    .join("; ");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildAuditCsv(entries: AuditEntry[], actorName: (actor?: string) => string): string {
  const header = ["Timestamp (UTC)", "Action", "Actor", "Details"];
  const rows = entries.map((entry) =>
    [
      new Date(entry.timestamp).toISOString(),
      actionLabel(entry.action),
      actorName(entry.actor),
      detailsSummary(entry.details),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

function buildAuditText(entries: AuditEntry[], actorName: (actor?: string) => string): string {
  return entries
    .map((entry) => {
      const summary = detailsSummary(entry.details);
      const base = `${formatTimestamp(entry.timestamp)} — ${actionLabel(entry.action)} — ${actorName(entry.actor)}`;
      return summary ? `${base} — ${summary}` : base;
    })
    .join("\n");
}

function downloadCsv(csv: string, filename: string) {
  // BOM so Excel opens UTF-8 correctly.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AssessmentAuditPanel({ assessmentId, reference }: AssessmentAuditPanelProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const logs = useQuery(
    api.export_controls.getAssessmentAuditLogs,
    canQuery ? { assessmentId } : "skip",
  );

  const [hasCopied, setHasCopied] = useState(false);

  const currentUserId = user?.id;
  const currentUserEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress;

  const exportActor = (actor?: string) =>
    formatActorForExport(actor, currentUserId, currentUserEmail);
  const filenameBase = (reference ?? "assessment").replace(/\s+/g, "-");

  const handleCopy = async () => {
    if (!logs?.length) return;
    await navigator.clipboard.writeText(buildAuditText(logs, exportActor));
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!logs?.length) return;
    downloadCsv(buildAuditCsv(logs, exportActor), `${filenameBase}-audit-log.csv`);
  };

  if (!logs) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading audit trail…
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-black">Audit log</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            Every recorded action on this assessment, including sign-offs and undertakings completed
            by third parties. Append-only — entries cannot be edited or removed.
          </p>
        </div>
        {logs.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {hasCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {hasCopied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">No activity recorded yet.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {logs.map((log) => {
            const details = readableDetails(log.details);
            return (
              <li key={log._id} className="relative border-l border-slate-200 pl-4">
                <span className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 rounded-full bg-slate-300" />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-xs font-medium text-slate-900">{actionLabel(log.action)}</p>
                  <span className="text-[10px] text-slate-400">{formatTimestamp(log.timestamp)}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {formatActorForUi(log.actor, currentUserId)}
                </p>
                {details.length > 0 && (
                  <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {details.map((entry) => (
                      <div key={entry.key} className="flex gap-1 text-[11px]">
                        <dt className="text-slate-400">{detailLabel(entry.key)}:</dt>
                        <dd className="text-slate-700">{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
