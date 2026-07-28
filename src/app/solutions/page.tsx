import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Solutions | freightcode®",
  description:
    "UK customs declarations through HMRC CDS, export controls, and customs financial control — in one workspace.",
  alternates: {
    canonical: "/solutions",
  },
};

const capabilities: Array<{
  id: string;
  label: string;
  benefit: string;
  how: string;
  href?: string;
}> = [
  {
    id: "cds",
    label: "Customs declarations (CDS)",
    benefit:
      "Build, dry-run, and submit UK import declarations to HMRC CDS with documents, notifications, and an audit trail.",
    how: "WCO-compliant filing in one workspace — you review every line before submit.",
  },
  {
    id: "financial-control",
    label: "Financial control",
    benefit:
      "Pre-clearance duty and VAT calculated from Trade Tariff data, HMRC-confirmed charges on the MRN, Financial Records ledger, and variance review.",
    how: "Customs finance alongside CDS — estimates stay separate from HMRC-confirmed amounts.",
    href: "/solutions/financial-control",
  },
  {
    id: "tre",
    label: "TRE trade data",
    benefit:
      "Import HMRC Trade Reporting CSVs to browse past declaration lines and surface duty or preference review hints.",
    how: "Historical lines stay in your org workspace for adviser review — Freightcode does not file C285 reclaims.",
  },
  {
    id: "export-controls",
    label: "UK export controls",
    benefit:
      "Assessments for strategic and dual-use exports: AI-assisted classification (human approve), UK sanctions screening, EUSU, licence draft packs, consultancy support.",
    how: "One case alongside CDS declarations. Filing stays on GOV.UK (LITE or SPIRE).",
    href: "/solutions/export-controls",
  },
];

export default function SolutionsPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
        Platform
      </p>
      <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
        Solutions
      </h1>
      <p className="mb-10 text-[16px] leading-relaxed text-slate-600">
        UK customs declarations through HMRC CDS, with export controls and customs financial control in the same
        workspace.
      </p>

      {capabilities.map((item) => (
        <div key={item.id} id={item.id} className="scroll-mt-24">
          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
            {item.label}
          </h2>
          <p className="mb-4 text-[15px] leading-relaxed text-slate-700">
            <strong>{item.benefit}</strong> {item.how}
          </p>
          {item.href && (
            <p className="mb-6">
              <Link
                href={item.href}
                className="text-[14px] font-semibold text-blue-600 hover:text-blue-700"
              >
                Read the full product page →
              </Link>
            </p>
          )}
        </div>
      ))}
    </article>
  );
}
