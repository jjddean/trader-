import React from "react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
        <p className="mb-12 text-[13px] text-slate-500">Last updated: 28 July 2026</p>

        <div className="text-[15px] leading-relaxed text-slate-700">
          <p className="mb-6">
            These Terms of Service govern your access to and use of freightcode® software and related services. By using our platform, you agree to these terms.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">1. Description of Service</h2>
          <p className="mb-6">
            freightcode® is an intelligent B2B SaaS platform designed to modernize UK customs clearances. Our services include historical data analytics, AI-assisted commercial invoice extraction, smart duty pre-fill capabilities, and HMRC Customs Declaration Service (CDS) integration.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">2. Beta Participation</h2>
          <p className="mb-6">
            Certain features of our platform (such as direct HMRC CDS submission and Open Banking payment integrations) may be offered in &quot;Beta&quot; status. By utilizing Beta features, you acknowledge that these tools are under active development and are provided as-is without warranties.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">3. User Responsibilities &amp; Data</h2>
          <p className="mb-6">
            You are exclusively responsible for the accuracy and legality of all information submitted, including but not limited to HS Commodity Codes, commercial invoice data, and declarations pushed to HMRC. While our AI and smart-fill tools provide suggestions, they do not constitute legal or customs advice.
          </p>

          <h2 id="export-controls" className="mb-4 mt-8 scroll-mt-24 text-[20px] font-semibold tracking-tight text-slate-900">
            4. Export Controls
          </h2>
          <p className="mb-6">
            freightcode® provides software tools to help you organise UK export-control assessments, including suggested Strategic Export Control List entries, sanctions and party screening support, end-user and stockist undertaking (EUSU) drafts, evidence, and licence draft packs. These features are for decision support only.
          </p>
          <p className="mb-6">
            Nothing on the platform constitutes legal, regulatory, or compliance advice. Use of the software does not create a solicitor–client or other regulated advisory relationship. Any consultancy engagement is separate and governed by its own terms.
          </p>
          <p className="mb-6">
            freightcode® is a software provider. We do not submit licence applications or related filings to the Export Control Joint Unit (ECJU), the Apply to Export Controlled Goods service (including LITE), SPIRE, the Office of Trade Sanctions Implementation (OTSI), or any other government body on your behalf. We are not affiliated with, endorsed by, or a substitute for the Department for Business and Trade, ECJU, OTSI, HMRC, or their official licensing systems.
          </p>
          <p className="mb-6">
            Control-list matches, AI suggestions, screening results, EUSU drafts, and draft packs are recommendations or working documents until reviewed and approved by a competent person in your organisation (or your appointed adviser). You must verify outputs against current official GOV.UK forms, control lists, and sanctions guidance before relying on them. Reference data may be incomplete or lag official updates.
          </p>
          <p className="mb-6">
            The exporter (or their appointed broker or agent) remains solely responsible for classification, end-use and end-user due diligence, choosing the correct licensing route, submitting applications and supporting documents, obtaining any required licence or authorisation, and retaining records. HMRC CDS declarations (where available) are separate from strategic export licensing; one does not replace the other. freightcode® does not guarantee that a licence will be granted, that goods will clear, or that screening will identify every applicable restriction.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">5. Third-Party Integrations</h2>
          <p className="mb-6">
            Our services integrate directly with third parties including HMRC (via Government Gateway OAuth) and Open Banking partners (such as Stripe or TrueLayer). Your use of these integrated services may be subject to additional third-party terms.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">6. Limitation of Liability</h2>
          <p className="mb-6">
            To the maximum extent permitted by law, freightcode® shall not be liable for any indirect, incidental, or consequential damages—including but not limited to port demurrage charges, HMRC penalties, refused or delayed export licences, seizures, export-control or sanctions penalties, or delayed shipments—arising from use of the service.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">7. Termination</h2>
          <p className="mb-6">
            We reserve the right to suspend or terminate your access immediately if you breach these terms or if your account activity poses a security or compliance risk to our HMRC integration.
          </p>

          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">8. Contact</h2>
          <p>
            For terms questions, contact:{" "}
            <a href="mailto:info@freightcode.co.uk" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
              info@freightcode.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
