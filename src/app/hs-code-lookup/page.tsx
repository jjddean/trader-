import React from 'react';
import { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { HSCodeLookup } from '@/components/tools/HSCodeLookup';

export const metadata: Metadata = {
  title: 'UK HS Code Lookup | HMRC Commodity Code Search | FreightCode',
  description:
    'Free UK HS Code lookup tool. Search the official HMRC Trade Tariff for accurate commodity codes, duty rates, and product descriptions for your customs declarations.',
  keywords: [
    'HS Code Lookup',
    'UK Commodity Codes',
    'HMRC Tariff Search',
    'Customs classification',
    'UK Import Duty',
    'Trade Tariff',
  ],
  openGraph: {
    title: 'UK HS Code Lookup | HMRC Commodity Code Search',
    description:
      'Find accurate UK commodity codes and duty rates instantly with our free HMRC search tool.',
    type: 'website',
  },
};

export default function DedicatedHSCodePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-slate-900">
      <SiteHeader />
      <main className="w-full flex-grow pb-24 pt-[140px]">
        <section className="relative z-20 mx-auto max-w-4xl px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl transition-all md:p-12">
            <h1 className="mb-1 text-lg font-bold text-slate-900">HS Code Lookup</h1>
            <p className="mb-8 text-sm text-slate-500">
              Search the UK Trade Tariff for commodity codes, descriptions, and duty rates.
            </p>
            <HSCodeLookup />
          </div>
        </section>
      </main>

      <footer className="mt-auto w-full border-t border-slate-200 bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex items-baseline whitespace-nowrap leading-none text-[#020817]">
              <span className="text-[22px] font-bold tracking-tight">freight</span>
              <span className="text-[22px] font-bold tracking-tight text-slate-600">code</span>
              <span className="ml-[-1px] -translate-y-[5px] text-[13px] font-normal text-slate-600">
                ®
              </span>
            </div>
          </div>

          <p className="mx-auto mb-8 max-w-lg text-[15px] leading-relaxed text-slate-600">
            UK customs declarations through HMRC CDS — draft, validate, submit, and keep audit-ready
            records.
          </p>

          <div className="inline-flex min-w-[280px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="mb-2 text-[16px] font-bold text-slate-900">
              Need direct support? Contact Us
            </span>
            <a
              href="mailto:info@freightcode.co.uk"
              className="text-[16px] font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline"
            >
              info@freightcode.co.uk
            </a>
            <span className="mt-2 text-[13px] font-medium text-slate-500">London, UK</span>
          </div>

          <p className="mt-12 text-[13px] font-medium text-slate-400">
            © {new Date().getFullYear()} Freightcode. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
