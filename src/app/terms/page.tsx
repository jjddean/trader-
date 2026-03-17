import React from "react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
        <p className="mb-12 text-sm text-slate-500">Last updated: 13 February 2026</p>

        <div className="prose prose-slate max-w-none text-slate-600">
          <p>
            These Terms of Service govern your access to and use of freightcode® software and related services. By using our platform, you agree to these terms.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">1. Description of Service</h2>
          <p>
            freightcode® is an intelligent B2B SaaS platform designed to modernize UK customs clearances. Our services include historical data analytics, AI-assisted commercial invoice extraction, smart duty pre-fill capabilities, and HMRC Customs Declaration Service (CDS) integration. 
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">2. Beta Participation</h2>
          <p>
            Certain features of our platform (such as direct HMRC CDS submission and Open Banking payment integrations) may be offered in "Beta" status. By utilizing Beta features, you acknowledge that these tools are under active development and are provided as-is without warranties.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">3. User Responsibilities & Data</h2>
          <p>
            You are exclusively responsible for the accuracy and legality of all information submitted, including but not limited to HS Commodity Codes, commercial invoice data, and declarations pushed to HMRC. While our AI and smart-fill tools provide suggestions, they do not constitute legal or customs advice. 
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">4. Third-Party Integrations</h2>
          <p>
            Our services integrate directly with third parties including HMRC (via Government Gateway OAuth) and Open Banking partners (such as Stripe or TrueLayer). Your use of these integrated services may be subject to additional third-party terms.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">5. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, freightcode® shall not be liable for any indirect, incidental, or consequential damages—including but not limited to port demurrage charges, HMRC penalties, or delayed shipments—arising from use of the service.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-slate-900">6. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access immediately if you breach these terms or if your account activity poses a security or compliance risk to our HMRC integration.
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
