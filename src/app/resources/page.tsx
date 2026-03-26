"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { FileText, Calculator, Code2 } from "lucide-react";

export default function ResourcesPage() {
  const { isSignedIn } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <SiteHeader />
      <main className="pt-[140px] pb-24 flex-grow w-full bg-white">
        <article className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
            Technical Resources
          </h1>
          <p className="text-[16px] text-slate-600 leading-relaxed mb-12">
            Guides, tools, and integration documentation to help you manage UK customs compliance efficiently.
          </p>

          <div className="space-y-8 mt-12">
            <Link href="/tools" className="group flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="h-14 w-14 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-slate-800 shrink-0 shadow-sm">
                <Calculator className="h-6 w-6 relative group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-slate-900 mb-1">Financial Calculators</h3>
                <p className="text-[15px] text-slate-700 leading-relaxed">Systematically estimate UK Import Duty, Anti-Dumping tariffs, and execute accurate Postponed VAT Accounting allocations.</p>
              </div>
            </Link>
            
            <Link href="/guides/hmrc-cds-uk-importers-2026" className="group flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="h-14 w-14 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-slate-800 shrink-0 shadow-sm">
                <FileText className="h-6 w-6 relative group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-slate-900 mb-1">Compliance Directives</h3>
                <p className="text-[15px] text-slate-700 leading-relaxed">Access our structured documentation on CDS framework migration, TRE extraction parsing, and regulatory adherence.</p>
              </div>
            </Link>
            
            <div className="group flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200 opacity-80 cursor-not-allowed">
              <div className="h-14 w-14 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 shrink-0 shadow-sm">
                <Code2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-slate-900 mb-1 flex items-center gap-2">Developer API <span className="text-[11px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Coming Q4</span></h3>
                <p className="text-[15px] text-slate-700 leading-relaxed">Secure REST endpoints to integrate CDS reporting pipelines and bi-directional data synchronization directly into your existing ERP.</p>
              </div>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
