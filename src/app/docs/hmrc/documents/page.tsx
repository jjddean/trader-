import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Supporting Documents | freightcode® Docs",
  description: "Uploading, pasting, and managing supporting documents for CDS declarations in freightcode®.",
};

export default function DocumentsPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">HMRC CDS</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        Supporting Documents
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        CDS declarations require supporting documents to prove origin, value, and regulatory compliance. freightcode® lets you upload files, paste document text, generate templates, and link documents directly to declarations.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Accessing Documents</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Go to <strong>Documents</strong> in the sidebar. You can also access documents for a specific declaration from the <strong>Documents</strong> tab within the declaration workspace.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Adding documents</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">There are three ways to add a document:</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li>
          <strong>Upload a file</strong> — click <strong>Upload Document</strong> and select a PDF, image, or other file. Assign a document type and optionally link it to a declaration. Files are stored securely via HMRC&apos;s Secure Document Environment.
        </li>
        <li>
          <strong>Paste text</strong> — click <strong>Paste Document</strong> to paste the raw text of a commercial invoice, packing list, or similar. Select the document type and link it to a declaration.
        </li>
        <li>
          <strong>Generate a template</strong> — freightcode® can generate blank document templates for a declaration based on the CDS document codes already entered in Goods Items.
        </li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Document types</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        freightcode® recognises the following CDS document codes (DE 2/3):
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-[14px] text-slate-700 border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-900 text-[13px]">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-900 text-[13px]">Document</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr><td className="px-4 py-3 font-mono text-[13px]">C88</td><td className="px-4 py-3">Import Entry / SAD</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">E2</td><td className="px-4 py-3">Commercial Invoice</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">N271</td><td className="px-4 py-3">Packing List</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">N853</td><td className="px-4 py-3">Veterinary / Health Certificate</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">Y929</td><td className="px-4 py-3">Proof of Origin (Supplier Declaration)</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">Y930</td><td className="px-4 py-3">Preference Evidence (EUR.1 / REX)</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">9WK</td><td className="px-4 py-3">Air Waybill</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[13px]">N703</td><td className="px-4 py-3">Bill of Lading</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Linking documents to declarations</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        When uploading or pasting, select a declaration from the dropdown to link the document. Linked documents appear in the declaration&apos;s <strong>Documents</strong> tab. You can filter the Documents page by declaration or by document type using the filter controls.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Compliance tools</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        The Documents page also gives access to built-in compliance tools:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>Preference Checker</strong> — verify whether goods qualify for a preferential duty rate under a UK trade agreement.</li>
        <li><strong>Rules of Origin Simulator</strong> — check whether goods meet origin criteria for preferential treatment.</li>
        <li><strong>Landed Cost Calculator</strong> — calculate the total landed cost including duty, VAT, and freight.</li>
      </ul>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Compliance audit</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          Use the Compliance Audit tool to validate commercial invoices and other documents against CDS requirements before submitting.
        </p>
        <Link href="/docs/compliance/audit" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
          Compliance Audit →
        </Link>
      </div>
    </article>
  );
}
