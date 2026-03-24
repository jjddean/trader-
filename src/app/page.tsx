"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, Sparkle, Plus, Minus, Globe, ShieldCheck, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaitlistForm } from "@/components/waitlist-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

const navigation = [
  { name: "Solutions", href: "/solutions" },
  { name: "Resources", href: "/resources" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

const faqs = [
  {
    question: "What does the beta program include?",
    answer:
      "Beta participants receive full capabilities to securely sync their HMRC data, run automated compliance checks across historical filings, and access our smart duty pre-fill engine.",
  },
  {
    question: "Do you provide legal or customs advice?",
    answer:
      "We provide data-driven insights and automated reporting based on official HMRC rules. While our platform highlights anomalies and potential savings, we recommend consulting with a certified customs practitioner for complex legal interpretations.",
  },
  {
    question: "Is my HMRC data secure?",
    answer:
      "Absolutely. We use direct Government Gateway OAuth connections, meaning we never see or store your HMRC login credentials. All declaration data is end-to-end encrypted both in transit and at rest.",
  },
  {
    question: "Who is this platform built for?",
    answer:
      "freightcode is built for UK freight forwarders, customs brokers, and high-volume importers who want to mitigate CDS compliance risks and optimize their duty spend.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Freightcode",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "description": "Automate your UK customs declarations (HMRC CDS), detect savings, and ensure compliance instantly."
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            }))
          })
        }}
      />
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
              <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                <span className="text-xl font-bold tracking-tight">freight</span>
                <span className="text-xl font-bold tracking-tight text-slate-600">code</span>
                <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
              </div>
              <span className="ml-1.5 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-600">
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
                  onClick={() => document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })}
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

      <main className="pt-[160px]">
        {/* Hero Section */}
        <section className="px-[24px] pb-[80px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-[48px] flex items-center justify-center gap-[8px]">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[#020817] text-white shadow-md shadow-black/20 ring-1 ring-[#020817]/10">
                <ArrowRight className="h-3 w-3 text-white" />
              </div>
              <span className="text-[16px] font-medium tracking-normal text-[#020817]">
                UK Customs Declaration Software
              </span>
            </div>

            <h1 className="mb-6 text-[48px] leading-[48px] font-bold tracking-tight text-[#020817]">
              Complete CDS visibility.
              <br />
              Seamless customs clearance.
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-[20px] leading-[28px] text-slate-700">
              Automate your customs declarations, reduce manual work, avoid costly errors, and ensure you never overpay duties.
            </p>

            <div id="waitlist-form" className="flex flex-col items-center justify-center gap-[16px] sm:flex-row">
              {isSignedIn ? (
                <Link
                  href="/dashboard"
                  className="h-[42px] min-w-[140px] rounded border border-transparent bg-[#111827] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-sm"
                >
                  Open Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              ) : (
                <WaitlistForm />
              )}
            </div>
          </div>
        </section>

        {/* Visibility Hero Banner */}
        <section className="bg-white py-[128px] md:py-[160px]">
          <div className="mx-auto max-w-[1024px] px-[24px] text-center">
             <h2 className="text-[48px] leading-[48px] font-bold tracking-tight text-[#020817] md:text-[52px]">
               Full visibility and control over your customs declarations.
             </h2>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-[64px] text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-[#020817] md:text-[42px]">
                How It Works
              </h2>
              <p className="mx-auto max-w-2xl text-[20px] text-slate-600">
                A simple three-step process to optimize your UK customs strategy and ensure total compliance.
              </p>
            </div>

            <div className="grid gap-[32px] md:grid-cols-3">
              {/* Step 1 */}
              <div className="relative text-center px-[16px]">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[24px] font-bold text-[#1d6fc0]">
                  1
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Connect & Sync</h3>
                <p className="text-[16px] leading-[1.6] text-slate-600">
                  Securely authorize access to your HMRC Government Gateway account. We instantly import and organize your historical CDS declarations.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative text-center px-[16px]">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[24px] font-bold text-[#1d6fc0]">
                  2
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Analyze & Optimize</h3>
                <p className="text-[16px] leading-[1.6] text-slate-600">
                  Our intelligence engine scans every line item, identifying overpaid duties, highlighting missing preference codes, and flagging compliance risks.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative text-center px-[16px]">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[24px] font-bold text-[#1d6fc0]">
                  3
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Execute & Report</h3>
                <p className="text-[16px] leading-[1.6] text-slate-600">
                  Generate optimized declarations, reclaim historical overpayments, and monitor your entire customs portfolio through real-time, shareable dashboards.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid Section */}
        <section id="features" className="bg-gray-50/30 py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-[64px] text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-[#020817] md:text-[42px]">
                Core Capabilities
              </h2>
              <p className="mx-auto max-w-2xl text-[20px] text-slate-600">
                Transform your HMRC data into actionable intelligence. We provide end-to-end oversight of your UK customs obligations.
              </p>
            </div>

            <div className="grid gap-[24px] md:grid-cols-2 lg:grid-cols-3">
              {[
                { 
                  id: 'historical', 
                  label: 'Historical Data Analysis',
                  benefit: 'Ingest and parse years of historical HMRC declarations instantly to identify patterns and track your overall customs performance.',
                  how: 'You forward your HMRC "Report Ready" secure CSVs to your dedicated inbox. Our parsing engine automatically standardizes the raw line items and securely structures your trade history into your private database, saving hours of manual spreadsheet work.'
                },
                { 
                  id: 'savings', 
                  label: 'Automated Savings Detection',
                  benefit: 'Stop leaving money on the table. We identify explicit financial losses and reclamation opportunities across your supply chain.',
                  how: 'Our analytics engine constantly scans your data against global trade agreements. It flags exact instances where a shipment was eligible for a 0% duty preference code, but standard duty was paid instead, calculating exactly how much you can reclaim.'
                },
                { 
                  id: 'prefill', 
                  label: 'Smart Duty Pre-Fill',
                  benefit: 'Draft new declarations in seconds. Remove the guesswork of finding the correct HS Commodity Codes for repetitive shipments.',
                  how: "When you create a new draft, our system analyzes your company's highest-frequency historical shipments. By looking at successful past clearances for that specific origin country, it seamlessly suggests the most accurate, compliant commodity codes and preferences."
                },
                { 
                  id: 'scoring', 
                  label: 'Compliance Health Scoring',
                  benefit: 'Monitor the performance of your appointed brokers and freight forwarders across all your UK ports.',
                  how: 'We generate an immediate, comparative health score by analyzing the ratio of perfect clearances against flagged anomalies. You get a transparent leaderboard showing exactly which external agents are making the most compliance errors on your behalf.'
                },
                { 
                  id: 'hmrc', 
                  label: 'HMRC Data Sync',
                  benefit: 'Maintain a direct, secure, and perpetual connection to your HMRC Government Gateway account.',
                  how: 'Without ever asking for your passwords, we utilize official HMRC OAuth flows to securely link your workspace and EORI number. Our system handles token refreshing automatically, ensuring your dashboard is always synced with your latest Trade Reporting and Extracting (TRE) data.'
                },
                { 
                  id: 'storage', 
                  label: 'Secure Document Vault',
                  benefit: 'Centralize your commercial invoices, packing lists, and clearance evidence in one HMRC-compliant repository.',
                  how: 'Upload and attach critical trade documents directly to your declaration records. We maintain encrypted, redundant cloud storage organized by MRN, making it effortless to retrieve evidence during an unexpected HMRC post-clearance audit.'
                },
              ].map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-sm transition-all hover:shadow-md flex flex-col p-[24px] h-full">
                  <h3 className="mb-2 text-[18px] font-bold text-[#37352f]">{item.label}</h3>
                  <p className="text-[14.5px] leading-[1.6] text-[#5f5e58] flex-grow">
                    {item.benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Guides Section */}
        <section id="ai-guides" className="py-[96px] bg-white border-y border-slate-100">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-[64px] text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-4">
                <Sparkle className="w-4 h-4" /> AI-Powered Search
              </div>
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-[#020817] md:text-[42px]">
                Master Customs Compliance
              </h2>
              <p className="mx-auto max-w-2xl text-[20px] text-slate-600">
                Stop digging through confusing HMRC manuals. Our intelligence engine can instantly answer your questions using our five definitive guides.
              </p>
            </div>

            <div className="grid gap-[24px] md:grid-cols-2 lg:grid-cols-3 justify-center">
              {[
                { title: 'CDS Importer Guide', path: '/hmrc-cds-uk-importers-2026' },
                { title: 'What is TRE?', path: '/what-is-tre-customs-data' },
                { title: 'CDS Notifications', path: '/hmrc-cds-notifications-dmsacc-dmsrog-dmscle' },
                { title: 'Reading TRE Exports', path: '/how-to-read-cds-csv-export-tre' },
                { title: 'Commodity Codes', path: '/cds-commodity-codes-lookup' },
              ].map((guide, i) => (
                <Link key={i} href={`/guides${guide.path}`} className="group p-6 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all bg-white flex flex-col items-start hover:bg-slate-50">
                  <h3 className="text-[18px] font-bold text-[#020817] mb-2 group-hover:text-blue-700 transition-colors">{guide.title}</h3>
                  <span className="text-sm text-slate-500 flex items-center mt-auto font-medium">Read guide <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Free Calculators Promotion section */}
        <section id="resources" className="py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
             <div className="rounded-2xl border border-slate-100 bg-[#0f172a] p-[48px] md:p-[64px] relative overflow-hidden flex flex-col items-center text-center">
                {/* Decorative background elements */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"></div>
                
                <h2 className="mb-6 text-[32px] leading-tight font-bold tracking-tight text-white md:text-[36px] relative z-10">
                  Try our Free Customs Tooling
                </h2>
                <p className="mb-8 text-[18px] leading-[1.6] text-slate-300 max-w-2xl relative z-10">
                   As we are currently in beta, use our suite of standalone intelligent calculators to estimate UK Import Duty, Anti-Dumping tariffs, and Postponed VAT Accounting completely free of charge.
                </p>
                <div className="flex gap-4 relative z-10">
                   <Link href="/tools" className="h-[42px] px-6 rounded-md bg-white text-slate-900 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors">
                      Open Calculators
                   </Link>
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
              <p className="text-[17px] text-slate-600">
                Answers about CDS workflows and platform security.
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
                        openFaq === index ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
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
                    <p className="text-[16px] leading-relaxed text-slate-600">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-[24px] py-[96px]">
          <div className="relative mx-auto max-w-[1024px] overflow-hidden rounded-3xl border border-slate-200 bg-white p-[48px] text-center shadow-lg md:p-[80px]">
            <h2 className="mb-6 text-[40px] leading-tight font-bold text-[#020817] md:text-[52px] tracking-[-1px]">
              Take control of your customs data
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-[18px] text-slate-600">
              Automate your declarations, uncover hidden savings, and ensure total HMRC compliance. 
              Request early access to our platform today.
            </p>
            <div className="flex flex-col items-center justify-center gap-6">
              {isSignedIn ? (
                <Link
                  href="/dashboard/documents"
                  className="h-[42px] min-w-[140px] rounded border border-transparent bg-[#111827] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-sm"
                >
                  Open Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              ) : (
                <div className="relative flex w-full justify-center">
                  <WaitlistForm />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 px-6 bg-white border-t border-gray-200">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-8 mb-16">
                    {/* Logo / About */}
                    <div className="col-span-2 md:col-span-1 -mt-1">
                        <div className="mb-4">
                            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                                <span className="font-bold tracking-tight text-[22px]">freight</span>
                                <span className="font-bold tracking-tight text-[22px] text-slate-600">code</span>
                                <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
                            </div>
                        </div>
                        <p className="text-gray-700 text-xs leading-relaxed">
                            Automate your declarations, uncover hidden savings,<br />and ensure total HMRC compliance.
                        </p>
                        <p className="text-gray-600 text-xs mt-4">
                            London, UK
                            <br />
                            info@freightcode.co.uk
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-[#020817] font-medium text-xs mb-5">Product</h4>
                        <ul className="text-gray-600 text-xs space-y-3">
                            <li><Link href="/solutions" className="hover:text-[#020817] transition-colors">Solutions</Link></li>
                            <li><Link href="/resources" className="hover:text-[#020817] transition-colors">Resources</Link></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-[#020817] font-medium text-xs mb-5">Company</h4>
                        <ul className="text-gray-600 text-xs space-y-3">
                            <li><Link href="/about" className="hover:text-[#020817] transition-colors">About</Link></li>
                            <li><Link href="/contact" className="hover:text-[#020817] transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-[#020817] font-medium text-xs mb-5">Legal</h4>
                        <ul className="text-gray-600 text-xs space-y-3">
                            <li><Link href="/privacy" className="hover:text-[#020817] transition-colors">Privacy</Link></li>
                            <li><Link href="/terms" className="hover:text-[#020817] transition-colors">Terms</Link></li>
                        </ul>
                    </div>

                    {/* Socials */}
                    <div>
                        <h4 className="text-[#020817] font-medium text-xs mb-5">Socials</h4>
                        <ul className="text-gray-600 text-xs space-y-3">
                            <li><a href="https://x.com/freightcode" className="hover:text-[#020817] transition-colors">X</a></li>
                            <li><a href="https://linkedin.com/company/freightcode" className="hover:text-[#020817] transition-colors">LinkedIn</a></li>
                            <li><a href="https://youtube.com/@freightcode" className="hover:text-[#020817] transition-colors">YouTube</a></li>
                        </ul>
                    </div>

                    {/* Security & Trust */}
                    <div>
                        <h4 className="text-[#020817] font-medium text-xs mb-5">Security & Trust</h4>
                        <ul className="text-gray-600 text-xs space-y-3">
                            <li>Secure billing via Stripe</li>
                            <li>Enterprise authentication</li>
                            <li>Encrypted data</li>
                            <li>Activity logging</li>
                        </ul>
                    </div>

                    {/* Trusted Infrastructure & Guides */}
                    <div>
                        <h4 className="text-[#020817] font-medium text-xs mb-5">Trusted Infrastructure</h4>
                        <ul className="text-gray-600 text-xs space-y-3 mb-20">
                            <li className="flex items-center gap-2 group">
                                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#020817] transition-colors">Stripe</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/stripe.com?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Stripe" className="w-3 h-3 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                            </li>
                            <li className="flex items-center gap-2 group">
                                <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#020817] transition-colors">Clerk</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/clerk.com?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Clerk" className="w-3 h-3 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                            </li>
                            <li className="flex items-center gap-2 group">
                                <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className="hover:text-[#020817] transition-colors">Convex</a>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://cdn.brandfetch.io/convex.dev?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Convex" className="w-3 h-3 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                            </li>
                        </ul>

                        <h4 className="text-[#020817] font-medium text-xs mb-5">Guides</h4>
                        <ul className="text-gray-600 text-xs space-y-3">
                            <li><Link href="/guides/hmrc-cds-uk-importers-2026" className="hover:text-[#020817] transition-colors">CDS Importer Guide</Link></li>
                            <li><Link href="/guides/what-is-tre-customs-data" className="hover:text-[#020817] transition-colors">What is TRE?</Link></li>
                            <li><Link href="/guides/hmrc-cds-notifications-dmsacc-dmsrog-dmscle" className="hover:text-[#020817] transition-colors">CDS Notifications</Link></li>
                            <li><Link href="/guides/how-to-read-cds-csv-export-tre" className="hover:text-[#020817] transition-colors">Reading TRE Exports</Link></li>
                            <li><Link href="/guides/cds-commodity-codes-lookup" className="hover:text-[#020817] transition-colors">Commodity Codes</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-600 text-xs">
                        © {new Date().getFullYear()} Freightcode. All rights reserved.
                    </p>
                    <div className="opacity-100 transition-opacity flex items-center">
                      {!isSignedIn && (
                        <SignInButton mode="modal">
                          <button className="text-[10px] text-gray-600 hover:text-gray-700 uppercase tracking-widest cursor-pointer">
                            Admin Login
                          </button>
                        </SignInButton>
                      )}
                    </div>
                </div>
            </div>
      </footer>
    </div>
  );
}
