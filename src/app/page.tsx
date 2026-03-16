"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, Sparkle, Plus, Minus, Globe, ShieldCheck, Users, User } from "lucide-react";
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
  const { isSignedIn } = useAuth();

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
              <span className="text-xl font-bold tracking-tighter text-[#020817]">freightcode&reg;</span>
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
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]">
                  Sign In
                </button>
              </SignInButton>
            ) : (
              <Link
                href="/dashboard/documents"
                className="text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                Dashboard
              </Link>
            )}
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="h-[32px] rounded-md bg-slate-900 px-[12px] flex items-center text-[14px] font-medium text-white transition-all hover:bg-slate-900/90 shadow-sm">
                  Dashboard
                </button>
              </SignInButton>
            ) : null}
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button
                  aria-label="Open sign in"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-[#6B7280] transition-colors hover:border-gray-300 hover:text-[#111827]"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
              </SignInButton>
            )}
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
                UK Customs & Trade Development Platform
              </span>
            </div>

            <h1 className="mb-6 text-[48px] leading-[48px] font-bold tracking-tight text-[#020817]">
              Total CDS visibility.
              <br />
              Instant customs payments.
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-[20px] leading-[28px] text-slate-500">
              Access your HMRC declaration data instantly. freightcode&reg; connects directly to the Single Customs Platform so you can track compliance, execute immediate payments, and secure DCTS preference savings automatically.
            </p>

            <div className="flex flex-col items-center justify-center gap-[16px] sm:flex-row">
              {isSignedIn ? (
                <Link
                  href="/dashboard/documents"
                  className="h-[40px] min-w-[140px] rounded-md bg-[#0f172a] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-slate-800 shadow-sm"
                >
                  Open Dashboard
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <button className="h-[40px] min-w-[140px] rounded-md bg-[#0f172a] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-slate-800 shadow-sm">
                    Open Dashboard
                  </button>
                </SignInButton>
              )}
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
              {isSignedIn ? (
                <Link
                  href="/dashboard/documents"
                  className="rounded bg-white px-12 py-4 h-11 flex items-center text-[15px] font-medium text-slate-900 transition-all hover:bg-slate-100"
                >
                  Open Dashboard
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <button className="rounded bg-white px-12 py-4 h-11 flex items-center text-[15px] font-medium text-slate-900 transition-all hover:bg-slate-100">
                    Open Dashboard
                  </button>
                </SignInButton>
              )}
              <p className="mt-2 text-[12px] font-bold tracking-widest text-gray-500 uppercase">
                NO CREDIT CARD REQUIRED
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white border-t border-gray-200">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-6 mb-10">
                    {/* Logo / About */}
                    <div className="col-span-2 md:col-span-1 -mt-1">
                        <div className="mb-4">
                            <div className="flex items-baseline whitespace-nowrap text-[#003057] leading-none">
                                <span className="font-bold tracking-tight text-[22px]">freight</span>
                                <span className="font-normal tracking-tight text-[22px]">code</span>
                                <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px]">®</span>
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed">
                            Freight operations software for<br />complex trade lanes.
                        </p>
                        <p className="text-gray-400 text-xs mt-3">
                            London, UK
                            <br />
                            info@freightcode.co.uk
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-[#003057] font-medium text-xs mb-4">Product</h4>
                        <ul className="text-gray-500 text-xs space-y-2">
                            <li><a href="#features" className="hover:text-[#003057]">Features</a></li>
                            <li><a href="#" className="hover:text-[#003057]">Pricing</a></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-[#003057] font-medium text-xs mb-4">Company</h4>
                        <ul className="text-gray-500 text-xs space-y-2">
                            <li><a href="#" className="hover:text-[#003057]">About</a></li>
                            <li><a href="#" className="hover:text-[#003057]">Blog</a></li>
                            <li><a href="#" className="hover:text-[#003057]">Contact</a></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-[#003057] font-medium text-xs mb-4">Legal</h4>
                        <ul className="text-gray-500 text-xs space-y-2">
                            <li><Link href="/privacy" className="hover:text-[#003057]">Privacy</Link></li>
                            <li><Link href="/terms" className="hover:text-[#003057]">Terms</Link></li>
                        </ul>
                    </div>

                    {/* Socials */}
                    <div>
                        <h4 className="text-[#003057] font-medium text-xs mb-4">Socials</h4>
                        <ul className="text-gray-500 text-xs space-y-2">
                            <li><a href="https://x.com/freightcode" className="hover:text-[#003057]">X</a></li>
                            <li><a href="https://linkedin.com/company/freightcode" className="hover:text-[#003057]">LinkedIn</a></li>
                            <li><a href="https://youtube.com/@freightcode" className="hover:text-[#003057]">YouTube</a></li>
                        </ul>
                    </div>

                    {/* Security & Trust */}
                    <div>
                        <h4 className="text-[#003057] font-medium text-xs mb-4">Security & Trust</h4>
                        <ul className="text-gray-500 text-xs space-y-2">
                            <li>Secure billing via Stripe</li>
                            <li>Enterprise authentication</li>
                            <li>Encrypted data</li>
                            <li>Activity logging</li>
                            <li>Role-based access</li>
                        </ul>
                    </div>

                    {/* Trusted Infrastructure */}
                    <div>
                        <h4 className="text-[#003057] font-medium text-xs mb-4">Trusted Infrastructure</h4>
                        <ul className="text-gray-500 text-xs space-y-2">
                            <li className="flex items-center gap-2 group">
                                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#003057]">Stripe</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/stripe.com?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Stripe" className="w-3 h-3 object-contain opacity-40 group-hover:opacity-100 transition-opacity" />
                            </li>
                            <li className="flex items-center gap-2 group">
                                <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#003057]">Clerk</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/clerk.com?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Clerk" className="w-3 h-3 object-contain opacity-40 group-hover:opacity-100 transition-opacity" />
                            </li>
                            <li className="flex items-center gap-2 group">
                                <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className="hover:text-[#003057]">Convex</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/convex.dev?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Convex" className="w-3 h-3 object-contain opacity-40 group-hover:opacity-100 transition-opacity" />
                            </li>
                            <li className="flex items-center gap-2 group">
                                <a href="https://docusignimpact.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#003057]">DocuSign</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/idRJZsiuYV/w/57/h/57/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1759225919166" alt="DocuSign" className="w-3.5 h-3.5 object-contain opacity-50 group-hover:opacity-100 transition-opacity" />
                            </li>
                            <li className="flex items-center gap-2 group">
                                <a href="https://www.gov.uk/government/organisations/hm-revenue-customs" target="_blank" rel="noopener noreferrer" className="hover:text-[#003057]">HMRC</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-400 text-xs">
                        © {new Date().getFullYear()} Freightcode. All rights reserved.
                    </p>
                </div>
            </div>
      </footer>
    </div>
  );
}
