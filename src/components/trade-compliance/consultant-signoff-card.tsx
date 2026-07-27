"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const CONSULTANT_BIO = "UK export controls — dual-use classification and licence review.";

interface ConsultantSignoffCardProps {
  assessmentId: Id<"export_assessments">;
  status: string;
  /** send = Draft Pack (form + outcome). result = Overview (outcome only). */
  variant?: "send" | "result";
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

  const [consultantEmail, setConsultantEmail] = useState("");
  const [senderNote, setSenderNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  const latest = dispatchStatus?.latestRequest;
  const isComplete = latest?.status === "completed" || latest?.status === "blocked";

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
      </section>
    );
  }

  const showCard = status !== "clear" || latest;
  if (!showCard) return null;

  const handleSend = async () => {
    const email = consultantEmail.trim();
    if (!email) {
      setError("Consultant email is required");
      return;
    }

    setSending(true);
    setError(null);
    setEmailNote(null);
    setLastUrl(null);

    try {
      const res = await fetch("/api/export-controls/send-to-consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          consultantEmail: email,
          senderNote: senderNote.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Send failed");

      setLastUrl(body.reviewUrl ?? null);
      if (!body.emailSent && body.emailNote) {
        setEmailNote(body.emailNote);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
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
            {dispatchStatus?.activeToken
              ? `Active link sent · expires ${new Date(
                  dispatchStatus.activeToken.expiresAt,
                ).toLocaleDateString("en-GB")}`
              : ""}
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Review scope
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{CONSULTANT_BIO}</p>
          </div>

          <div>
            <label htmlFor="consultant-email" className="text-[11px] font-medium text-slate-600">
              Consultant email <span className="text-red-600">*</span>
            </label>
            <input
              id="consultant-email"
              type="email"
              value={consultantEmail}
              onChange={(e) => setConsultantEmail(e.target.value)}
              placeholder="consultant@example.com"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
            />
          </div>

          <textarea
            value={senderNote}
            onChange={(e) => setSenderNote(e.target.value)}
            rows={2}
            placeholder="Optional note for the consultant…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
          />

          {error && <p className="text-xs text-red-700">{error}</p>}

          {lastUrl && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="font-medium text-slate-700">Review link</p>
              <a href={lastUrl} className="mt-1 break-all text-slate-600 underline" target="_blank" rel="noreferrer">
                {lastUrl}
              </a>
              {emailNote && (
                <p className="mt-2 text-amber-800">Email not sent ({emailNote}). Copy link manually.</p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={sending || !consultantEmail.trim()}
            onClick={() => void handleSend()}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Request sign-off
          </button>
        </div>
      )}
    </section>
  );
}
