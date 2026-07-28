"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { SignUpCta } from "@/components/sign-up-cta";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HomeDashboardPreview } from "@/components/home-dashboard-preview";

const landingGuideCard = "rounded-2xl border border-slate-200 bg-white p-8";

const howItWorksSteps = [
  {
    step: 1,
    title: "Build your declaration",
    body: "Upload commercial invoices for AI line-item extract, or add goods manually. Use HS lookup, attach documents, and capture EORI, valuation, and payment details — you review before submit.",
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

const tradeComplianceSteps = [
  {
    step: 1,
    title: "Export controls",
    body: "Open an assessment per shipment and attach it to your CDS workspace. Upload invoices and specifications; AI extracts product names, technical detail, parties, and destination as facts for review. Attach datasheets and other evidence so the case holds what ECJU expects to see.",
  },
  {
    step: 2,
    title: "Classification",
    body: "AI proposes candidate control entries against the UK Strategic Export Control Lists, with confidence. A human in the loop will then approve or override on the assessment — nothing is treated as cleared automatically.",
  },
  {
    step: 3,
    title: "Sanctions & screening",
    body: "Buyers, consignees, end users, and other parties are screened against the UK Sanctions List with rule-based name matching. Probable hits stay in review until someone confirms or dismisses them, with a note on the assessment.",
  },
  {
    step: 4,
    title: "Licence management",
    body: "Send a secure EUSU link for the overseas party to complete online. Assemble a licence draft pack — application fields, undertaking, evidence, and LITE / SPIRE / OTSI routing — then record the GOV.UK application reference and licence number when issued.",
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
      "Look up commodity codes and apply them to line items. AI extracts goods fields from commercial invoices — you review before submit.",
  },
  {
    id: "estimates",
    label: "Duty estimates",
    benefit:
      "Pre-clearance duty and VAT calculated from Trade Tariff data on your draft. HMRC DMSTAX still overrides on acceptance.",
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
    body: "Flag possible preference or duty mismatches from Trade Tariff rules for review with your customs adviser \u2014 indicative hints, not automatic reclaim filing.",
  },
];

const financialControlSteps = [
  {
    step: 1,
    title: "Know the cost before clearance",
    body: "Duty, import VAT, and landed cost calculated from Trade Tariff measures on each declaration before you submit — so cash need is visible early.",
  },
  {
    step: 2,
    title: "Separate estimate from HMRC charge",
    body: "When HMRC confirms duty and VAT, those amounts stay distinct from the estimate. Every figure keeps its source.",
  },
  {
    step: 3,
    title: "One record per clearance",
    body: "Duty and import VAT lines sit on the MRN with payment context — exportable for audit, reconciliation, and review.",
  },
  {
    step: 4,
    title: "Cleared import liability",
    body: "Each MRN carries HMRC-confirmed duty, VAT, and customs value after clearance — structured fiscal data for cashflow, reconciliation, and external review.",
  },
];

const faqs = [
  {
    question: "What can I do with CDS in freightcode?",
    answer:
      "Draft UK import declarations, attach documents, run dry-run validation, connect via HMRC OAuth, submit to CDS, then track status and DMS notifications. Amend or cancel where HMRC allows. Practice in TDR before you go live.",
  },
  {
    question: "How does freightcode reduce declaration risk before submit?",
    answer:
      "Dry-run checks against CDS rules and schema while the declaration is still a draft, so field errors and document gaps can be fixed before any HMRC call. You review every line — including HS codes and AI invoice extract — before submit.",
  },
  {
    question: "What value do I get beyond filing?",
    answer:
      "Pre-clearance duty and VAT from Trade Tariff data, documents organised by MRN, financial records that separate estimate from HMRC-confirmed charge, and UK export-control assessments with AI-assisted classification (human approve), sanctions, EUSU, and licence draft pack next to the same workspace.",
  },
  {
    question: "How does HMRC access work?",
    answer:
      "Official HMRC OAuth only — we never store your HMRC password. Practice orgs use an HMRC Test User; live orgs use Government Gateway. Tokens refresh in session; declaration data is encrypted in transit and at rest.",
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
            "name": "freightcode",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "description": "Customs & Trade Compliance OS for UK importers and exporters — draft CDS declarations, dry-run validate, submit via HMRC OAuth, track DMS notifications, and run export-control assessments in one workspace."
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
              Draft UK import declarations, run dry-run validation, connect to HMRC CDS, and track status and
              notifications. Test in a sandbox environment before you go live.
            </p>

            <div id="signup-cta" className="flex flex-col items-center justify-center gap-[16px] sm:flex-row">
              {isSignedIn ? (
                <Link
                  href="/dashboard"
                  className="h-[42px] min-w-[140px] rounded-md bg-[#0f172a] px-[24px] flex items-center justify-center text-[14px] font-medium text-white transition-all hover:bg-[#1e293b] shadow-none border-none"
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
          <div className="mx-auto max-w-3xl px-[24px]">
            <div className="mb-10 text-center">
              <h2 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
                Customs declarations
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-600">
                Three steps from draft declaration to HMRC acceptance — with validation and document support built
                in.
              </p>
            </div>

            <h3 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">How it works</h3>
            <ul className="mb-6 space-y-4 text-[15px] text-slate-700">
              {howItWorksSteps.map((item) => (
                <li key={item.step}>
                  <strong>
                    {item.step}. {item.title}
                  </strong>{" "}
                  — {item.body}
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl bg-[#0f172a] p-8 text-white md:p-10">
              <h3 className="mb-3 text-[18px] font-semibold">About HMRC CDS</h3>
              <p className="mb-4 text-[14px] leading-relaxed text-slate-300">
                The Customs Declaration Service (CDS) is HMRC&apos;s platform for processing UK import and export
                declarations. freightcode connects directly using HMRC&apos;s official OAuth authentication, allowing
                you to prepare, validate and submit declarations from a single workspace while maintaining MRNs,
                supporting documents and declaration history in one auditable record.
              </p>
              <p className="text-[14px] leading-relaxed text-slate-300">
                Validate your declarations in HMRC&apos;s Trader Dress Rehearsal (TDR) environment before moving to
                production. For live declarations, all customs duty, VAT and other charges are calculated and
                confirmed by HMRC, with those values taking precedence over any pre-submission estimates.
              </p>
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

        {/* UK export controls — homepage overview; depth on /solutions/export-controls */}
        <section id="trade-compliance" className="scroll-mt-20 bg-slate-50/50 py-[96px]">
          <div className="mx-auto max-w-3xl px-[24px]">
            <div className="mb-10 text-center">
              <h2 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
                Trade compliance
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-600">
                Strategic and dual-use exports need classification, sanctions screening, an end-user undertaking,
                and evidence before a LITE or SPIRE application — on one assessment next to your CDS declarations.
              </p>
            </div>

            <h3 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">How it works</h3>
            <ul className="mb-6 space-y-4 text-[15px] text-slate-700">
              {tradeComplianceSteps.map((item) => (
                <li key={item.step}>
                  <strong>
                    {item.step}. {item.title}
                  </strong>{" "}
                  — {item.body}
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl bg-[#0f172a] p-8 text-white md:p-10">
              <h3 className="mb-3 text-[18px] font-semibold">Export Controls Consultancy</h3>
              <p className="mb-4 text-[14px] leading-relaxed text-slate-300">
                Our independent consultants review classifications, assess licensing needs, and give a documented
                compliance opinion. Where required, they can own the licensing process — prepare the pack, submit to
                the authority, and manage the application through to a decision.
              </p>
              <p className="text-[14px] leading-relaxed text-slate-300">
                Extra assurance on complex or high-risk exports: lower risk of misclassification, licensing errors,
                and delays — plus a documented record for governance, customer due diligence, and regulatory
                enquiries. Work starts from a secure review link to the draft pack on your assessment.
              </p>
            </div>
            <p className="mt-6 text-center">
              <Link
                href="/solutions/export-controls"
                className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Full product overview <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </p>
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
              <Link href="/solutions#tre" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700">
                TRE trade data on Solutions <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Financial control */}
        <section id="financial-control" className="bg-slate-50/50 py-[96px]">
          <div className="mx-auto max-w-3xl px-[24px]">
            <div className="mb-10 text-center">
              <h2 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
                Financial control
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-600">
                Know what duty and VAT will cost before you clear, then prove what HMRC charged — on the same MRN,
                with a record you can stand behind in review.
              </p>
            </div>

            <h3 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">How it works</h3>
            <ul className="mb-6 space-y-4 text-[15px] text-slate-700">
              {financialControlSteps.map((item) => (
                <li key={item.step}>
                  <strong>
                    {item.step}. {item.title}
                  </strong>{" "}
                  — {item.body}
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl bg-[#0f172a] p-8 text-white md:p-10">
              <h3 className="mb-3 text-[18px] font-semibold">Pre-clearance duty and VAT estimates</h3>
              <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
                Duty, VAT, and landed cost calculated from Trade Tariff data before you file. Look up
                commodity codes and model PVA cashflow — the same logic used in your declaration workspace.
                HMRC-confirmed amounts always override on acceptance.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/hs-code-lookup"
                  className="inline-flex items-center rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                >
                  HS Code Lookup
                </Link>
                <Link
                  href="/solutions/financial-control"
                  className="inline-flex items-center rounded-md bg-slate-700 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-600"
                >
                  Duty &amp; VAT estimates
                </Link>
              </div>
            </div>
            <p className="mt-6 text-center">
              <Link
                href="/solutions/financial-control"
                className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Full product overview <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </p>
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
                Answers about CDS workflows and what you get in the workspace.
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

            <div className="mt-24 flex justify-center md:mt-32">
              <div className="w-full max-w-xl rounded-2xl bg-[#0f172a] p-8 text-center text-white md:p-10">
                {isSignedIn ? (
                  <>
                    <h3 className="mb-3 text-[18px] font-semibold">Continue in your workspace</h3>
                    <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
                      Open the dashboard to pick up declarations, compliance, and financial records.
                    </p>
                    <Link
                      href="/dashboard"
                      className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-md bg-white px-6 text-[14px] font-medium text-slate-900 hover:bg-slate-50"
                    >
                      Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </>
                ) : (
                  <>
                    <h3 className="mb-3 text-[18px] font-semibold">Create an account</h3>
                    <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
                      Sign up to start, or sign in if you already have access.
                    </p>
                    <div className="flex justify-center">
                      <SignUpCta variant="light" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
