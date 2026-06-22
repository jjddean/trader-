import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mb-12 text-sm text-slate-500">Last updated: 13 February 2026</p>

        <div className="prose prose-slate max-w-none text-slate-600">
          <p>
            This Privacy Policy explains how freightcode® ("we", "us", "our") processes personal and corporate data when you utilize our platform to manage, audit, and execute UK customs declarations via HMRC's Customs Declarations Service (CDS).
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">1. Information We Collect</h2>
          <p>To provide our analytics and automation tools, we collect and process:</p>
          <ul className="list-disc pl-6">
            <li><strong>Account & Identity Data:</strong> Name, work email address, company details, EORI numbers.</li>
            <li><strong>Customs & Trade Data:</strong> Historical HMRC "Report Ready" CSVs, commercial invoices (PDFs), HS commodity codes, and active CDS declarations.</li>
            <li><strong>Authentication Data:</strong> OAuth tokens required to maintain secure connections with your HMRC Government Gateway account.</li>
            <li><strong>Financial Data:</strong> Metadata related to duty and VAT payments routed through our Open Banking integration partners.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">2. AI Processing & Invoice Extraction</h2>
          <p>
            When you upload commercial invoices or forward HMRC reports, our AI extraction engine parses this documentation to enable our "Smart Duty Pre-Fill" capabilities. We do not use your proprietary invoice data or historical shipment pricing to train generalized public AI models. Data is strictly siloed and processed solely to accelerate your specific clearance workflows.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">3. How We Use Information</h2>
          <p>We use the processed information strictly to:</p>
          <ul className="list-disc pl-6">
            <li>Generate compliance scorecards and historical savings analytics.</li>
            <li>Draft, pre-fill, and securely submit customs payloads to HMRC.</li>
            <li>Monitor duty deferment accounts and alert on HMRC credit limits.</li>
            <li>Authenticate users and maintain our system's audit trails.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">4. Sharing of Information</h2>
          <p>We never sell your trade data. Information is only shared securely with:</p>
          <ul className="list-disc pl-6">
            <li><strong>HMRC:</strong> as directly authorized by you for the purpose of executing declarations and retrieving historical analytics.</li>
            <li><strong>Open Banking Partners:</strong> (e.g., TrueLayer, Stripe Connect) exclusively for routing required direct duty payments.</li>
            <li><strong>Secure Infrastructure Providers:</strong> to host and operate the freightcode® application.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">5. Data Retention & Security</h2>
          <p>
            Given the sensitive nature of international trade data, we encrypt all declaration and authentication data both in-transit and at-rest. We retain data only as long as necessary to provide our services and satisfy ongoing HMRC auditing requirements.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">6. Your Rights</h2>
          <p>
            You retain the right to access, export, or delete your data from the freightcode® platform. Signed-in users
            can download a JSON export from{" "}
            <a href="/dashboard/settings?tab=privacy" className="text-blue-600 hover:underline">
              Settings → Privacy → Export my data
            </a>
            . Revoking our OAuth access to your HMRC account immediately ceases any future data syncing. To request
            account deletion, contact us at:{" "}
            <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:underline">info@freightcode.co.uk</a>
          </p>
        </div>
      </div>
    </div>
  );
}
