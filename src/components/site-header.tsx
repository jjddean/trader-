"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useAuth, UserButton, Waitlist } from "@clerk/nextjs";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const navigation = [
  { name: "Solutions", href: "/solutions" },
  { name: "Resources", href: "/resources" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const { isSignedIn } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
              <span className="text-xl font-bold tracking-tight text-slate-600">code</span>
              <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
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
              </Link>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-[12px] md:gap-[24px]">
          <div className="flex items-center gap-4">
            {!isSignedIn ? (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                      className="h-[32px] rounded-md border border-transparent bg-[#111827] px-[12px] md:px-[16px] text-[13px] font-medium text-white transition-colors hover:bg-slate-800 flex items-center justify-center whitespace-nowrap shadow-sm cursor-pointer"
                  >
                      Gain Access
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[440px] p-0 border-none bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/20 [&>button]:hover:bg-black/40 [&>button]:rounded-full [&>button]:top-2 [&>button]:right-2">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Join Waitlist</DialogTitle>
                  </DialogHeader>
                  <Waitlist />
                  <div className="pb-6 px-8 text-center">
                    <p className="text-[12px] text-slate-500">
                      Need help? Contact us at{" "}
                      <a href="mailto:info@freightcode.co.uk" className="text-slate-900 font-medium hover:underline">
                        info@freightcode.co.uk
                      </a>
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="h-[32px] rounded border border-transparent bg-[#111827] px-[12px] hidden md:flex items-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-none"
                >
                  Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
                <UserButton />
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 md:hidden"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Content */}
      {isMobileMenuOpen && (
        <div className="border-t border-slate-100 bg-white md:hidden">
          <nav className="flex flex-col p-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-12 items-center px-4 text-[14px] font-medium text-slate-600 hover:text-slate-900"
              >
                {item.name}
              </Link>
            ))}
            {isSignedIn && (
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-12 items-center px-4 text-[14px] font-medium text-slate-600 hover:text-slate-900"
              >
                Dashboard
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
