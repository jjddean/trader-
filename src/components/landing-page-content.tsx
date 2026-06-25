"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignUpCta } from "@/components/sign-up-cta";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HomeDashboardPreview } from "@/components/home-dashboard-preview";

const faqs = [
  {
    question: "What does the beta program include?",
    answer:
      "Beta participants can practise in HMRC TDR, build and submit CDS declarations, run dry-run validation, connect via OAuth, and use HS lookup and invoice extraction on goods items.",
  },
  {
    question: "Do you provide legal or customs advice?",
    answer:
      "We provide data-driven insights and reporting based on official HMRC rules. While the platform highlights anomalies and potential savings, we recommend consulting with a certified customs practitioner for complex legal interpretations.",
  },
  {
    question: "Is my HMRC data secure?",
    answer:
      "We use official HMRC OAuth — we never store your HMRC password. In practice mode you sign in with an HMRC Test User; on live CDS, with your Government Gateway. Declaration data is encrypted in transit and at rest.",
  },
  {
    question: "Who is this platform built for?",
    answer:
      "freightcode is built for UK freight forwarders, customs brokers, and high-volume importers who want to mitigate CDS compliance risks and optimize their duty spend.",
  },
];

export function LandingPageContent() {
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
            "description": "UK customs declaration software for HMRC CDS — build, validate, and submit declarations with duty estimates and compliance tooling."
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

      <main className="pt-[120px]">
        {/* Hero Section */}
        <section className="px-[24px] pb-[28px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-[24px] flex items-center justify-center gap-[8px]">
              <div className="flex h-5 w-5 items-center justify-center">
                <span className="text-[18px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">🛃</span>
              </div>
              <span className="text-[16px] font-medium tracking-normal text-[#020817]">
                UK Customs Declaration Software
              </span>
            </div>

            <h1 className="mb-3 text-[34px] md:text-[44px] font-bold tracking-tight leading-[1.1] text-[#020817]">
              Full control of your customs
              <br />
              declarations, duties, and compliance.
            </h1>

            <p className="mx-auto mb-6 max-w-[760px] text-[18px] leading-[1.6] text-slate-600">
              Draft UK import declarations, run dry-run validation, connect to HMRC CDS, and track status and notifications — in one workspace. Practice in TDR before you go live.
            </p>

            <div id="signup-cta" className="flex flex-col items-center justify-center gap-[16px] sm:flex-row">
              {isSignedIn ? (
                <Link
                  href="/dashboard"
                  className="h-[42px] min-w-[140px] rounded-md bg-[#111827] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-[#374151] shadow-none border-none"
                >
                  Open Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              ) : (
                <SignUpCta />
              )}
            </div>
          </div>
        </section>

        <section className="bg-white px-[24px] pb-[72px]">
          <div className="mx-auto max-w-[1200px] text-center">
            <HomeDashboardPreview />
            <div className="mx-auto mt-36 max-w-[900px]">
              <h2 className="text-[34px] leading-[1.06] font-bold tracking-tight text-[#020817] md:text-[44px]">
                Build declarations. Validate before submit. Stay audit-ready.
              </h2>
              <p className="mx-auto mt-4 max-w-[760px] text-[18px] leading-[1.6] text-slate-600">
                Create goods items with HS lookup and invoice extraction, pre-check XML with dry-run, submit to HMRC CDS, and keep documents and notification history with each declaration.
              </p>
            </div>
          </div>
        </section>

        {/* Stats + Audience Strip */}
        <section className="border-y border-gray-100 bg-gray-50/50 py-28">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-16">
              <div className="text-center">
                <p className="text-[24px] font-bold tracking-tight text-[#020817]">£4.8bn</p>
                <p className="mt-1 text-[13px] text-slate-500">UK customs duty paid annually</p>
              </div>
              <div className="hidden h-8 w-px bg-gray-200 sm:block" />
              <div className="text-center">
                <p className="text-[24px] font-bold tracking-tight text-[#020817]">3 years</p>
                <p className="mt-1 text-[13px] text-slate-500">Typical HMRC window to review overpaid duty</p>
              </div>
              <div className="hidden h-8 w-px bg-gray-200 sm:block" />
              <div className="text-center">
                <p className="text-[24px] font-bold tracking-tight text-[#020817]">28 Mar 2026</p>
                <p className="mt-1 text-[13px] text-slate-500">CDS 5.1.0 enforcement live</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-[64px] text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight text-[#020817] md:text-[42px]">
                How It Works
              </h2>
              <p className="mx-auto max-w-2xl text-[18px] leading-[1.6] text-slate-600">
                Three steps from draft declaration to HMRC acceptance — with validation and document support built in.
              </p>
            </div>

            <div className="grid gap-[32px] md:grid-cols-3">
              {/* Step 1 */}
              <div className="relative text-center px-[16px]">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[24px] font-bold text-[#1d6fc0]">
                  1
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Build your declaration</h3>
                <p className="text-[16px] leading-[1.6] text-slate-600">
                  Add goods items manually or from invoice PDFs. Use HS lookup, attach documents, and capture EORI, valuation, and payment details on the form.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative text-center px-[16px]">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[24px] font-bold text-[#1d6fc0]">
                  2
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Validate with dry-run</h3>
                <p className="text-[16px] leading-[1.6] text-slate-600">
                  Run pre-submit checks against CDS rules and schema before any HMRC call. Fix field errors and document gaps while the declaration is still a draft.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative text-center px-[16px]">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[24px] font-bold text-[#1d6fc0]">
                  3
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Submit and track</h3>
                <p className="text-[16px] leading-[1.6] text-slate-600">
                  Connect HMRC via OAuth, submit to CDS (or TDR in practice mode), then follow status and DMS notifications. Amend or cancel where HMRC allows.
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
                What&apos;s in the product today
              </h2>
              <p className="mx-auto max-w-2xl text-[18px] leading-[1.6] text-slate-600">
                CDS declaration workspace with validation, HMRC connectivity, documents, duty estimates, and TRE CSV import for declaration history.
              </p>
            </div>

            <div className="grid gap-[24px] md:grid-cols-2 lg:grid-cols-3">
              {[
                { 
                  id: 'declarations', 
                  label: 'Declaration workspace',
                  benefit: 'Create and edit import declarations with goods items, documents, dry-run, submit, amend, and cancel through HMRC CDS APIs.',
                },
                { 
                  id: 'hmrc', 
                  label: 'HMRC OAuth',
                  benefit: 'Connect in Settings to authorise submit and status. Practice orgs use HMRC Test User credentials; live orgs use Government Gateway.',
                },
                { 
                  id: 'prefill', 
                  label: 'HS lookup & invoice extract',
                  benefit: 'Look up commodity codes and apply them to line items. Upload commercial invoices to pre-fill goods fields — you review before submit.',
                },
                { 
                  id: 'estimates', 
                  label: 'Duty estimates',
                  benefit: 'Pre-clearance duty and VAT estimates from Trade Tariff data on your draft. HMRC DMSTAX still overrides on acceptance.',
                },
                { 
                  id: 'notifications', 
                  label: 'Status & notifications',
                  benefit: 'Pull HMRC notifications and map DMS codes to declaration status. Webhook receiver for push events when configured.',
                },
                { 
                  id: 'storage', 
                  label: 'Document vault',
                  benefit: 'Attach invoices and supporting documents to declarations. Organised by MRN for audit retrieval.',
                },
                { 
                  id: 'historical', 
                  label: 'TRE CSV import',
                  benefit: 'Upload HMRC TRE Item Report CSVs in Import TRE. Line items are org-scoped, deduplicated, and available in reports alongside new declarations.',
                },
                { 
                  id: 'savings', 
                  label: 'Preference opportunities',
                  benefit: 'After a TRE import, scan history for lines where a preferential duty rate may have applied. Indicative flags for review — not reclaim filing.',
                },
                { 
                  id: 'practice', 
                  label: 'Practice mode (TDR)',
                  benefit: 'New orgs start in sandbox TDR. Submissions are not legally binding; use real EORI on forms and Test User at Connect.',
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
        {/* TRE Data Analysis Section */}
        <section id="tre-analysis" className="py-[96px] bg-white">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-[64px] text-center">
              <h2 className="mb-4 text-[36px] font-bold tracking-tight leading-[1.15] text-[#020817] md:text-[42px]">
                HMRC TRE data — export yourself,
                <br />
                analyse in Freightcode
              </h2>
              <p className="mx-auto max-w-2xl text-[18px] leading-[1.6] text-slate-600">
                From 31 March 2026, TRE is HMRC&apos;s route to your declaration reports. OAuth connects CDS submit — it does not bulk-download TRE history. Export CSV from HMRC, then upload in <Link href="/dashboard/tre-import" className="font-medium text-blue-600 hover:text-blue-700">Import TRE</Link> to review line items next to new declarations.
              </p>
            </div>

            <div className="grid gap-[32px] md:grid-cols-3">
              {/* Pillar 1 */}
              <div className="rounded-2xl border border-[#e9e9e7] bg-gray-50/50 p-8 transition-all hover:bg-white hover:shadow-lg">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-[#111827] text-white">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Export from HMRC TRE</h3>
                <p className="text-[15px] leading-[1.6] text-slate-600">
                  Request CSV reports in HMRC&apos;s Trade Reporting service — the same data brokers used to buy from third parties.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-2xl border border-[#e9e9e7] bg-gray-50/50 p-8 transition-all hover:bg-white hover:shadow-lg">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-[#111827] text-white">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Upload & review</h3>
                <p className="text-[15px] leading-[1.6] text-slate-600">
                  Import CSVs in your org workspace — preview columns, confirm import, and browse stored line items without Excel gymnastics.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-2xl border border-[#e9e9e7] bg-gray-50/50 p-8 transition-all hover:bg-white hover:shadow-lg">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-[#111827] text-white">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <h3 className="mb-3 text-[20px] font-bold text-[#020817]">Review opportunities</h3>
                <p className="text-[15px] leading-[1.6] text-slate-600">
                  Flag possible preference or duty mismatches for review with your customs adviser — indicative hints, not automatic reclaim filing.
                </p>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-center">
              <Link href="/guides/what-is-tre-hmrc-trade-data" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700">
                Learn more about HMRC TRE Data <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/dashboard/tre-import" className="inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900">
                Go to Import TRE <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
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
                <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full justify-center px-6 sm:px-0">
                   <Link href="/hs-code-lookup" className="h-[42px] px-6 rounded-md bg-white text-slate-900 text-[14px] font-medium flex items-center justify-center hover:bg-slate-100 transition-colors w-full sm:w-auto">
                      Try HS Code Lookup
                   </Link>
                   <Link href="/tools" className="h-[42px] px-6 rounded-md border border-white/20 text-white text-[14px] font-medium flex items-center justify-center hover:bg-white/10 transition-colors w-full sm:w-auto">
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
      </main>

      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
