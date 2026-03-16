import React from "react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
        <p className="mb-12 text-sm text-slate-500">Last updated: 13 February 2026</p>

        <div className="prose prose-slate max-w-none text-slate-600">
          <p>
            These Terms of Service govern your access to and use of Freightcode software and related services. By using the service, you agree to these terms.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">1. Use of the Service</h2>
          <p>
            You may use the service only for lawful business purposes and in accordance with applicable customs, trade, and data protection laws.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">2. Account Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activity conducted through your account.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">3. Data and Submissions</h2>
          <p>
            You are responsible for the accuracy and legality of all information submitted through the platform, including declaration and shipment data.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">4. Availability and Changes</h2>
          <p>
            We may update, improve, or modify the service from time to time. We aim for high availability but do not guarantee uninterrupted operation.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">5. Limitation of Liability</h2>
          <p>
            To the extent permitted by law, Freightcode is not liable for indirect, consequential, or incidental losses arising from use of the service.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">6. Termination</h2>
          <p>
            We may suspend or terminate access where these terms are breached, where required by law, or for security reasons.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">7. Contact</h2>
          <p>
            For terms questions, contact: <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:underline">info@freightcode.co.uk</a>
          </p>
        </div>
      </div>
    </div>
  );
}
