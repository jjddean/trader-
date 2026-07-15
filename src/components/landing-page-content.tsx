"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { SignUpCta } from "@/components/sign-up-cta";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WaitlistForm } from "@/components/waitlist-form";
import { HomeDashboardPreview } from "@/components/home-dashboard-preview";

const landingGuideCard = "rounded-2xl border border-slate-200 bg-white p-8";

const howItWorksSteps = [
  {
    step: 1,
    title: "Build your declaration",
    body: "Upload commercial invoices to extract line items automatically, or add goods manually. Use HS lookup, attach documents, and capture EORI, valuation, and payment details — you review before submit.",
  },
  {
    step: 2,
    title: "Validate with dry-run",
    body: "Run pre-submit checks against CDS rules and schema before any HMRC call. Fix field errors and document gaps while the declaration is still a draft.",
  },
  {
    step: 3,
    title: "Submit and track",
    body: "Connect HMRC via OAuth, submit to CDS (or TDR in practice mode), then follow status and DMS notifications. Amend or cancel where HMRC allows.",
  },
];

const coreCapabilities = [
  {
    id: "declarations",
    label: "Declaration workspace",
    benefit:
      "Create and edit import declarations with goods items, documents, dry-run, submit, amend, and cancel through HMRC CDS APIs.",
  },
  {
    id: "hmrc",
    label: "HMRC OAuth",
    benefit:
      "Connect in Settings to authorise submit and status. Practice orgs use HMRC Test User credentials; live orgs use Government Gateway.",
  },
  {
    id: "prefill",
    label: "HS lookup & invoice extract",
    benefit:
      "Look up commodity codes and apply them to line items. Upload commercial invoices to pre-fill goods fields — you review before submit.",
  },
  {
    id: "estimates",
    label: "Duty estimates",
    benefit:
      "Pre-clearance duty and VAT estimates from Trade Tariff data on your draft. HMRC DMSTAX still overrides on acceptance.",
  },
  {
    id: "notifications",
    label: "Status & notifications",
    benefit:
      "Pull HMRC notifications and map DMS codes to declaration status. Webhook receiver for push events when configured.",
  },
  {
    id: "storage",
    label: "Document vault",
    benefit:
      "Attach invoices and supporting documents to declarations. Organised by MRN for audit retrieval.",
  },
];

const trePillars = [
  {
    title: "Export from HMRC TRE",
    body: "Request CSV reports in HMRC\u2019s Trade Reporting service \u2014 the same data brokers used to buy from third parties.",
  },
  {
    title: "Upload & review",
    body: "Import CSVs in your org workspace \u2014 preview columns, confirm import, and browse stored line items without Excel gymnastics.",
  },
  {
    title: "Review opportunities",
    body: "Flag possible preference or duty mismatches for review with your customs adviser \u2014 indicative hints, not automatic reclaim filing.",
  },
];

const financialControlPoints = [
  {
    title: "Estimate before clearance",
    body: "Model duty, import VAT, and landed cost from Trade Tariff measures before submitting your declaration.",
  },
  {
    title: "Confirm against HMRC",
    body: "Keep estimated amounts separate from HMRC-confirmed duty and VAT when DMSTAX notifications arrive.",
  },
  {
    title: "Keep records by MRN",
    body: "Review A00 duty and B00 import VAT lines with their source, payment context, and exportable declaration record.",
  },
];

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
            "description": "Customs & Trade Compliance OS for UK importers — draft CDS declarations, dry-run validate, submit via HMRC OAuth, and track DMS notifications in one workspace."
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
                Customs & Trade Compliance OS
              </span>
            </div>

            <h1 className="mb-3 text-[34px] font-bold leading-[1.1] tracking-tight text-[#020817] md:text-[44px]">
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
          </div>
        </section>
        {/* How It Works Section */}
        <section id="how-it-works" className="py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900">How It Works</h2>
              <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
                Three steps from draft declaration to HMRC acceptance — with validation and document support built in.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {howItWorksSteps.map((item) => (
                <div key={item.step} className={landingGuideCard}>
                  <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
                    Step {item.step}
                  </p>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid Section */}
        <section id="features" className="bg-gray-50/30 py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900">Core Capabilities</h2>
              <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
                Build and submit UK import declarations through HMRC CDS — with duty estimates, documents, and status tracking.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {coreCapabilities.map((item) => (
                <div key={item.id} className={`${landingGuideCard} flex h-full flex-col`}>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">{item.label}</h3>
                  <p className="flex-grow text-[15px] leading-relaxed text-slate-600">{item.benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Financial control — one focused section within the wider customs workflow. */}
        <section id="financial-control" className="bg-white py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="overflow-hidden rounded-2xl bg-[#0f172a] px-8 py-10 text-white md:px-12 md:py-14">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
                <div>
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                    Financial control
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight">
                    Understand customs costs before and after clearance.
                  </h2>
                  <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
                    Connect estimates, HMRC assessments, and financial records to the same declaration so every
                    amount keeps its source and MRN context.
                  </p>
                  <Link
                    href="/tools"
                    className="mt-6 inline-flex items-center text-sm font-semibold text-white hover:text-blue-200"
                  >
                    Try duty and VAT estimates <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {financialControlPoints.map((item) => (
                    <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                      <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRE Data Analysis Section */}
        <section id="tre-analysis" className="bg-white py-[96px]">
          <div className="mx-auto max-w-[1280px] px-[24px]">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
                Import and review declaration history from HMRC TRE
              </h2>
              <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
                HMRC Trade Reporting gives you CSV exports of past declarations. Upload them in Import TRE to browse line items, run preference checks, and keep history next to new declarations.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {trePillars.map((item) => (
                <div key={item.title} className={landingGuideCard}>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link href="/guides/what-is-tre-hmrc-trade-data" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700">
                Learn more about HMRC TRE Data <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>


        {/* Pre-clearance financial tools */}
        <section id="resources" className="py-[96px]">
          <div className="mx-auto max-w-[768px] px-[24px]">
            <div className="rounded-2xl bg-[#0f172a] p-8 text-white">
              <h2 className="mb-3 text-[18px] font-semibold">Pre-clearance duty and VAT estimates</h2>
              <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
                Estimate duty, VAT, and landed cost from Trade Tariff data before you file. Look up commodity codes and model PVA cashflow — the same logic used in your declaration workspace. HMRC-confirmed amounts always override on acceptance.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/hs-code-lookup"
                  className="inline-flex items-center rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                >
                  HS Code Lookup
                </Link>
                <Link
                  href="/tools"
                  className="inline-flex items-center rounded-md bg-slate-700 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-600"
                >
                  Duty &amp; VAT estimates
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

            <div className="space-y-8">
              {faqs.map((faq) => (
                <div key={faq.question} className="border-b border-slate-200 pb-8 last:border-0 last:pb-0">
                  <h3 className="mb-2 text-[16px] font-bold text-slate-900">{faq.question}</h3>
                  <p className="text-[16px] leading-relaxed text-slate-600">{faq.answer}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-2xl bg-[#0f172a] p-8 text-white">
              <h3 className="mb-3 text-[18px] font-semibold">Sign up for beta access</h3>
              <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
                Leave your work email and we&apos;ll reach out when a spot opens up.
              </p>
              <WaitlistForm variant="card" />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
