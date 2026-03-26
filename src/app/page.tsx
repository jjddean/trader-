"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, Sparkle, Plus, Minus, Globe, ShieldCheck, Users, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaitlistForm } from "@/components/waitlist-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HSCodeLookup } from "@/components/tools/HSCodeLookup";
import { Search, Loader2, AlertCircle } from 'lucide-react';

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
      <SiteHeader />

      <main className="pt-[160px]">
        {/* Hero Section */}
        <section className="px-[24px] pb-[80px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-[48px] flex items-center justify-center gap-[8px]">
              <div className="flex h-5 w-5 items-center justify-center">
                <span className="text-[18px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">🛃</span>
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
                  className="h-[42px] min-w-[140px] rounded-md bg-[#111827] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-none border-none"
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
                   <Link href="/hs-code-lookup" className="h-[42px] px-6 rounded-md bg-white text-slate-900 text-[14px] font-medium flex items-center justify-center hover:bg-slate-100 transition-colors">
                      Try HS Code Lookup
                   </Link>
                   <Link href="/tools" className="h-[42px] px-6 rounded-md border border-white/20 text-white text-[14px] font-medium flex items-center justify-center hover:bg-white/10 transition-colors">
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
                  className="h-[42px] min-w-[140px] rounded-md bg-[#111827] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-none border-none"
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

      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
