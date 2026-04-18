import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Declarations | freightcode® Docs",
  description: "Creating, completing, and submitting CDS import declarations in freightcode®.",
};

export default function DeclarationsPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">HMRC CDS</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        Declarations
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        A declaration is the central record in freightcode®. It maps to a single HMRC CDS H1 import declaration — from draft through to clearance.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Declaration types</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        freightcode® currently supports <strong>H1</strong> — the standard frontier import declaration for goods released into free circulation in the UK (Customs Procedure Code 40 00).
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Creating a declaration</h2>
      <ul className="space-y-3 mb-6 text-[15px] text-slate-700">
        <li><strong>1.</strong> Go to <strong>Declarations</strong> in the sidebar.</li>
        <li><strong>2.</strong> Click <strong>New Declaration</strong>.</li>
        <li><strong>3.</strong> Select the <strong>Origin Country</strong>, optionally enter an HS code and description, then click <strong>Create Declaration</strong>.</li>
        <li><strong>4.</strong> You are taken directly to the <strong>Goods Items</strong> tab with the first row pre-filled.</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Only Draft declarations can be deleted. Once submitted, a declaration is permanent.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Core Schema (Tab 1)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">The Core Schema tab captures the top-level declaration fields:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>Declarant EORI</strong> (required) — your GB EORI number, e.g. GB123456789000. Must match your HMRC Developer Hub credentials.</li>
        <li><strong>Declaration Category</strong> — H1 (Release for Free Circulation). Currently the only supported type.</li>
        <li><strong>Customs Routing</strong> — Route 1 (Documentary Check), Route 2 (Physical Exam), or Route 6 (Direct Clearance).</li>
        <li><strong>Dispatch Country (DE 5/14)</strong> (required) — the country the goods were shipped from. Must never be GB for a third-country import.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Goods Items (Tab 2)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">Each declaration requires at least one goods item. Fields required per item:</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-[14px] text-slate-700 border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-900 text-[13px]">Field</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900 text-[13px]">CDS Data Element</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900 text-[13px]">Example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr><td className="px-4 py-3">Commodity code</td><td className="px-4 py-3 font-mono text-[13px]">DE 6/14</td><td className="px-4 py-3">0207129000</td></tr>
            <tr><td className="px-4 py-3">Procedure code</td><td className="px-4 py-3 font-mono text-[13px]">DE 1/10</td><td className="px-4 py-3">4000</td></tr>
            <tr><td className="px-4 py-3">Additional procedure</td><td className="px-4 py-3 font-mono text-[13px]">DE 1/11</td><td className="px-4 py-3">000</td></tr>
            <tr><td className="px-4 py-3">Origin country</td><td className="px-4 py-3 font-mono text-[13px]">DE 5/16</td><td className="px-4 py-3">BR</td></tr>
            <tr><td className="px-4 py-3">Gross weight (KG)</td><td className="px-4 py-3 font-mono text-[13px]">DE 6/5</td><td className="px-4 py-3">25.5</td></tr>
            <tr><td className="px-4 py-3">Net weight (KG)</td><td className="px-4 py-3 font-mono text-[13px]">DE 6/1</td><td className="px-4 py-3">22.0</td></tr>
            <tr><td className="px-4 py-3">Supporting documents</td><td className="px-4 py-3 font-mono text-[13px]">DE 2/3</td><td className="px-4 py-3">N853, Y930</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Submission (Tab 3)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        Click <strong>Submit to HMRC</strong>. freightcode® will:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Run a preflight validation against all required CDS fields</li>
        <li>Map your data to a WCO DEC-DMS:2 compliant XML payload</li>
        <li>POST the XML to HMRC CDS via the official API</li>
        <li>Store the MRN and X-Conversation-ID returned by HMRC</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        A <strong>202 Accepted</strong> response from HMRC moves the declaration to <strong>Processing</strong>. If validation fails, errors are shown inline — fix them and resubmit.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">HMRC Status (Tab 4)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        All HMRC notifications for this declaration appear here in real time:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>DMSACC</strong> — declaration accepted by CDS</li>
        <li><strong>DMSROG</strong> — goods registered; may be examined by Border Force</li>
        <li><strong>DMSCLE</strong> — goods cleared; shipment can be released</li>
        <li><strong>DMSREJ</strong> — declaration rejected; error detail shown inline</li>
        <li><strong>DMSCTL</strong> — goods selected for physical examination</li>
      </ul>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Supporting documents</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          Learn how to upload, paste, and link supporting documents to your declarations.
        </p>
        <Link href="/docs/hmrc/documents" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
          Supporting Documents →
        </Link>
      </div>
    </article>
  );
}
