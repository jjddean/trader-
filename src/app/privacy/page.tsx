import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mb-12 text-sm text-slate-500">Last updated: 13 February 2026</p>

        <div className="prose prose-slate max-w-none text-slate-600">
          <p>
            This Privacy Policy explains how Freightcode (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) processes personal data when you use our software to interact with HMRC services, including the Customs Declarations Service (CDS).
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">1. Who We Are</h2>
          <p>
            Freightcode is a software service that enables authorised users to submit customs declarations and related information to HMRC.
          </p>
          <p>
            For privacy enquiries, contact:<br />
            Email: <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:underline">info@freightcode.co.uk</a>
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">2. Information We Process</h2>
          <p>When you use our software, we may process:</p>
          <ul className="list-disc pl-6">
            <li>Name and contact details (such as email address)</li>
            <li>Company and organisation details</li>
            <li>EORI number</li>
            <li>Customs declaration data submitted by you</li>
            <li>Transaction records and submission results</li>
            <li>Technical information such as IP address, timestamps and system logs</li>
          </ul>
          <p>We only process data necessary to provide our services.</p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">3. How We Use Information</h2>
          <p>We use the information to:</p>
          <ul className="list-disc pl-6">
            <li>Authenticate users</li>
            <li>Submit declarations and related data to HMRC on your instruction</li>
            <li>Retrieve responses from HMRC</li>
            <li>Maintain audit logs</li>
            <li>Provide support and troubleshoot issues</li>
            <li>Comply with legal and regulatory requirements</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">4. Sharing of Information</h2>
          <p>We do not sell personal data.</p>
          <p>We may share information with:</p>
          <ul className="list-disc pl-6">
            <li>HMRC, where required to deliver the service</li>
            <li>Hosting and infrastructure providers that support operation of the software</li>
            <li>Legal or regulatory authorities where required by law</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">5. Data Retention</h2>
          <p>We retain personal data only for as long as necessary to:</p>
          <ul className="list-disc pl-6">
            <li>Provide our services</li>
            <li>Maintain required audit records</li>
            <li>Meet legal and compliance obligations</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">6. Data Security</h2>
          <p>
            We implement appropriate technical and organisational measures to protect personal data against unauthorised access, loss, or misuse.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">7. Your Rights</h2>
          <p>
            Depending on applicable law, you may have rights to access, correct, or request deletion of your personal data.
          </p>
          <p>
            To exercise these rights, contact us at: <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:underline">info@freightcode.co.uk</a>
          </p>
        </div>
      </div>
    </div>
  );
}
