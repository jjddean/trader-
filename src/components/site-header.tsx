"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth, UserButton } from "@clerk/nextjs";

export const navigation = [
  { name: "Solutions", href: "/solutions" },
  { name: "Resources", href: "/resources" },
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

        <nav className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-[32px] md:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              {item.name}
            </Link>
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
