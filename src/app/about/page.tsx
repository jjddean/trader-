"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";

export default function AboutPage() {
  const { isSignedIn } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <SiteHeader />
      <main className="pt-[140px] pb-24 flex-grow w-full bg-white">
        <article className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
            About FreightCode
          </h1>
          
          <div className="space-y-6 mt-12 pb-12 border-b border-slate-100">
            <p className="text-[18px] font-semibold text-slate-900 leading-relaxed mb-8">
              FreightCode is building the technology to simplify global trade data, starting with the UK border.
            </p>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              We provide software for UK customs declarations through HMRC&apos;s Customs Declaration Service (CDS): declaration workspace, dry-run validation, invoice extraction, duty estimates, and OAuth connectivity for submit and status.
            </p>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              We believe that international trade should not be slowed down by complex rules, manual data entry, or preventable errors. High-volume businesses and freight forwarders often lose money through overpaid duties and penalties caused by a lack of clear visibility into their supply chain.
            </p>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              By using secure direct connections and smart classification tools, FreightCode gives control back to supply chain operators—ensuring fast, compliant, and optimized customs clearance.
            </p>
          </div>
 
          <div className="mt-12">
            <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mb-6">Our Goal</h2>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              To make customs data easy to use, eliminate shipping delays, and ensure smooth trade for every business.
            </p>
          </div>
        </article>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
