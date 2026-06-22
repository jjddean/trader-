import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with FreightCode Logo */}
      <header className="w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-[64px] max-w-[1024px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <div className="flex items-center justify-center rounded-md bg-[#DFEAF9] p-1.5 shadow-sm">
              <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#2563EB]">
                <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
              </div>
            </div>
            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
              <span className="text-xl font-bold tracking-tight">freight</span>
              <span className="text-xl font-bold tracking-tight text-slate-600">code</span>
              <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
            </div>
            <span className="ml-2 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600 hidden sm:inline-block">
              Guides
            </span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Guide Content */}
      <main className="flex-grow w-full bg-white">
        {children}
      </main>

      {/* Footer / Contact Form for all Guides */}
      <footer className="py-12 px-6 bg-slate-50 border-t border-slate-200 w-full mt-auto">
        <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-5">
              <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                  <span className="font-bold tracking-tight text-[22px]">freight</span>
                  <span className="font-bold tracking-tight text-[22px] text-slate-600">code</span>
                  <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
              </div>
            </div>
            
            <p className="text-slate-600 text-[15px] mb-8 max-w-lg mx-auto leading-relaxed">
              UK customs declarations through HMRC CDS — draft, validate, submit, and keep audit-ready records.
            </p>
            
            <div className="inline-flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 p-6 shadow-sm min-w-[280px]">
              <span className="text-[16px] font-bold text-slate-900 mb-2">Need direct support? Contact Us</span>
              <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:text-blue-700 hover:underline text-[16px] font-semibold transition-colors">
                info@freightcode.co.uk
              </a>
              <span className="text-[13px] text-slate-500 mt-2 font-medium">London, UK</span>
            </div>
            
            <p className="text-slate-400 text-[13px] mt-12 font-medium">
                © {new Date().getFullYear()} Freightcode. All rights reserved.
            </p>
        </div>
      </footer>
    </div>
  );
}
