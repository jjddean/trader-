"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Download, ExternalLink, Loader2, Send } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  buildDraftPackBundle,
  EVIDENCE_KIND_LABELS,
  type EvidenceKind,
} from "@/lib/export-controls/draft-pack";
import { resolveSubmissionRoute } from "@/lib/export-controls/routing";
import { sanctionsOneLiner } from "@/lib/export-controls/sanctions-summary";

function roleGuidance() {
  return "Export licence application draft pack for your review.";
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ConsultantReviewPage({ token }: { token: string }) {
  const data = useQuery(api.compliance_consultant.getReviewByToken, { token });
  const endUserToken = useQuery(api.compliance_end_user.getLatestEndUserTokenForReview, { reviewToken: token });
  const markOpened = useMutation(api.compliance_consultant.markReviewTokenOpened);
  const completeReview = useMutation(api.compliance_consultant.completeConsultantReview);

  const [advisoryNotes, setAdvisoryNotes] = useState("");
  const [applicationRef, setApplicationRef] = useState("");
  const [licenceRef, setLicenceRef] = useState("");
  const [endUserEmail, setEndUserEmail] = useState("");
  const [endUserNote, setEndUserNote] = useState("");
  const [sendingEndUser, setSendingEndUser] = useState(false);
  const [endUserLink, setEndUserLink] = useState<string | null>(null);
  const [endUserSendNote, setEndUserSendNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data && !data.completedAt) {
      void markOpened({ token });
    }
  }, [data, markOpened, token]);

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading packet…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">This review link is invalid or has expired.</p>
      </div>
    );
  }

  if (data.completedAt || done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-green-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">Review recorded</p>
          <p className="mt-2 text-xs text-slate-500">
            Thank you. Assessment {data.assessment.reference} has been updated. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  const evidence = data.evidence ?? [];

  const bundle = buildDraftPackBundle({
    assessment: data.assessment,
    products: data.products,
    screenings: data.screenings,
    licences: data.licences,
    evidence,
  });

  const routing = resolveSubmissionRoute({
    originJurisdiction: data.assessment.originJurisdiction,
    destinationCountry: data.assessment.destinationCountry,
    approvedControlEntries: data.products.flatMap((p) => {
      const run = p.classificationRuns?.[0];
      if (run && run.requiresReview === false) return [run.finalControlEntry ?? ""];
      return [];
    }),
  });

  const handleSubmit = async (outcome: "cleared" | "blocked") => {
    setSubmitting(true);
    setError(null);
    try {
      await completeReview({
        token,
        advisoryNotes,
        outcome,
        applicationRef: applicationRef.trim() || undefined,
        licenceRef: licenceRef.trim() || undefined,
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEndUser = async () => {
    const email = endUserEmail.trim();
    if (!email) return;
    setSendingEndUser(true);
    setEndUserSendNote(null);
    try {
      const res = await fetch("/api/export-controls/send-to-end-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewToken: token,
          recipientEmail: email,
          senderNote: endUserNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send");
      setEndUserLink(json.formUrl as string);
      if (!json.emailSent && json.emailNote) {
        setEndUserSendNote(`Email not sent (${json.emailNote}). Copy the link below.`);
      }
    } catch (err: unknown) {
      setEndUserSendNote(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSendingEndUser(false);
    }
  };

  const sanctionsLine = sanctionsOneLiner(data.screenings);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Freightcode · Consultant review</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{data.assessment.reference}</h1>
        <p className="mt-1 text-xs text-slate-500">{roleGuidance()}</p>
        {data.senderNote && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium">Note from sender:</span> {data.senderNote}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">GOV.UK</h2>
          <p className="mt-1 text-xs text-slate-500">{routing.headline}</p>
          {routing.route !== "none" && (
            <a
              href={routing.govUkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-900 underline"
            >
              {routing.route === "spire" ? "SPIRE / SIEL guidance" : "Open official GOV.UK SIEL service"}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Draft pack fields</h2>
          <div className="mt-4 space-y-2">
            {bundle.fields.map((field) => (
              <div key={field.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">{field.label}</p>
                  <p className="text-xs text-slate-900">{field.value.trim() || "—"}</p>
                </div>
                <CopyButton value={field.value} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Product evidence</h2>
          <p className="mt-1 text-xs text-slate-500">
            Documents showing what the items are and what they do, for the DBT application.
          </p>
          {evidence.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">None attached by the exporter yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {evidence.map((item) => (
                <li key={item._id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {EVIDENCE_KIND_LABELS[item.kind as EvidenceKind]}
                      {item.fileName ? ` · ${item.fileName}` : ""}
                    </p>
                    {item.note && <p className="mt-1 text-[11px] text-slate-500">{item.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        download={item.fileName ?? undefined}
                        className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Sanctions</h2>
          <p className="mt-2 text-xs text-slate-600">{sanctionsLine}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">End-user and stockist undertaking (EUSU)</h2>
          <p className="mt-1 text-xs text-slate-500">
            {endUserToken?.completedAt
              ? "Completed by the end user. Check the details against the official form before filing."
              : "Send the buyer a link to complete the undertaking for the SIEL / SITCL application."}{" "}
            <a
              href="https://www.gov.uk/government/publications/end-user-undertaking-euu-form"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700"
            >
              Official EUSU form on GOV.UK
            </a>
          </p>
          {endUserToken?.completedAt ? (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              EUSU submitted.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="eu-email" className="text-[11px] font-medium text-slate-600">
                  Buyer email
                </label>
                <input
                  id="eu-email"
                  type="email"
                  value={endUserEmail}
                  onChange={(e) => setEndUserEmail(e.target.value)}
                  placeholder="buyer@example.com"
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
                />
              </div>
              <div>
                <label htmlFor="eu-note" className="text-[11px] font-medium text-slate-600">
                  Note (optional)
                </label>
                <input
                  id="eu-note"
                  value={endUserNote}
                  onChange={(e) => setEndUserNote(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
                />
              </div>
              <button
                type="button"
                disabled={sendingEndUser || !endUserEmail.trim()}
                onClick={() => void handleSendEndUser()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {sendingEndUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send to end user
              </button>
              {endUserSendNote && (
                <p className="text-xs text-slate-600">{endUserSendNote}</p>
              )}
              {(endUserLink || (endUserToken && !endUserToken.completedAt)) && (
                <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                    {endUserLink ?? `…/r/end-user/${endUserToken?.token}`}
                  </p>
                  <CopyButton value={endUserLink ?? `${window.location.origin}/r/end-user/${endUserToken?.token}`} />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Your review</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="advisory-notes" className="text-[11px] font-medium text-slate-600">
                Advisory notes <span className="text-red-600">*</span>
              </label>
              <textarea
                id="advisory-notes"
                value={advisoryNotes}
                onChange={(e) => setAdvisoryNotes(e.target.value)}
                rows={4}
                placeholder="Legislative assessment, licence validation, or reason to block…"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="app-ref" className="text-[11px] font-medium text-slate-600">
                  Application reference (if submitted)
                </label>
                <input
                  id="app-ref"
                  value={applicationRef}
                  onChange={(e) => setApplicationRef(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
                />
              </div>
              <div>
                <label htmlFor="licence-ref" className="text-[11px] font-medium text-slate-600">
                  Licence number (when issued)
                </label>
                <input
                  id="licence-ref"
                  value={licenceRef}
                  onChange={(e) => setLicenceRef(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
                />
              </div>
            </div>
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting || !advisoryNotes.trim()}
                onClick={() => void handleSubmit("cleared")}
                className="h-9 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Sign off (clear)
              </button>
              <button
                type="button"
                disabled={submitting || !advisoryNotes.trim()}
                onClick={() => void handleSubmit("blocked")}
                className="h-9 rounded-md border border-red-200 bg-red-50 px-4 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                Block shipment
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
