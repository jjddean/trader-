"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, Printer } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { openEndUserStatementPrintDialog } from "@/lib/export-controls/end-user-statement";

export function EndUserStatementPage({ token }: { token: string }) {
  const data = useQuery(api.compliance_end_user.getEndUserFormByToken, { token });
  const markOpened = useMutation(api.compliance_end_user.markEndUserTokenOpened);
  const submit = useMutation(api.compliance_end_user.submitEndUserStatement);

  const [endUserName, setEndUserName] = useState("");
  const [endUserAddress, setEndUserAddress] = useState("");
  const [endUserCountry, setEndUserCountry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [noProhibitedEndUse, setNoProhibitedEndUse] = useState(false);
  const [noDiversion, setNoDiversion] = useState(false);
  const [signedBy, setSignedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!data || data.completedAt) return;
    void markOpened({ token });
  }, [data, markOpened, token]);

  useEffect(() => {
    if (!data?.assessment) return;
    const eu = data.assessment.endUser as { name?: string; address?: string; country?: string } | undefined;
    if (eu?.name && !endUserName) setEndUserName(eu.name);
    if (eu?.address && !endUserAddress) setEndUserAddress(eu.address);
    if (eu?.country && !endUserCountry) setEndUserCountry(eu.country);
    if (data.assessment.intendedUse && !intendedUse) setIntendedUse(data.assessment.intendedUse);
    if (data.recipientEmail && !contactEmail) setContactEmail(data.recipientEmail);
  }, [data, contactEmail, endUserAddress, endUserCountry, endUserName, intendedUse]);

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading form…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">This link is invalid or has expired.</p>
      </div>
    );
  }

  const statement = data.assessment.endUserStatement as {
    signedBy: string;
    signedAt: number;
    endUserName: string;
    endUserAddress: string;
    endUserCountry: string;
    contactName: string;
    contactEmail?: string;
    intendedUse: string;
  } | undefined;

  if (data.completedAt || done) {
    const signedAt = statement?.signedAt ?? Date.now();
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-green-200 bg-white p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-green-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Statement submitted</p>
          <p className="mt-2 text-xs text-slate-500">
            Thank you. Assessment {data.assessment.reference} has been updated.
          </p>
          {statement && (
            <button
              type="button"
              onClick={() =>
                openEndUserStatementPrintDialog({
                  assessmentReference: data.assessment.reference,
                  destinationCountry: data.assessment.destinationCountry,
                  products: data.products,
                  endUserName: statement.endUserName,
                  endUserAddress: statement.endUserAddress,
                  endUserCountry: statement.endUserCountry,
                  contactName: statement.contactName,
                  contactEmail: statement.contactEmail,
                  intendedUse: statement.intendedUse,
                  signedBy: statement.signedBy,
                  signedAt,
                })
              }
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print PDF
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submit({
        token,
        endUserName,
        endUserAddress,
        endUserCountry,
        contactName,
        contactEmail: contactEmail.trim() || undefined,
        intendedUse,
        noProhibitedEndUse,
        noDiversion,
        signedBy,
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Freightcode · End-user statement</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{data.assessment.reference}</h1>
        <p className="mt-1 text-xs text-slate-500">
          Complete this form for export compliance. Destination: {data.assessment.destinationCountry ?? "—"}
        </p>
        {data.senderNote && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium">Note:</span> {data.senderNote}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-xl p-6">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <label htmlFor="eu-name" className="text-[11px] font-medium text-slate-600">
              End-user organisation <span className="text-red-600">*</span>
            </label>
            <input
              id="eu-name"
              required
              value={endUserName}
              onChange={(e) => setEndUserName(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
            />
          </div>
          <div>
            <label htmlFor="eu-address" className="text-[11px] font-medium text-slate-600">
              Address
            </label>
            <textarea
              id="eu-address"
              value={endUserAddress}
              onChange={(e) => setEndUserAddress(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label htmlFor="eu-country" className="text-[11px] font-medium text-slate-600">
              Country
            </label>
            <input
              id="eu-country"
              value={endUserCountry}
              onChange={(e) => setEndUserCountry(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="text-[11px] font-medium text-slate-600">
                Contact name <span className="text-red-600">*</span>
              </label>
              <input
                id="contact-name"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="text-[11px] font-medium text-slate-600">
                Contact email
              </label>
              <input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
              />
            </div>
          </div>
          <div>
            <label htmlFor="intended-use" className="text-[11px] font-medium text-slate-600">
              Intended end use <span className="text-red-600">*</span>
            </label>
            <textarea
              id="intended-use"
              required
              value={intendedUse}
              onChange={(e) => setIntendedUse(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={noProhibitedEndUse}
                onChange={(e) => setNoProhibitedEndUse(e.target.checked)}
                className="mt-0.5"
              />
              <span>Goods will not be used for prohibited end uses (including WMD or means of delivery).</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={noDiversion}
                onChange={(e) => setNoDiversion(e.target.checked)}
                className="mt-0.5"
              />
              <span>Goods will not be re-exported or diverted without prior written consent and required licences.</span>
            </label>
          </div>
          <div>
            <label htmlFor="signed-by" className="text-[11px] font-medium text-slate-600">
              Signed by (full name) <span className="text-red-600">*</span>
            </label>
            <input
              id="signed-by"
              required
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
            />
          </div>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !noProhibitedEndUse || !noDiversion}
            className="h-9 w-full rounded-md bg-black text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit statement"}
          </button>
        </form>
      </main>
    </div>
  );
}
