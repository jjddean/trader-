import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources | freightcode®",
  description:
    "Guides, tools, and integration documentation to help you manage UK customs compliance efficiently.",
  alternates: {
    canonical: "/resources",
  },
};

export default function ResourcesPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">Library</p>
      <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">Technical Resources</h1>
      <p className="mb-10 text-[16px] leading-relaxed text-slate-600">
        Guides, tools, and integration documentation to help you manage UK customs compliance efficiently.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">Pre-clearance estimates</h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        Estimate duty, VAT, and landed cost from Trade Tariff data before you file. Model PVA cashflow and check commodity codes — the same calculations used in your declaration workspace. HMRC-confirmed amounts always override on acceptance.
      </p>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        <Link href="/tools" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
          Duty &amp; VAT estimates →
        </Link>
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">HS code lookup</h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        Search the UK Trade Tariff for commodity codes, duty measures, and product descriptions before submission.
      </p>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        <Link href="/hs-code-lookup" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
          HS Code Lookup →
        </Link>
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">Compliance Directives</h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        Access our structured documentation on CDS framework migration, TRE extraction parsing, and regulatory adherence.
      </p>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        <Link
          href="/guides/hmrc-cds-complete-guide-uk-importers-2026"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Read the HMRC CDS guide →
        </Link>
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">Developer API</h2>
      <p className="mb-4 text-[15px] leading-relaxed text-slate-700">
        Secure REST endpoints to integrate CDS reporting pipelines and bi-directional data synchronization directly into your existing ERP.
      </p>
      <p className="text-[13px] font-semibold uppercase tracking-widest text-slate-400">Coming Q4</p>
    </article>
  );
}
