"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";

const capabilities = [
  { 
    id: 'historical', 
    label: 'Historical Data Analysis',
    benefit: 'Ingest and parse years of historical HMRC declarations instantly to identify patterns and track your overall customs performance.',
    how: 'You forward your HMRC "Report Ready" secure CSVs to your dedicated inbox. Our parsing engine automatically standardizes the raw line items and securely structures your trade history into your private database, saving hours of manual spreadsheet work.'
  },
  { 
    id: 'savings', 
    label: 'Automated Savings Detection',
    benefit: 'Stop leaving money on the table. We identify explicit financial losses and reclamation opportunities across your supply chain.',
    how: 'Our analytics engine constantly scans your data against global trade agreements. It flags exact instances where a shipment was eligible for a 0% duty preference code, but standard duty was paid instead, calculating exactly how much you can reclaim.'
  },
  { 
    id: 'prefill', 
    label: 'Smart Duty Pre-Fill',
    benefit: 'Draft new declarations in seconds. Remove the guesswork of finding the correct HS Commodity Codes for repetitive shipments.',
    how: "When you create a new draft, our system analyzes your company's highest-frequency historical shipments. By looking at successful past clearances for that specific origin country, it seamlessly suggests the most accurate, compliant commodity codes and preferences."
  },
  { 
    id: 'scoring', 
    label: 'Compliance Health Scoring',
    benefit: 'Monitor the performance of your appointed brokers and freight forwarders across all your UK ports.',
    how: 'We generate an immediate, comparative health score by analyzing the ratio of perfect clearances against flagged anomalies. You get a transparent leaderboard showing exactly which external agents are making the most compliance errors on your behalf.'
  },
  { 
    id: 'hmrc', 
    label: 'HMRC Data Sync',
    benefit: 'Maintain a direct, secure, and perpetual connection to your HMRC Government Gateway account.',
    how: 'Without ever asking for your passwords, we utilize official HMRC OAuth flows to securely link your workspace and EORI number. Our system handles token refreshing automatically, ensuring your dashboard is always synced with your latest Trade Reporting and Extracting (TRE) data.'
  },
  { 
    id: 'storage', 
    label: 'Secure Document Vault',
    benefit: 'Centralize your commercial invoices, packing lists, and clearance evidence in one HMRC-compliant repository.',
    how: 'Upload and attach critical trade documents directly to your declaration records. We maintain encrypted, redundant cloud storage organized by MRN, making it effortless to retrieve evidence during an unexpected HMRC post-clearance audit.'
  },
];

export default function SolutionsPage() {
  const { isSignedIn } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <main className="pt-[140px] pb-24">
        <div className="mx-auto max-w-[1024px] px-[24px]">
          <h1 className="mb-4 text-[42px] font-bold tracking-tight text-[#020817] md:text-[52px] text-center">
            Our Solutions
          </h1>
          <p className="mx-auto mb-16 max-w-2xl text-[20px] text-slate-500 text-center">
            Comprehensive customs intelligence designed to automate compliance, uncover hidden savings, and eliminate manual data entry.
          </p>
          <div className="space-y-16">
            {capabilities.map((item, index) => (
              <div key={item.id} id={item.id} className="scroll-mt-[120px] rounded-2xl bg-white p-8 md:p-12 shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl font-bold text-[#1d6fc0] shrink-0">
                    {index + 1}
                  </div>
                  <h2 className="text-[28px] font-bold text-[#020817] tracking-tight">{item.label}</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-12">
                  <div>
                    <h3 className="text-[14px] uppercase tracking-widest font-semibold text-slate-400 mb-3">The Benefit</h3>
                    <p className="text-[18px] leading-[1.6] text-slate-700 font-medium">
                      {item.benefit}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[14px] uppercase tracking-widest font-semibold text-slate-400 mb-3">How it Works</h3>
                    <p className="text-[16px] leading-[1.7] text-slate-600">
                      {item.how}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
