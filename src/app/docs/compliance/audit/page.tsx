import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compliance Audit | freightcode® Docs",
  description: "Using the freightcode® Compliance Audit tool to validate customs documents.",
};

export default function ComplianceAuditPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">Compliance</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        Compliance Audit
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        The Compliance Audit tool analyses customs documents — commercial invoices, packing lists, and certificates — against CDS requirements and flags errors before they reach HMRC.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Accessing the audit tool</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Go to <strong>Compliance → Audit</strong> in the sidebar. The tool is available to all signed-in users.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Running an audit</h2>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li>
          <strong>Manual (paste text)</strong> — paste the raw text of your document into the text area. Select the document type (e.g. Commercial Invoice, Bill of Lading) and click <strong>Run Audit</strong>.
        </li>
        <li>
          <strong>Upload a file</strong> — switch to the Upload tab, drag and drop a PDF or image, and freightcode® will extract the text via OCR before running the audit.
        </li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What the audit checks</h2>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Required fields present (shipper, consignee, description, value, HS code, Incoterms)</li>
        <li>HS code format validity (must be 6–10 digits)</li>
        <li>Customs value completeness — is freight and insurance captured?</li>
        <li>Origin country stated and consistent with preference claims</li>
        <li>Document type matches content (e.g. a packing list should not be audited as an invoice)</li>
        <li>Any missing fields that CDS will reject at submission</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Reading the results</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        After the audit completes, results are shown in two sections:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>Extracted fields</strong> — the values the system read from your document. Review these to confirm the extraction was accurate.</li>
        <li><strong>Compliance findings</strong> — a list of issues, warnings, and confirmations. Each finding includes a plain-English explanation of what is wrong and how to fix it.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Linking audit results to a declaration</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        After running an audit, you can save the document directly to freightcode® and link it to an existing declaration. Select the declaration from the dropdown that appears in the upload step, and the document will appear in that declaration&apos;s Documents tab.
      </p>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">HS Code Lookup</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          Not sure of the right commodity code? Use the HS Code Lookup tool to find and verify the correct 10-digit code before running your audit.
        </p>
        <Link href="/docs/compliance/hs-codes" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
          HS Code Lookup →
        </Link>
      </div>
    </article>
  );
}
