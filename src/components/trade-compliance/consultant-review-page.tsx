"use client";

import { useEffect, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { Check, Copy, Download, ExternalLink, Loader2, Send } from "lucide-react";
import type { api } from "../../../convex/_generated/api";
import {
  buildDraftPackBundle,
  EVIDENCE_KIND_LABELS,
  type EvidenceKind,
} from "@/lib/export-controls/draft-pack";
import { resolveSubmissionRoute } from "@/lib/export-controls/routing";
import { sanctionsOneLiner } from "@/lib/export-controls/sanctions-summary";
import { ApiError, userMessageFromError } from "@/lib/convex-errors";

function roleGuidance(role: "adviser" | "applies_on_behalf" | "eor") {
  if (role === "adviser") {
    return "Advisory review only. The exporter remains responsible for the application and export decision.";
  }
  if (role === "eor") {
    return "Review as exporter of record. Confirm your authority and the evidence before signing off.";
  }
  return "Review and prepare the export licence application on the exporter's behalf.";
}

type ReviewQueryData = NonNullable<
  FunctionReturnType<typeof api.compliance_consultant.getReviewByToken>
>;
type ReviewData = ReviewQueryData & {
  endUserToken?: {
    _id: string;
    completedAt?: number;
    statement?: {
      endUserName?: string;
      endUserAddress?: string;
      endUserCountry?: string;
      contactName?: string;
      contactEmail?: string;
      intendedUse?: string;
      signedBy?: string;
      signedAt?: number;
    } | null;
  } | null;
};

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

export function ConsultantReviewPage() {
  const [data, setData] = useState<ReviewData | null | undefined>(undefined);
  const [advisoryNotes, setAdvisoryNotes] = useState("");
  const [applicationRef, setApplicationRef] = useState("");
  const [licenceRef, setLicenceRef] = useState("");
  const [endUserEmail, setEndUserEmail] = useState("");
  const [endUserNote, setEndUserNote] = useState("");
  const [sendingEndUser, setSendingEndUser] = useState(false);
  const [endUserSentTo, setEndUserSentTo] = useState<string | null>(null);
  const [endUserSendNote, setEndUserSendNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [acknowledgedEndUserTokenId, setAcknowledgedEndUserTokenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let initialRequest = true;

    const loadReview = async () => {
      const isInitialRequest = initialRequest;
      initialRequest = false;
      try {
        const response = await fetch("/api/export-controls/consultant-review", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isInitialRequest) setData(null);
          return;
        }
        const review = (await response.json()) as ReviewData;
        setData(review);
        if (isInitialRequest && !review.completedAt) {
          await fetch("/api/export-controls/consultant-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ action: "opened" }),
            signal: controller.signal,
          });
        }
      } catch (loadError: unknown) {
        if (
          isInitialRequest &&
          !(loadError instanceof DOMException && loadError.name === "AbortError")
        ) {
          setData(null);
        }
      }
    };

    void loadReview();
    const intervalId = window.setInterval(() => void loadReview(), 10_000);
    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, []);

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
  const endUserToken = data.endUserToken;
  const submittedEndUserTokenId = endUserToken?.completedAt ? String(endUserToken._id) : null;
  const endUserStatement = endUserToken?.statement;
  const endUserStatementAcknowledged =
    !submittedEndUserTokenId || acknowledgedEndUserTokenId === submittedEndUserTokenId;

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
      const response = await fetch("/api/export-controls/consultant-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "complete",
          advisoryNotes,
          outcome,
          applicationRef: applicationRef.trim() || undefined,
          licenceRef: licenceRef.trim() || undefined,
          acknowledgedEndUserTokenId: submittedEndUserTokenId
            ? acknowledgedEndUserTokenId
            : undefined,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new ApiError(result.error || "Failed to save review");
      setDone(true);
    } catch (err: unknown) {
      setError(userMessageFromError(err, "Failed to save review"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEndUser = async () => {
    const email = endUserEmail.trim();
    if (!email) return;
    setSendingEndUser(true);
    setEndUserSendNote(null);
    setEndUserSentTo(null);
    try {
      const res = await fetch("/api/export-controls/send-to-end-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: email,
          senderNote: endUserNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new ApiError(json.error || "Failed to send");
      setEndUserSentTo(json.recipientEmail ?? email);
    } catch (err: unknown) {
      setEndUserSendNote(userMessageFromError(err, "Failed to send"));
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
        <p className="mt-1 text-xs text-slate-500">{roleGuidance(data.consultantRole)}</p>
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
            <div className="mt-3 space-y-3 rounded-md border border-green-200 bg-green-50 px-3 py-3 text-xs text-green-900">
              <p className="font-medium">EUSU submitted.</p>
              {endUserStatement && (
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-medium text-green-700 uppercase">End user</dt>
                    <dd>{endUserStatement.endUserName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium text-green-700 uppercase">Country</dt>
                    <dd>{endUserStatement.endUserCountry || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-medium text-green-700 uppercase">Address</dt>
                    <dd className="whitespace-pre-wrap">{endUserStatement.endUserAddress || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium text-green-700 uppercase">Contact</dt>
                    <dd>{endUserStatement.contactName || "—"}</dd>
                    {endUserStatement.contactEmail && <dd>{endUserStatement.contactEmail}</dd>}
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium text-green-700 uppercase">Signed by</dt>
                    <dd>{endUserStatement.signedBy || "—"}</dd>
                    {endUserStatement.signedAt && (
                      <dd>{new Date(endUserStatement.signedAt).toLocaleString("en-GB")}</dd>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-medium text-green-700 uppercase">Intended use</dt>
                    <dd className="whitespace-pre-wrap">{endUserStatement.intendedUse || "—"}</dd>
                  </div>
                </dl>
              )}
              <label className="flex items-start gap-2 border-t border-green-200 pt-3">
                <input
                  type="checkbox"
                  checked={acknowledgedEndUserTokenId === submittedEndUserTokenId}
                  onChange={(event) =>
                    setAcknowledgedEndUserTokenId(
                      event.target.checked ? submittedEndUserTokenId : null,
                    )
                  }
                  className="mt-0.5"
                />
                <span>I have reviewed and acknowledge this exact submitted EUSU.</span>
              </label>
            </div>
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
              {endUserSentTo && (
                <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  One-time access link sent to {endUserSentTo}.
                </p>
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
                disabled={submitting || !advisoryNotes.trim() || !endUserStatementAcknowledged}
                onClick={() => void handleSubmit("cleared")}
                className="h-9 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Sign off (clear)
              </button>
              <button
                type="button"
                disabled={submitting || !advisoryNotes.trim() || !endUserStatementAcknowledged}
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
