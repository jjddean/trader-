import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HS Code Lookup | freightcode® Docs",
  description: "How to use the freightcode® HS Code Lookup to find commodity codes for CDS declarations.",
};

export default function HsCodesPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">Compliance</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        HS Code Lookup
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        Every CDS declaration requires a 10-digit commodity code (DE 6/14). The HS Code Lookup lets you search the UK Trade Tariff by keyword or code to find and verify the correct classification for your goods.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What is an HS code?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        The Harmonized System (HS) is an internationally standardised system for classifying goods. In the UK, commodity codes are 10 digits:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>Digits 1–6</strong> — the HS code (internationally harmonised)</li>
        <li><strong>Digits 7–8</strong> — the Combined Nomenclature (CN) subheading</li>
        <li><strong>Digits 9–10</strong> — the UK-specific tariff subdivision</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Using the wrong commodity code is one of the most common CDS errors — it can result in the wrong duty rate being applied, potential HMRC penalties, and declaration rejection.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Using the lookup</h2>
      <ul className="space-y-3 mb-6 text-[15px] text-slate-700">
        <li><strong>1.</strong> Go to <strong>Compliance → HS Code Lookup</strong> in the sidebar.</li>
        <li><strong>2.</strong> Type a keyword (e.g. &quot;laptop&quot;) or a partial code (e.g. &quot;8471&quot;) into the search box.</li>
        <li><strong>3.</strong> Results are returned from the UK Trade Tariff in real time. Each result shows the full 10-digit code, description, and applicable duty rate.</li>
        <li><strong>4.</strong> Click a result to copy the code or use it directly in a declaration.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Duty rates and trade agreements</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        The duty rate shown is the UK Global Tariff (MFN) rate. If your goods originate from a country with which the UK has a Free Trade Agreement (FTA), a preferential duty rate may apply — but you must provide proof of origin.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Use the <strong>Preference Checker</strong> and <strong>Rules of Origin Simulator</strong> tools (accessible from the Documents page) to verify whether your goods qualify for a preferential rate before declaring.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Using a code in a declaration</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Once you have the correct 10-digit code, enter it in the <strong>Commodity Code</strong> field within a goods item (DE 6/14 in the Goods Items tab). freightcode® validates the format — it must be exactly 10 digits with no spaces or dashes.
      </p>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Ready to declare?</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          With the correct HS code confirmed, head to Declarations to create or update your import declaration.
        </p>
        <Link href="/docs/hmrc/declarations" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
          Declarations →
        </Link>
      </div>
    </article>
  );
}
