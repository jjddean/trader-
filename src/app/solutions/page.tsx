"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";

const capabilities = [
  { 
    id: 'historical', 
    label: 'Historical Data Architecture',
    benefit: 'Ingest and parse vast datasets of historical HMRC declarations to model compliance patterns and audit supply chain fidelity.',
    how: 'Organizations provision HMRC "Report Ready" CSV extracts to our secure ingestion points. The analytical engine normalizes raw data structures and writes exact historical trade records into an isolated, encrypted database.'
  },
  { 
    id: 'savings', 
    label: 'Precision Financial Reclamation',
    benefit: 'Maximize financial efficiency. We identify precise monetary discrepancies and explicit reclamation opportunities across international shipments.',
    how: 'The platform cross-references declaration records against live global trade agreements, systematically flagging instances where preferential 0% duty margins were bypassed. It programmatically calculates the exact reclaimable duty variance.'
  },
  { 
    id: 'prefill', 
    label: 'Intelligent Duty Profiling',
    benefit: 'Architect new draft declarations instantaneously. Eliminate the operational friction of sourcing compliant HS Commodity Codes.',
    how: "When initiating a declaration, the system parses the organization's highest-frequency historical routes. Analyzing previously cleared shipments for specific regions, it dynamically recommends the mathematically most compliant commodity codes."
  },
  { 
    id: 'scoring', 
    label: 'Broker Compliance Benchmarking',
    benefit: 'Standardize and monitor the technical performance of appointed freight forwarders and customs brokers.',
    how: 'The platform generates benchmark health indicators by contrasting flawless clearances against anomalous filings. Supply chain leaders gain a transparent leaderboard revealing exact compliance error rates aggregated by representation.'
  },
  { 
    id: 'hmrc', 
    label: 'Government Gateway Synchronization',
    benefit: 'Establish a resilient, perpetual OAuth ledger with the structural HMRC Government Gateway.',
    how: 'Utilizing official HMRC standards, we securely federate workspace identities with corresponding EORI registries. The architecture autonomously renegotiates access tokens, guaranteeing uninterrupted synchronization with Trade Reporting and Extracting (TRE) APIs.'
  },
  { 
    id: 'storage', 
    label: 'Encrypted Auditable Repository',
    benefit: 'Centralize commercial invoices, routing logs, and statutory clearance evidence in an HMRC-compliant digital vault.',
    how: 'Stakeholders attach critical trade verification directly to their movement reference records (MRNs). We manage multi-region, redundant object storage, ensuring immediate evidence retrieval during formal post-clearance audits.'
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
            Automated Customs Solutions
          </h1>
          <p className="text-[16px] text-slate-600 leading-relaxed mb-12">
            Comprehensive enterprise customs intelligence engineered to automate compliance frameworks, uncover exact financial reclamation opportunities, and eliminate manual data reconciliation.
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
