"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";

export default function AboutPage() {
  const { isSignedIn } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <main className="pt-[140px] pb-24">
        <div className="mx-auto max-w-[800px] px-[24px]">
          <h1 className="mb-8 text-[42px] font-bold tracking-tight text-[#020817] md:text-[52px]">
            About Freightcode
          </h1>
          
          <div className="prose prose-lg prose-slate max-w-none bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm text-slate-600 space-y-6">
            <p className="text-xl text-slate-800 font-medium">
              We're building the intelligence layer for global trade, starting with the UK.
            </p>
            <p>
              Freightcode is an intelligent B2B SaaS platform designed to modernize UK customs clearances. Our services include historical data analytics, AI-assisted commercial invoice extraction, smart duty pre-fill capabilities, and direct seamless integrations with HMRC's Customs Declaration Service (CDS).
            </p>
            <p>
              We believe that international trade should not be bottle-necked by opaque compliance rules, manual spreadsheet data entry, and preventable human errors. High-volume importers and forwarders lose millions annually in overpaid duties and compliance penalties simply due to a lack of actionable visibility.
            </p>
            <p>
              By leveraging direct government API connections and an advanced automated classification engine, we give control back to supply chain operators—ensuring fast, compliant, and cost-optimized clearance through the frontier.
            </p>
            <h3 className="text-2xl font-bold text-slate-900 pt-8 border-t border-slate-100 mt-8">Our Mission</h3>
            <p>
              To democratize customs data, eliminate compliance friction, and unlock borderless supply chain velocity for modern enterprises.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
