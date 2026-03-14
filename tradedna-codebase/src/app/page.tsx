"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Minus, Globe, ShieldCheck, Users } from "lucide-react";
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
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-black selection:text-white">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-gray-100/50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded bg-[#DFEAF9] p-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#2563EB]">
                  <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <span className="text-lg font-bold tracking-tight text-[#111827]">TradeDNA</span>
              <span className="ml-1 rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                Live
              </span>
            </Link>

            <nav className="ml-4 hidden items-center gap-8 md:flex">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-[15px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/sign-in"
              className="text-[15px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard/documents"
              className="rounded bg-[#111827] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-black"
            >
              Dashboard
            </Link>
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-[#E5E7EB]">
              <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-purple-500" />
            </div>
          </div>
        </div>
      </header>

      <main className="pt-28">
        {/* Hero Section */}
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <span className="mb-10 block text-[14px] font-semibold tracking-tight text-[#111827] uppercase">
              UK DCTS Trade Development Platform
            </span>

            <h1 className="mb-8 text-[40px] leading-[1.1] font-bold tracking-[-0.03em] text-[#111827] md:text-[52px]">
              Turn UK trade policy
              <br />
              into your pipeline.
            </h1>

            <p className="mx-auto mb-12 max-w-3xl text-[22px] leading-[1.6] text-[#6B7280]">
              Elite is the first trade development platform built for the UK&apos;s Developing
              Countries Trading Scheme (DCTS). We help freight forwarders and DCTS-eligible
              exporters discover high-value trade opportunities, verify compliance, and connect with
              the right partners automatically.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/dashboard/documents"
                className="min-w-[150px] rounded bg-[#111827] px-7 py-3 text-[14px] font-semibold text-white transition-all hover:bg-black"
              >
                Open Dashboard
              </Link>
              <Link
                href="#how-it-works"
                className="min-w-[150px] rounded border border-[#E5E7EB] bg-white px-7 py-3 text-[14px] font-semibold text-[#111827] transition-all hover:bg-gray-50"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-gray-50/30 py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div>
                <span className="mb-4 block text-[14px] font-bold tracking-widest text-[#2563EB] uppercase">
                  The Opportunity
                </span>
                <h2 className="mb-6 text-[36px] leading-tight font-bold tracking-tight text-[#111827] md:text-[42px]">
                  £ Billions in tariff savings <br /> waiting to be claimed.
                </h2>
                <p className="mb-8 text-[20px] leading-[1.6] text-[#6B7280]">
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
              <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
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
        <section id="how-it-works" className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-[#111827] md:text-[42px]">
                How It Works
              </h2>
              <p className="text-[20px] text-[#6B7280]">
                Stop chasing rates. Start securing partnerships with data-backed intelligence.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Users className="h-6 w-6 text-[#111827]" />
                </div>
                <h3 className="mb-4 text-[22px] font-bold text-[#111827]">
                  For Freight Forwarders
                </h3>
                <p className="mb-6 text-[18px] leading-[1.6] text-[#6B7280]">
                  You know the UK market. You know the customs landscape. Now find reliable DCTS
                  exporters who actually need your expertise, verified by real trade data.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <ShieldCheck className="h-6 w-6 text-[#111827]" />
                </div>
                <h3 className="mb-4 text-[22px] font-bold text-[#111827]">For DCTS Exporters</h3>
                <p className="mb-6 text-[18px] leading-[1.6] text-[#6B7280]">
                  Your goods qualify for preference. Does your UK partner know? We manufacture
                  quality products and enjoy preferential UK tariffs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="bg-gray-50/30 py-24">
          <div className="mx-auto max-w-3xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-[#111827] md:text-[40px]">
                Frequently Asked Questions
              </h2>
              <p className="text-[18px] text-[#6B7280]">
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
                    className="group flex w-full items-center justify-between p-6 text-left"
                  >
                    <span className="text-[18px] font-bold text-[#111827]">{faq.question}</span>
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                        openFaq === index ? "bg-[#111827] text-white" : "bg-gray-50 text-gray-400",
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
                      "overflow-hidden px-6 transition-all duration-300 ease-in-out",
                      openFaq === index ? "max-h-[200px] pb-6" : "max-h-0",
                    )}
                  >
                    <p className="text-[17px] leading-relaxed text-[#6B7280]">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#111827] p-12 text-center md:p-20">
            <h2 className="mb-6 text-[40px] leading-tight font-bold text-white md:text-[52px]">
              Ready to grow your trade lane?
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-[22px] text-gray-400">
              Join freight forwarders and exporters who are turning DCTS preferences into profit.
              Start your 14-day free trial today.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/dashboard/documents"
                className="rounded bg-white px-12 py-4 text-[16px] font-semibold text-[#111827] transition-all hover:bg-gray-100"
              >
                Start Free Trial
              </Link>
              <p className="mt-2 text-[12px] font-bold tracking-widest text-gray-500 uppercase">
                NO CREDIT CARD REQUIRED
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-4">
          <div className="col-span-2">
            <Link href="/" className="mb-6 flex items-center gap-2">
              <div className="flex items-center justify-center rounded bg-[#DFEAF9] p-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#2563EB]">
                  <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-[#111827]">TradeDNA</span>
            </Link>
            <p className="max-w-sm text-[16px] leading-relaxed text-[#6B7280]">
              Pioneering trade development intelligence for the DCTS era.
            </p>
          </div>
          <div>
            <p className="mb-6 text-[12px] font-bold tracking-widest text-[#9CA3AF] uppercase">
              Product
            </p>
            <ul className="space-y-4 text-[15px] font-medium text-[#6B7280]">
              <li>
                <Link href="#features" className="hover:text-[#111827]">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/dashboard/documents" className="hover:text-[#111827]">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[#111827]">
                  Resources
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-6 text-[12px] font-bold tracking-widest text-[#9CA3AF] uppercase">
              Connect
            </p>
            <ul className="space-y-4 text-[15px] font-medium text-[#6B7280]">
              <li>
                <a href="mailto:hello@tradedna.pro" className="underline hover:text-[#111827]">
                  hello@tradedna.pro
                </a>
              </li>
              <li>
                <Link href="#" className="hover:text-[#111827]">
                  LinkedIn
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-gray-50 px-6 pt-10">
          <p className="text-[12px] font-bold tracking-widest text-[#9CA3AF] uppercase italic">
            © 2026 TRADEDNA PRO.
          </p>
        </div>
      </footer>
    </div>
  );
}
