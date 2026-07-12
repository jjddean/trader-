"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface EndUserSendCardProps {
  assessmentId: Id<"export_assessments">;
  /** send = Draft Pack form. result = Overview completed state only. */
  variant?: "send" | "result";
}

export function EndUserSendCard({ assessmentId, variant = "send" }: EndUserSendCardProps) {
  const { isAuthenticated } = useConvexAuth();

  const status = useQuery(
    api.compliance_end_user.getEndUserDispatchStatus,
    isAuthenticated ? { assessmentId } : "skip",
  );

  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderNote, setSenderNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  const statement = status?.statement as
    | { endUserName?: string; signedBy?: string; signedAt?: number }
    | null
    | undefined;
  const isComplete = Boolean(statement) || Boolean(status?.latestToken?.completedAt);

  if (variant === "result") {
    if (!isComplete) return null;
    return (
      <section className="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 className="text-sm font-semibold text-green-900">End-user statement</h2>
        <p className="mt-2 text-xs font-medium text-green-900">
          Completed{statement?.endUserName ? ` — ${statement.endUserName}` : ""}
          {statement?.signedBy ? ` · signed by ${statement.signedBy}` : ""}
        </p>
        {statement?.signedAt && (
          <p className="mt-1 text-[11px] text-green-800">
            {new Date(statement.signedAt).toLocaleString("en-GB")}
          </p>
        )}
      </section>
    );
  }

  const handleSend = async () => {
    const email = recipientEmail.trim();
    if (!email) {
      setError("End-user email is required");
      return;
    }

    setSending(true);
    setError(null);
    setEmailNote(null);
    setLastUrl(null);

    try {
      const res = await fetch("/api/export-controls/send-to-end-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          recipientEmail: email,
          senderNote: senderNote.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Send failed");

      setLastUrl(body.formUrl ?? null);
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
          <h2 className="text-sm font-semibold text-black">End-user statement</h2>
          <p className="mt-1 text-xs text-slate-500">
            Send a secure link to the buyer / end user to complete the statement for LITE supporting docs.
          </p>
        </div>
      </div>

      {isComplete ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">
          <p className="font-medium">
            Statement completed{statement?.endUserName ? ` — ${statement.endUserName}` : ""}
          </p>
          {statement?.signedBy && (
            <p className="mt-1 text-[11px]">Signed by {statement.signedBy}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {status?.activeToken && (
            <p className="text-[11px] text-slate-500">
              Active link sent to {status.activeToken.recipientEmail} · expires{" "}
              {new Date(status.activeToken.expiresAt).toLocaleDateString("en-GB")}
            </p>
          )}

          <div>
            <label htmlFor="end-user-email" className="text-[11px] font-medium text-slate-600">
              End-user email <span className="text-red-600">*</span>
            </label>
            <input
              id="end-user-email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="buyer@example.com"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
            />
          </div>

          <textarea
            value={senderNote}
            onChange={(e) => setSenderNote(e.target.value)}
            rows={2}
            placeholder="Optional note for the end user…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
          />

          {error && <p className="text-xs text-red-700">{error}</p>}

          {lastUrl && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="font-medium text-slate-700">Form link</p>
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
            disabled={sending || !recipientEmail.trim()}
            onClick={() => void handleSend()}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send to end user
          </button>
        </div>
      )}
    </section>
  );
}
