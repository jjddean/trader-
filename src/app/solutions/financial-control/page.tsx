import { Metadata } from "next";
import Link from "next/link";
import { FinancialRecordsPreview } from "@/components/financial-records-preview";

export const metadata: Metadata = {
  title: "Financial Control | freightcode®",
  description:
    "Customs financial control in Freightcode: pre-clearance duty and VAT estimates, HMRC-confirmed charges on the MRN, Financial Records ledger, variance review, and TRE duty history — alongside CDS declarations.",
  alternates: {
    canonical: "/solutions/financial-control",
  },
};

export default function FinancialControlSolutionPage() {
  return (
    <article className="max-w-3xl py-4 xl:max-w-none">
      <div className="max-w-3xl">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
          Customs finance
        </p>
        <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
          Financial control
        </h1>
        <p className="mb-6 text-[16px] leading-relaxed text-slate-600">
          Know what duty and import VAT are likely to cost before you clear, then keep HMRC-confirmed amounts on
          the same MRN — separate from the estimate — so cash planning and audit review use the right figure.
        </p>
        <p className="mb-10 text-[15px] leading-relaxed text-slate-700">
          This is customs finance: duty (A00), import VAT (B00), landed cost, and review of estimate vs HMRC charge.
          It is not general accounting or trade finance.
        </p>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">The problem</h2>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Brokers and importers often hold estimates in one place, HMRC charges in another, and payment context in
          email or spreadsheets. When a query or reconciliation lands, it is hard to prove what was forecast versus
          what HMRC assessed on that declaration.
        </p>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">How it works</h2>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">1. Pre-clearance estimates</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          On each draft declaration, Freightcode models duty and import VAT from UK Trade Tariff measures (with FX
          where the invoice is not GBP). You see cash need early — before submit.
        </p>
      </div>

      <div className="mb-10 mt-2 flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
        <div className="max-w-md shrink-0 xl:w-[340px]">
          <h3 className="mb-3 text-[17px] font-semibold text-slate-900">2. Financial Records</h3>
          <p className="text-[15px] leading-relaxed text-slate-700">
            Duty and VAT lines sit on the MRN as estimated or HMRC-confirmed obligations. Search, export, and print
            from the ledger — totals show what is still estimate and what HMRC has assessed.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <FinancialRecordsPreview />
        </div>
      </div>

      <div className="max-w-3xl">
        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">3. Estimate vs HMRC charge</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          When DMSTAX and related notifications confirm duty and VAT, those amounts are stored separately from the
          pre-clearance estimate. Variance checks flag material gaps for review — they do not invent reclaim
          entitlement.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">4. Customs Reports</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Per-declaration audit views show invoice value, duty and VAT, and provenance labels — with export and print
          for review packs.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">5. TRE history and duty review</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Import HMRC Trade Reporting CSVs to browse past lines and surface indicative preference or duty review
          opportunities. Hints are for adviser review — Freightcode does not file C285 reclaims.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">6. Payment fields on the declaration</h3>
        <p className="mb-10 text-[15px] leading-relaxed text-slate-700">
          Method of payment and deferment account (DAN) sit on the declaration with the rest of the CDS data, so
          financial context travels with the entry.
        </p>

        <p className="text-[15px] leading-relaxed text-slate-700">
          <Link href="/solutions" className="font-semibold text-blue-600 hover:text-blue-700">
            All solutions
          </Link>
        </p>
      </div>
    </article>
  );
}
