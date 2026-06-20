import { Metadata } from "next";
import { SignUpCta } from "@/components/sign-up-cta";

export const metadata: Metadata = {
  title: "DMSACC, DMSROG, DMSCLE — What Do HMRC CDS Notifications Mean? | FreightCode",
  description: "A plain-English guide to every CDS declaration notification — DMSACC, DMSROG, DMSCLE, DMSREJ, DMSCTL and more — and what action to take when you receive one.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "DMSACC, DMSROG, DMSCLE — What Do HMRC CDS Notifications Mean?",
    description: "A plain-English guide to every CDS declaration notification — DMSACC, DMSROG, DMSCLE, DMSREJ, DMSCTL and more — and what action to take when you receive one.",
    type: "article",
  },
  alternates: {
    canonical: "https://www.freightcode.co.uk/guides/dmsacc-dmsrog-dmscle-hmrc-cds-notifications",
  },
};

export default function Guide3Page() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "DMSACC, DMSROG, DMSCLE — What Do HMRC CDS Notifications Mean?",
    "description": "A plain-English guide to every CDS declaration notification — DMSACC, DMSROG, DMSCLE, DMSREJ, DMSCTL and more — and what action to take when you receive one.",
    "url": "https://www.freightcode.co.uk/guides/dmsacc-dmsrog-dmscle-hmrc-cds-notifications",
    "author": {
      "@type": "Organization",
      "name": "FreightCode"
    },
    "publisher": {
      "@type": "Organization",
      "name": "FreightCode",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.freightcode.co.uk/icon.png"
      }
    },
    "datePublished": "2026-01-01",
    "dateModified": "2026-05-01"
  };
  
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.freightcode.co.uk"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Guides",
        "item": "https://www.freightcode.co.uk/guides"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "DMSACC, DMSROG, DMSCLE — What Do HMRC CDS Notifications Mean?",
        "item": "https://www.freightcode.co.uk/guides/dmsacc-dmsrog-dmscle-hmrc-cds-notifications"
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <article className="max-w-3xl mx-auto px-6 py-12 md:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
        DMSACC, DMSROG, DMSCLE — What Do HMRC CDS Notifications Mean?
      </h1>
      
      <p className="text-[16px] text-slate-600 leading-relaxed mb-8">
        A plain-English guide to every CDS declaration notification — DMSACC, DMSROG, DMSCLE, DMSREJ, DMSCTL and more — and what action to take when you receive one.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Why CDS notifications matter</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        When a customs declaration is submitted through HMRC's Customs Declaration Service, the system sends a series of status notifications back to the declarant. These notifications tell you — and your customs agent — exactly what is happening with a declaration at each stage.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        If you don't understand what they mean, you risk missing a rejection that holds up your goods, failing to respond to a Border Force examination request, or simply not knowing whether your import has actually been cleared. Here is every CDS notification, in plain English.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">DMSACC — Declaration Accepted</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>What it means:</strong> CDS has received the declaration and it has passed initial validation. The structure of the declaration is correct — the required fields are present, the codes used are valid, and there are no obvious technical errors.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>What it does not mean:</strong> It does not mean the goods have been cleared. Acceptance is the first step, not the last.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6"><strong>Action required:</strong> None immediately. Wait for the next notification in the sequence.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">DMSROG — Declaration Registered</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>What it means:</strong> The goods have been registered on the CDS system and are now in the queue for release. At this point, Border Force may select the consignment for examination. Most consignments are not examined, but the DMSROG notification is the point at which that decision is made.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6"><strong>Action required:</strong> If goods are selected for examination, you will receive a DMSCTL notification (see below). Otherwise, the declaration will proceed to clearance.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">DMSCLE — Declaration Cleared</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>What it means:</strong> The declaration has been fully processed and the goods have been cleared for release. This is the notification you want. Once you receive DMSCLE, the goods can legally leave the port or border facility.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6"><strong>Action required:</strong> Instruct your haulier or freight forwarder to collect the goods if they haven't already. Ensure you retain the cleared declaration reference (MRN) for your records.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">DMSREJ — Declaration Rejected</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>What it means:</strong> The declaration has failed. CDS has found an error that prevents the declaration from being processed. This could be a technical error (invalid code, missing mandatory field), a data mismatch, or a document that doesn't match what was declared. This is the notification that causes delays. Goods will not be released until the declaration is corrected and resubmitted.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>Action required:</strong> Contact your customs agent immediately. The rejection notification will include an error code explaining what went wrong. Your agent must correct and resubmit the declaration. In the meantime, storage charges at the port may be accruing.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">Common causes of rejection include: invalid commodity code, mismatched EORI numbers, missing licence or document references, and incorrect procedure codes.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">DMSCTL — Control Notification</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-2"><strong>What it means:</strong> Border Force has selected the goods for a physical or documentary examination. This can happen at random, or because something in the declaration has triggered a risk flag.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6"><strong>Action required:</strong> Your customs agent will typically handle communication with Border Force. You may be asked to provide additional documentation — invoices, packing lists, licences, certificates of origin. Respond promptly. Delays in providing documents extend the examination time and storage costs. Most examinations are completed within a few hours. Complex examinations (e.g. involving prohibited goods or significant valuation queries) can take longer.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Other notifications</h2>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>DMSINV — Invalid Declaration:</strong> The declaration has been found to be invalid after acceptance. This is different from a rejection (which happens before acceptance). DMSINV can occur if, for example, the goods are found not to match the declaration during examination.</li>
        <li><strong>DMSRES — Response to Amendment:</strong> CDS has processed an amendment that was submitted to an existing declaration. This confirms the amendment has been accepted.</li>
        <li><strong>DMSTAX — Tax Line Notification:</strong> CDS is providing details of the tax lines calculated for the declaration — the breakdown of customs duty, import VAT, excise duty, and any other charges. This notification is informational.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">The typical notification sequence for a cleared shipment</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">For a straightforward import that clears without issues, the sequence looks like this:</p>
      <ol className="list-decimal pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Declaration submitted by your agent</li>
        <li><strong>DMSACC</strong> — declaration accepted</li>
        <li><strong>DMSROG</strong> — goods registered</li>
        <li><strong>DMSTAX</strong> — tax lines confirmed</li>
        <li><strong>DMSCLE</strong> — goods cleared</li>
      </ol>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How long does each stage take?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">For most commercial imports, the entire sequence from submission to DMSCLE takes minutes. CDS processes declarations very quickly when there are no issues. Delays occur when:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>The declaration is rejected and must be corrected (DMSREJ)</li>
        <li>Goods are selected for examination (DMSCTL)</li>
        <li>Additional documents are required and not yet provided</li>
        <li>The port is congested and document checks are queued</li>
      </ul>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">FreightCode shows you all of this in real time</h2>
        <p className="text-[14px] leading-relaxed text-slate-300">
          FreightCode monitors your CDS notifications and surfaces them in a single dashboard, with plain-English explanations of each status. Instead of waiting for your agent to forward notifications, you see every DMSACC, DMSROG, DMSCLE and DMSREJ the moment it arrives — so you can act immediately when something needs attention.
        </p>
        <div className="mt-8 max-w-sm">
          <SignUpCta variant="light" showSignIn={false} />
        </div>
      </div>
    </article>
    </>
  );
}
