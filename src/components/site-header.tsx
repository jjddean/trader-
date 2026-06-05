"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { SignInButton, SignUpButton, useAuth, UserButton } from "@clerk/nextjs";
import { useState } from "react";

const authButtonClass =
  "h-[32px] rounded-md px-[12px] md:px-[16px] text-[13px] font-medium transition-colors flex items-center justify-center whitespace-nowrap shadow-sm";

export const navigation = [
  { name: "Solutions", href: "/solutions" },
  { name: "Resources", href: "/resources" },
  { name: "Docs", href: "/docs" },
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
              <div className="hidden items-center gap-2 sm:flex">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className={`${authButtonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className={`${authButtonClass} border border-transparent bg-[#111827] text-white hover:bg-slate-800`}
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
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
            {isSignedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-12 items-center px-4 text-[14px] font-medium text-slate-600 hover:text-slate-900"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex flex-col gap-1 border-t border-slate-100 pt-2 mt-2">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-12 w-full items-center px-4 text-[14px] font-medium text-slate-600 hover:text-slate-900"
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-12 w-full items-center px-4 text-[14px] font-medium text-slate-900 hover:text-slate-700"
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
