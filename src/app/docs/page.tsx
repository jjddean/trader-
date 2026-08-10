import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs | freightcode®",
  description: "freightcode® — UK customs declarations and HMRC CDS documentation.",
  alternates: {
    canonical: "/docs",
  },
};

export default function DocsPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
        Getting Started
      </p>
      <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
        Introduction
      </h1>
      <p className="mb-10 text-[16px] leading-relaxed text-slate-600">
        freightcode® connects directly to HMRC&apos;s Customs Declaration Service (CDS) via official OAuth, letting
        UK importers, customs brokers, and freight forwarders submit WCO-compliant declarations, track clearance
        status in real time, and maintain a full compliance audit trail.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
        What freightcode® does
      </h2>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-[15px] text-slate-700">
        <li>
          <strong>HMRC CDS submissions</strong> — submit H1 import declarations directly to CDS with full WCO
          DEC-DMS:2 compliance.
        </li>
        <li>
          <strong>Real-time notifications</strong> — receive HMRC DMS notifications (DMSACC, DMSCLE, DMSREJ) via
          webhook the moment HMRC responds.
        </li>
        <li>
          <strong>Compliance audit</strong> — every submission, amendment, and HMRC response is logged in an
          immutable audit trail.
        </li>
        <li>
          <strong>Document management</strong> — upload, paste, or generate supporting documents and link them to
          declarations.
        </li>
        <li>
          <strong>Export controls</strong> — classification, sanctions screening, EUSU, and licence draft packs
          alongside CDS.
        </li>
        <li>
          <strong>Financial control</strong> — duty and VAT estimates vs HMRC-confirmed charges on the MRN.
        </li>
      </ul>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">Who it&apos;s for</h2>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-[15px] text-slate-700">
        <li>
          <strong>UK importers</strong> managing their own HMRC CDS filings
        </li>
        <li>
          <strong>Customs brokers</strong> filing on behalf of clients
        </li>
        <li>
          <strong>Freight forwarders</strong> needing real-time clearance visibility
        </li>
      </ul>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">How it works</h2>
      <ul className="mb-6 space-y-4 text-[15px] text-slate-700">
        <li>
          <strong>1. Connect HMRC</strong> — authorise freightcode® via HMRC OAuth. Tokens refresh in session.
        </li>
        <li>
          <strong>2. Create a declaration</strong> — enter EORI, parties, HS codes, and goods details. Mapped to
          WCO XML.
        </li>
        <li>
          <strong>3. Attach documents</strong> — invoices, packing lists, and other supporting documents on the
          declaration.
        </li>
        <li>
          <strong>4. Submit</strong> — send to HMRC CDS. The MRN is stored immediately.
        </li>
        <li>
          <strong>5. Track status</strong> — DMSACC, DMSROG, DMSCLE, and DMSREJ appear on your dashboard.
        </li>
      </ul>

      <div className="mt-12 rounded-2xl bg-[#0f172a] p-8 text-white">
        <h2 className="mb-3 text-[18px] font-semibold">Ready to start?</h2>
        <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
          Follow the Quickstart guide to connect your HMRC account and submit your first declaration.
        </p>
        <Link
          href="/docs/quickstart"
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-100"
        >
          Go to Quickstart →
        </Link>
      </div>
    </article>
  );
}
