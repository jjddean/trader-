import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Customs Guides & Documentation | FreightCode",
  description: "Comprehensive guides on HMRC CDS, TRE data exports, customs notifications, and UK tariff commodity codes.",
  alternates: {
    canonical: "/guides",
  },
};

export const guides = [
  {
    title: "HMRC CDS Complete Guide for UK Importers (2026)",
    slug: "hmrc-cds-complete-guide-uk-importers-2026",
    description: "A comprehensive, start-to-finish guide to navigating the Customs Declaration Service, managing deferment accounts, and maintaining border compliance.",
  },
  {
    title: "What is TRE? HMRC Trade Data Explained",
    slug: "what-is-tre-hmrc-trade-data",
    description: "Understand the Trade Reporting and Extracting (TRE) framework and learn how to extract your historical customs data from the Government Gateway.",
  },
  {
    title: "DMSACC, DMSROG, DMSCLE: HMRC CDS Notifications",
    slug: "dmsacc-dmsrog-dmscle-hmrc-cds-notifications",
    description: "A complete technical breakdown of standard CDS clearance statuses, error codes, and what they mean for your supply chain.",
  },
  {
    title: "How to Read CDS CSV Exports (TRE Data)",
    slug: "how-to-read-cds-csv-export-tre",
    description: "Step-by-step instructions for parsing, analyzing, and auditing your raw customs data exports for compliance and financial reclamation.",
  },
  {
    title: "CDS Commodity Codes: How to Find Them",
    slug: "cds-commodity-codes-how-to-find",
    description: "Expert strategies and tooling for successfully navigating the UK Trade Tariff to accurately classify your goods.",
  },
];

export default function GuidesIndex() {
  return (
    <div className="min-h-screen border-t border-slate-200 bg-slate-50 font-sans text-slate-900 flex flex-col pt-[64px]">
      <SiteHeader />
      <main className="flex-grow w-full pb-24 relative overflow-hidden">
        {/* Hero Section */}
        <section className="bg-slate-900 text-white pt-24 pb-20 px-6 relative border-b border-slate-800">
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-900/20">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Official Customs Guides
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl">
              Authoritative documentation, compliance strategies, and technical integration guides engineered for modern UK importers and forwarders.
            </p>
            
            {/* Search link request fulfilled inline */}
            <Link href="/tools/hscode-lookup" className="mt-8 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-6 py-3 rounded-full text-sm font-medium transition-colors">
              <Search className="h-4 w-4 text-blue-400" />
              <span>Search the UK Tariff (HS Code Lookup) →</span>
            </Link>
          </div>
        </section>

        {/* Guides List */}
        <section className="max-w-4xl mx-auto px-6 pt-16">
          <div className="flex flex-col gap-6">
            {guides.map((guide, idx) => (
              <Link 
                key={idx} 
                href={`/guides/${guide.slug}`}
                className="group block bg-white border border-slate-200 p-8 rounded-2xl hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 transition-all duration-300"
              >
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {guide.title}
                </h3>
                <p className="text-slate-600 leading-relaxed text-[15px]">
                  {guide.description}
                </p>
                <div className="mt-6 flex items-center text-sm font-semibold text-blue-600">
                  Read Documentation
                  <svg className="ml-2 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter isSignedIn={false} />
    </div>
  );
}
