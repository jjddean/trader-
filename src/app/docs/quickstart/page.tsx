import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Quickstart | freightcode® Docs",
  description: "Get up and running with freightcode® — connect HMRC and submit your first declaration.",
};

export default function QuickstartPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">Getting Started</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        Quickstart
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        From account creation to your first submitted declaration in five steps.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Step 1 — Sign in</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Go to <strong>freightcode.co.uk</strong> and click <strong>Gain Access</strong>. Join the waitlist or sign in with your existing account. Once approved, you&apos;ll land on your Dashboard.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Step 2 — Connect HMRC</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        From the Dashboard, click <strong>Connect HMRC</strong>. You&apos;ll be redirected to HMRC&apos;s OAuth login page. Sign in with your Government Gateway credentials and authorise freightcode® to act on your behalf.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Once authorised, the button turns green showing <strong>HMRC Connected</strong> with the token expiry date. freightcode® refreshes your token automatically before it expires.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Step 3 — Create a declaration</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        Go to <strong>Declarations</strong> in the sidebar and click <strong>New Declaration</strong>. Fill in:
      </p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-[15px] text-slate-700">
        <li><strong>Origin Country</strong> — the country the goods are from</li>
        <li><strong>HS Code</strong> — the 10-digit commodity code (optional at creation)</li>
        <li><strong>Description</strong> — a short description of the goods</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Click <strong>Create Declaration</strong>. You&apos;ll be taken straight to the Goods Items tab to complete the declaration details.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Step 4 — Complete the declaration</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">The declaration workspace has five tabs:</p>
      <ul className="space-y-3 mb-6 text-[15px] text-slate-700">
        <li><strong>Core Schema</strong> — your EORI number, declaration type (H1), customs routing, and dispatch country.</li>
        <li><strong>Goods Items</strong> — commodity code, procedure code (e.g. 4000), additional procedure code (e.g. 000), origin country, gross and net weight, and supporting document codes.</li>
        <li><strong>Submission</strong> — review and submit to HMRC CDS.</li>
        <li><strong>HMRC Status</strong> — live notifications from HMRC (DMSACC, DMSROG, DMSCLE, DMSREJ).</li>
        <li><strong>Documents</strong> — supporting documents linked to this declaration.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Step 5 — Submit</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        Go to the <strong>Submission</strong> tab and click <strong>Submit to HMRC</strong>. freightcode® will:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Validate all required CDS fields</li>
        <li>Map your data to WCO DEC-DMS:2 XML</li>
        <li>POST to HMRC CDS</li>
        <li>Store the MRN and X-Conversation-ID for notification tracking</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        A successful submission returns <strong>202 Accepted</strong> and moves the declaration to <strong>Processing</strong> status. HMRC notifications (DMSACC → DMSROG → DMSCLE) will appear in the HMRC Status tab as they arrive.
      </p>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Next steps</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          Learn how to connect your HMRC account in detail, add goods items, and attach supporting documents.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/docs/hmrc/connect" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
            Connect HMRC →
          </Link>
          <Link href="/docs/hmrc/declarations" className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-600 transition-colors">
            Declarations →
          </Link>
        </div>
      </div>
    </article>
  );
}
