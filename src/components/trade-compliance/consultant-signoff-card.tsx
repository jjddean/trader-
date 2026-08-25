"use client";

import { useState } from "react";
import { Loader2, Mail, Send, ShieldCheck, X } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ApiError, userMessageFromError } from "@/lib/convex-errors";

const CONSULTANT_BIO = "UK export controls — dual-use classification and licence review.";
const CONSULTANT_ROLE_OPTIONS = [
  { value: "adviser", label: "Adviser" },
  { value: "applies_on_behalf", label: "Applies on behalf" },
  { value: "eor", label: "Exporter of record" },
] as const;

type ConsultantRole = (typeof CONSULTANT_ROLE_OPTIONS)[number]["value"];

interface ConsultantSignoffCardProps {
  assessmentId: Id<"export_assessments">;
  status: string;
  /** send = Draft Pack (form + outcome). result = Overview (outcome only). */
  variant?: "send" | "result";
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ConsultantSignoffCard({
  assessmentId,
  status,
  variant = "send",
}: ConsultantSignoffCardProps) {
  const { isAuthenticated } = useConvexAuth();

  const dispatchStatus = useQuery(
    api.compliance_consultant.getConsultantDispatchStatus,
    isAuthenticated ? { assessmentId } : "skip",
  );

  const [senderNote, setSenderNote] = useState("");
  const [consultantRole, setConsultantRole] = useState<ConsultantRole | "">("");
  const [sending, setSending] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const latest = dispatchStatus?.latestRequest;
  const isComplete = latest?.status === "completed" || latest?.status === "blocked";
  const isOpen = dispatchStatus?.isOpen ?? false;
  const deliveryFailed = latest?.deliveryStatus === "failed";
  const dispatchLoaded = dispatchStatus !== undefined;
  const canRetry = dispatchLoaded && isOpen && deliveryFailed;
  const canCreate = dispatchLoaded && !isOpen;

  if (variant === "result") {
    if (!isComplete) return null;
    return (
      <section className="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 className="text-sm font-semibold text-green-900">Consultant sign-off</h2>
        <p className="mt-2 text-xs font-medium text-green-900">
          {latest?.status === "completed" ? "Signed off" : "Blocked"} by consultant
        </p>
        {latest?.advisoryNotes && <p className="mt-2 text-xs text-green-800">{latest.advisoryNotes}</p>}
        {(latest?.applicationRef || latest?.licenceRef) && (
          <p className="mt-2 text-[11px] text-green-900">
            {latest.applicationRef && `App: ${latest.applicationRef}`}
            {latest.licenceRef && ` · Licence: ${latest.licenceRef}`}
          </p>
        )}
        {latest?.reviewerVerified && latest.reviewerEmail && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-green-800">
            <ShieldCheck className="h-3 w-3" />
            Verified reviewer · {latest.reviewerEmail}
          </p>
        )}
      </section>
    );
  }

  const showCard = status !== "clear" || latest;
  if (!showCard) return null;

  const handleSend = async () => {
    if (canCreate && !consultantRole) {
      setError("Consultant role is required");
      return;
    }

    setSending(true);
    setError(null);
    setWarning(null);
    setSentTo(null);

    try {
      const res = await fetch("/api/export-controls/send-to-consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          canRetry && latest
            ? { retryExpertRequestId: latest._id }
            : {
                assessmentId,
                consultantRole,
                senderNote: senderNote.trim() || undefined,
              },
        ),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(body.error || "Send failed");
      setSentTo(body.partner ?? "the consultant");
    } catch (err: unknown) {
      setError(userMessageFromError(err, "Send failed"));
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!latest) return;
    setRevoking(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/export-controls/revoke-consultant-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertRequestId: latest._id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(body.error || "Could not withdraw the review");
      if (typeof body.warning === "string" && body.warning.trim()) {
        setWarning(body.warning);
      }
      setSentTo(null);
    } catch (err: unknown) {
      setError(userMessageFromError(err, "Could not withdraw the review"));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-black">Consultant review and sign-off</h2>
          <p className="mt-1 text-xs text-slate-500">
            Have an experienced export controls consultant review this draft pack before submission. They can
            confirm the assessment, request changes, and record their decision through a secure link. No
            documents are sent as email attachments.
          </p>
        </div>
      </div>

      {isComplete ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">
          <p className="font-medium">
            {latest?.status === "completed" ? "Signed off" : "Blocked"} by consultant
          </p>
          {latest?.advisoryNotes && <p className="mt-2 text-green-800">{latest.advisoryNotes}</p>}
          {(latest?.applicationRef || latest?.licenceRef) && (
            <p className="mt-2 text-[11px]">
              {latest.applicationRef && `App: ${latest.applicationRef}`}
              {latest.licenceRef && ` · Licence: ${latest.licenceRef}`}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {/* Fixed height: the status only exists once the query resolves, so the slot is
              reserved to stop the form below shifting down. */}
          <p className="h-4 truncate text-[11px] leading-4 text-slate-500">
            {isOpen && latest?.deliveredAt
              ? `With the consultant since ${formatDate(latest.deliveredAt)}${
                  latest.expiresAt ? ` · expires ${formatDate(latest.expiresAt)}` : ""
                }`
              : ""}
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Review scope
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{CONSULTANT_BIO}</p>
          </div>

          {canCreate && (
            <>
              <div>
                <label htmlFor="consultant-role" className="text-[11px] font-medium text-slate-600">
                  Consultant role <span className="text-red-600">*</span>
                </label>
                <select
                  id="consultant-role"
                  required
                  value={consultantRole}
                  onChange={(event) => setConsultantRole(event.target.value as ConsultantRole | "")}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-slate-400"
                >
                  <option value="">Select a role</option>
                  {CONSULTANT_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={senderNote}
                onChange={(e) => setSenderNote(e.target.value)}
                rows={2}
                placeholder="Optional note for the consultant…"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
              />
            </>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}

          {warning && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {warning}
            </p>
          )}

          {canRetry && !error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The last send did not reach the consultant. The review is saved — try again.
            </p>
          )}

          {sentTo && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="font-medium text-slate-700">Sent to {sentTo}</p>
              <p className="mt-1 text-slate-600">
                It is now in their consultant inbox. They review it here, through a single-use link.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(canCreate || canRetry) && (
              <button
                type="button"
                disabled={sending || (canCreate && !consultantRole)}
                onClick={() => void handleSend()}
                className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {canRetry ? "Send again" : "Request sign-off"}
              </button>
            )}

            {isOpen && latest && (
              <button
                type="button"
                disabled={revoking}
                onClick={() => void handleRevoke()}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Withdraw
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
