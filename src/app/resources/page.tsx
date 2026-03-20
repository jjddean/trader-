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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <main className="pt-[140px] pb-24">
        <div className="mx-auto max-w-[1024px] px-[24px]">
          <h1 className="mb-4 text-[42px] font-bold tracking-tight text-[#020817] md:text-[52px] text-center">
            Resources
          </h1>
          <p className="mx-auto mb-16 max-w-2xl text-[20px] text-slate-500 text-center">
            Tools, documentation, and guides to help you master UK customs compliance.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            <Link href="/tools" className="group flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                <Calculator className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Free Calculators</h3>
              <p className="text-slate-500">Estimate UK Import Duty, Anti-Dumping tariffs, and Postponed VAT Accounting easily.</p>
            </Link>
            
            <div className="group flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-600 group-hover:scale-110 transition-transform">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Customs Guides</h3>
              <p className="text-slate-500">Read our comprehensive material on navigating the CDS migration and compliance.</p>
            </div>
            
            <div className="group flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
                <Code2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Developer API</h3>
              <p className="text-slate-500">Integrate direct CDS reporting and data sync pipelines right into your ERP.</p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
