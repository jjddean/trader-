"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";

const capabilities = [
  { 
    id: 'historical', 
    label: 'Historical Data Analysis',
    benefit: 'Review past declaration patterns when TRE data is imported (planned).',
    how: 'Export CSV reports from HMRC TRE and import them into Freightcode to structure line items for estimates and HS suggestions.'
  },
  { 
    id: 'savings', 
    label: 'Duty Refund Detection',
    benefit: 'Highlight possible preference or duty review opportunities — indicative, not filed reclaims.',
    how: 'When historical data is available, the platform can flag lines where a preference code may have been missed. Your customs adviser confirms before any reclaim.'
  },
  { 
    id: 'prefill', 
    label: 'Smart Declaration Drafting',
    benefit: 'Create new draft declarations instantly and save time finding the correct HS Commodity Codes.',
    how: "As you start a declaration, the system looks at your most frequent shipping routes and past successful filings to recommend the most accurate commodity codes."
  },
  { 
    id: 'scoring', 
    label: 'Broker Performance Monitoring',
    benefit: 'Track how well your freight forwarders and customs brokers are performing.',
    how: 'We compare successful filings against errors to give you a clear view of which agents are performing best and where improvements are needed.'
  },
  { 
    id: 'hmrc', 
    label: 'HMRC OAuth connection',
    benefit: 'Connect to HMRC to submit declarations and pull status and notifications.',
    how: 'Connect via official HMRC OAuth to submit declarations and pull status and notifications. Tokens refresh in the background while your session stays authorised.'
  },
  { 
    id: 'storage', 
    label: 'Secure Document Storage',
    benefit: 'Keep your invoices, packing lists, and customs documents in one secure, compliant place.',
    how: 'Attach documents directly to your declaration records. We use secure cloud storage to ensure you can find what you need quickly during an HMRC audit.'
  },
];

export default function SolutionsPage() {
  const { isSignedIn } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <SiteHeader />
      <main className="pt-[140px] pb-24 flex-grow w-full bg-white">
        <article className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
            Our Services
          </h1>
          <p className="text-[16px] text-slate-600 leading-relaxed mb-12">
            Build and submit UK customs declarations through HMRC CDS, with dry-run validation, document storage, and duty estimates — in one workspace.
          </p>

          <div className="space-y-12 mt-12">
            {capabilities.map((item, index) => (
              <div key={item.id} id={item.id} className="scroll-mt-[120px]">
                <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[14px] font-bold text-blue-600 shrink-0">
                    {index + 1}
                  </span>
                  {item.label}
                </h2>
                <div className="pl-11 space-y-4">
                  <p className="text-[15px] font-semibold text-slate-800 leading-relaxed">
                    {item.benefit}
                  </p>
                  <p className="text-[15px] text-slate-700 leading-relaxed">
                    {item.how}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
