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
            Enterprise Customs Intelligence
          </h1>
          
          <div className="space-y-6 mt-12 pb-12 border-b border-slate-100">
            <p className="text-[18px] font-semibold text-slate-900 leading-relaxed mb-8">
              FreightCode is architecting the foundational intelligence layer for global trade data, beginning directly with the UK border.
            </p>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              We operate as an intelligent B2B SaaS infrastructure designed to formalize and automate UK customs clearances. Our core architecture provides enterprise-grade historical data analytics, deterministic commercial invoice extraction, algorithmic duty validation, and resilient integrations with HMRC's Customs Declaration Service (CDS).
            </p>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              We operate on the premise that international trade velocity should not be handicapped by opaque regulatory logic, inefficient human data entry, and preventable misclassification errors. High-volume enterprises and freight forwarders historically lose millions in operational capital through overpaid duties and compliance penalties caused exclusively by a lack of actionable supply chain visibility.
            </p>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              By leveraging secure institutional API connections and an advanced automated classification ledger, FreightCode restores systemic control to supply chain operators—guaranteeing rapid, compliant, and continuously optimized frontier clearance.
            </p>
          </div>

          <div className="mt-12">
            <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mb-6">Our Core Objective</h2>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              To systematically democratize customs intelligence, eliminate regulatory friction points, and establish borderless supply chain velocity for the modern enterprise.
            </p>
          </div>
        </article>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
