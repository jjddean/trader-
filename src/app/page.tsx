"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkle, Plus, Minus, Globe, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Features", href: "#features" },
  { name: "How It Works", href: "#how-it-works" },
  { name: "Resources", href: "#resources" },
  { name: "FAQ", href: "#faq" },
];

const faqs = [
  {
    question: "What does the free trial include?",
    answer:
      "The free trial gives you full access to our DCTS Intelligence database, three automated compliance checks, and the ability to export one potential trade partner lead.",
  },
  {
    question: "Do you provide legal or customs advice?",
    answer:
      "We provide data-driven insights and automated compliance checks based on HMRC DCTS rules. For complex legal interpretations, we recommend consulting with a certified customs practitioner.",
  },
  {
    question: "Can we upgrade plans later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time through your account settings. Changes are applied immediately.",
  },
  {
    question: "Who is this platform built for?",
    answer:
      "Elite is built for freight forwarders, trade consultants, and DCTS-eligible exporters looking to leverage UK trade preferences.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-slate-200/50 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-[24px] relative">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-md bg-[#DFEAF9] p-1.5 shadow-sm">
                <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#2563EB]">
                  <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tighter text-[#020817]">TradeDNA</span>
              <span className="ml-1 rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                Live
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
            <Link
              href="/sign-in"
              className="text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard/documents"
              className="h-[32px] rounded-md bg-slate-900 px-[12px] flex items-center text-[14px] font-medium text-white transition-all hover:bg-slate-900/90 shadow-sm"
            >
              Dashboard
            </Link>
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-[#E5E7EB]">
              <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-purple-500" />
            </div>
          </div>
        </div>
      </header>

      <main className="pt-[160px]">
        {/* Hero Section */}
        <section className="px-[24px] pb-[80px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-[48px] flex items-center justify-center gap-[8px]">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[#020817] text-white shadow-md shadow-black/20 ring-1 ring-[#020817]/10">
                <Sparkle 
                  className="h-3 w-3 fill-white" 
                  style={{ filter: "drop-shadow(0px 1px 2px rgba(255, 255, 255, 0.2)) drop-shadow(0px 1px 1px rgba(255, 255, 255, 0.1))" }}
                />
              </div>
              <span className="text-[16px] font-medium tracking-normal text-[#020817]">
                UK DCTS Trade Development Platform
              </span>
            </div>

            <h1 className="mb-6 text-[48px] leading-[48px] font-bold tracking-tight text-[#020817]">
              Turn UK trade policy
              <br />
              into your pipeline.
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-[20px] leading-[28px] text-slate-500">
              Elite is the first trade development platform built for the UK&apos;s Developing
              Countries Trading Scheme (DCTS). We help freight forwarders and DCTS-eligible
              exporters discover high-value trade opportunities, verify compliance, and connect with
              the right partners automatically.
            </p>

            <div className="flex flex-col items-center justify-center gap-[16px] sm:flex-row">
              <Link
                href="/dashboard/documents"
                className="h-[40px] min-w-[140px] rounded-md bg-[#0f172a] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-slate-800 shadow-sm"
              >
                Open Dashboard
              </Link>
              <Link
                href="#how-it-works"
                className="h-[40px] min-w-[140px] rounded-md border border-slate-200 bg-white px-[24px] flex items-center justify-center text-[14px] font-medium text-[#020817] transition-all hover:bg-slate-50 shadow-sm"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-gray-50/30 py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="grid items-center gap-[64px] lg:grid-cols-2">
              <div>
                <span className="mb-4 block text-[14px] font-bold tracking-widest text-[#2563EB] uppercase">
                  The Opportunity
                </span>
                <h2 className="mb-6 text-[32px] leading-tight font-bold tracking-tight text-slate-900 md:text-[36px]">
                  £ Billions in tariff savings <br /> waiting to be claimed.
                </h2>
                <p className="mb-8 text-[18px] leading-[1.6] text-slate-500">
                  The UK&apos;s DCTS offers unprecedented trade advantages to 65 nations. Yet most
                  exporters don&apos;t know they qualify, and most importers don&apos;t know where
                  to look.
                </p>
                <div className="space-y-4">
                  {[
                    "Preferential access to 65 developing countries",
                    "Automated origin verification & compliance",
                    "Real-time HMRC customs data integration",
                    "Direct bridge between exporters and importers",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#111827]">
                        <ArrowRight className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-[17px] font-medium text-[#374151]">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-[32px] shadow-xl">
                <div className="mb-8 flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-[#6B7280] uppercase">
                        Origin Verification
                      </p>
                      <p className="text-[16px] font-bold">Bangladesh → UK</p>
                    </div>
                  </div>
                  <span className="rounded bg-[#F0FDF4] px-2 py-1 text-[12px] font-bold text-[#16A34A] uppercase">
                    DCTS Eligible
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full w-3/4 rounded-full bg-[#2563EB]" />
                  </div>
                  <div className="flex justify-between text-[13px] font-bold">
                    <span className="text-[#6B7280]">SAVINGS POTENTIAL</span>
                    <span className="text-[#111827]">£24,500 / shipment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-[64px] text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-slate-900 md:text-[42px]">
                How It Works
              </h2>
              <p className="text-[20px] text-slate-500">
                Stop chasing rates. Start securing partnerships with data-backed intelligence.
              </p>
            </div>

            <div className="grid gap-[32px] md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-[40px]">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Users className="h-6 w-6 text-slate-900" />
                </div>
                <h3 className="mb-4 text-[18px] font-bold text-slate-900">
                  For Freight Forwarders
                </h3>
                <p className="mb-6 text-[17px] leading-[1.6] text-slate-500">
                  You know the UK market. You know the customs landscape. Now find reliable DCTS
                  exporters who actually need your expertise, verified by real trade data.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-[40px]">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <ShieldCheck className="h-6 w-6 text-slate-900" />
                </div>
                <h3 className="mb-4 text-[18px] font-bold text-slate-900">For DCTS Exporters</h3>
                <p className="mb-6 text-[15px] leading-[1.6] text-slate-500">
                  Your goods qualify for preference. Does your UK partner know? We manufacture
                  quality products and enjoy preferential UK tariffs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="bg-gray-50/30 py-[96px]">
          <div className="mx-auto max-w-[768px] px-[24px]">
            <div className="mb-[64px] text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-slate-900 md:text-[40px]">
                Frequently Asked Questions
              </h2>
              <p className="text-[17px] text-slate-500">
                Answers about DCTS workflows and compliance checks.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="group flex w-full items-center justify-between p-[24px] text-left"
                  >
                    <span className="text-[16px] font-bold text-slate-900">{faq.question}</span>
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                        openFaq === index ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400",
                      )}
                    >
                      {openFaq === index ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden px-[24px] transition-all duration-300 ease-in-out",
                      openFaq === index ? "max-h-[200px] pb-[24px]" : "max-h-0",
                    )}
                  >
                    <p className="text-[16px] leading-relaxed text-slate-500">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-[24px] py-[96px]">
          <div className="relative mx-auto max-w-[1024px] overflow-hidden rounded-3xl bg-slate-900 p-[48px] text-center md:p-[80px]">
            <h2 className="mb-6 text-[40px] leading-tight font-bold text-white md:text-[52px] tracking-[-1px]">
              Ready to grow your trade lane?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-[18px] text-slate-400">
              Join freight forwarders and exporters who are turning DCTS preferences into profit.
              Start your 14-day free trial today.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/dashboard/documents"
                className="rounded bg-white px-12 py-4 h-11 flex items-center text-[15px] font-medium text-slate-900 transition-all hover:bg-slate-100"
              >
                Open Dashboard
              </Link>
              <p className="mt-2 text-[12px] font-bold tracking-widest text-gray-500 uppercase">
                NO CREDIT CARD REQUIRED
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-[80px]">
        <div className="mx-auto grid max-w-[1280px] gap-[48px] px-[24px] md:grid-cols-4">
          <div className="col-span-2">
            <Link href="/" className="mb-6 flex items-center gap-2">
              <div className="flex items-center justify-center rounded bg-[#DFEAF9] p-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#2563EB]">
                  <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">TradeDNA</span>
            </Link>
            <p className="max-w-sm text-[16px] leading-relaxed text-slate-500">
              Pioneering trade development intelligence for the DCTS era.
            </p>
          </div>
          <div>
            <p className="mb-6 text-[12px] font-bold tracking-widest text-slate-400 uppercase">
              Product
            </p>
            <ul className="space-y-4 text-[14px] font-medium text-slate-500">
              <li>
                <Link href="#features" className="hover:text-slate-900">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/dashboard/documents" className="hover:text-slate-900">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-slate-900">
                  Resources
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-6 text-[12px] font-bold tracking-widest text-slate-400 uppercase">
              Connect
            </p>
            <ul className="space-y-4 text-[14px] font-medium text-slate-500">
              <li>
                <a href="mailto:hello@tradedna.pro" className="underline hover:text-slate-900">
                  hello@tradedna.pro
                </a>
              </li>
              <li>
                <Link href="#" className="hover:text-slate-900">
                  LinkedIn
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-[40px] max-w-[1280px] border-t border-slate-50 px-[24px] pt-[40px]">
          <p className="text-[12px] font-bold tracking-widest text-slate-400 uppercase italic">
            © 2026 TRADEDNA PRO.
          </p>
        </div>
      </footer>
    </div>
  );
}
