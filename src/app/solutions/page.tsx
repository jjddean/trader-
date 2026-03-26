"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";

const capabilities = [
  { 
    id: 'historical', 
    label: 'Historical Data Analysis',
    benefit: 'Import and analyze your past HMRC declarations to find trends and ensure your records are accurate.',
    how: 'Upload your HMRC CSV reports directly to our platform. Our system automatically organizes the data into secure historical trade records, saving you hours of manual spreadsheet work.'
  },
  { 
    id: 'savings', 
    label: 'Duty Refund Detection',
    benefit: 'Identify errors and refund opportunities across your international shipments.',
    how: 'The platform checks your records against trade agreements, flagging instances where you could have paid 0% duty but didn\'t. It calculates exactly how much you can reclaim.'
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
    label: 'Direct HMRC Sync',
    benefit: 'Connect securely to your HMRC account for real-time data synchronization.',
    how: 'Using official HMRC standards, we link your account to your EORI number. The connection stays active and secure automatically, so your dashboard is always up to date.'
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
            Our tools automate your customs compliance, identify duty refund opportunities, and remove the need for manual paperwork.
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
