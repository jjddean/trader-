"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useAuth, UserButton } from "@clerk/nextjs";

export const navigation = [
  { name: "Solutions", href: "/solutions" },
  { 
    name: "Resources", 
    href: "/resources",
    submenu: [
      { name: "HMRC CDS for Importers (2026)", href: "/guides/hmrc-cds-complete-guide-uk-importers-2026" },
      { name: "What is TRE Customs Data?", href: "/guides/what-is-tre-hmrc-trade-data" },
      { name: "Understanding CDS Notifications", href: "/guides/dmsacc-dmsrog-dmscle-hmrc-cds-notifications" },
      { name: "Reading CDS CSV Export (TRE)", href: "/guides/how-to-read-cds-csv-export-tre" },
      { name: "Commodity Codes Lookup", href: "/guides/cds-commodity-codes-how-to-find" },
    ]
  },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const { isSignedIn } = useAuth();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-200/50 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-[24px] relative">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-md bg-[#DFEAF9] p-1.5 shadow-sm">
              <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#2563EB]">
                <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
              </div>
            </div>
            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
              <span className="text-xl font-bold tracking-tight">freight</span>
              <span className="text-xl font-bold tracking-tight text-slate-400">code</span>
              <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-400">®</span>
            </div>
            <span className="ml-1.5 rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-[13px] font-semibold text-slate-600">
              Beta
            </span>
          </Link>
        </div>

        <nav className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-[32px] md:flex h-[64px]">
          {navigation.map((item) => (
            <div key={item.name} className="relative group h-full flex items-center">
              <Link
                href={item.href}
                className="text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827] flex items-center gap-1.5 cursor-pointer h-full"
              >
                {item.name}
                {item.submenu && <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-200" />}
              </Link>
              
              {item.submenu && (
                <div className="absolute top-[64px] left-1/2 -translate-x-1/2 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="w-[320px] rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-lg p-2.5 shadow-xl ring-1 ring-black/5">
                    {item.submenu.map((sub) => (
                      <Link
                        key={sub.name}
                        href={sub.href}
                        className="block rounded-lg px-4 py-3 text-[14px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-[24px]">
          {!isSignedIn ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('waitlist-form');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else window.location.href = '/#waitlist-form';
                }}
                className="h-[32px] rounded border border-transparent bg-[#111827] px-[16px] flex items-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-none"
              >
                Request Access
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="h-[32px] rounded border border-transparent bg-[#111827] px-[12px] flex items-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-none"
              >
                Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
              <UserButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
