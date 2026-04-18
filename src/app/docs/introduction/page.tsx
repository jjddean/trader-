import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Introduction | freightcode® Docs",
  description: "freightcode® — UK customs declarations and HMRC CDS compliance platform.",
};

export default function IntroductionPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">Getting Started</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        Introduction
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        freightcode® connects directly to HMRC&apos;s Customs Declaration Service (CDS) via official OAuth, letting UK importers, customs brokers, and freight forwarders submit WCO-compliant declarations, track clearance status in real time, and maintain a full compliance audit trail.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What freightcode® does</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>HMRC CDS submissions</strong> — submit H1 import declarations directly to CDS with full WCO DEC-DMS:2 compliance.</li>
        <li><strong>Real-time notifications</strong> — receive HMRC DMS notifications (DMSACC, DMSCLE, DMSREJ) via webhook the moment HMRC responds.</li>
        <li><strong>Compliance audit</strong> — every submission, amendment, and HMRC response is logged in an immutable audit trail.</li>
        <li><strong>Document management</strong> — upload, paste, or generate supporting documents (C88, E2, commercial invoices) and link them to declarations.</li>
        <li><strong>HS code lookup</strong> — search commodity codes and verify tariff requirements before submitting.</li>
        <li><strong>Compliance tools</strong> — preference checker, rules of origin simulator, and landed cost calculator built in.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Who it&apos;s for</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>UK importers</strong> managing their own HMRC CDS filings</li>
        <li><strong>Customs brokers</strong> filing on behalf of clients</li>
        <li><strong>Freight forwarders</strong> needing real-time clearance visibility</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How it works</h2>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>1. Connect HMRC</strong> — authorise freightcode® to act on your behalf via HMRC OAuth. Your access token is stored securely and refreshed automatically.</li>
        <li><strong>2. Create a declaration</strong> — enter your EORI, dispatch country, HS code, and goods details. freightcode® maps everything to WCO XML.</li>
        <li><strong>3. Attach documents</strong> — upload or paste supporting documents (C88, commercial invoice, packing list). The system validates document codes against CDS requirements.</li>
        <li><strong>4. Submit</strong> — one click sends the declaration to HMRC CDS. The MRN is stored immediately.</li>
        <li><strong>5. Track status</strong> — DMSACC, DMSROG, DMSCLE, and DMSREJ notifications appear on your dashboard in real time.</li>
      </ul>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Ready to start?</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          Follow the Quickstart guide to connect your HMRC account and submit your first declaration.
        </p>
        <Link
          href="/docs/quickstart"
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
        >
          Go to Quickstart →
        </Link>
      </div>
    </article>
  );
}
