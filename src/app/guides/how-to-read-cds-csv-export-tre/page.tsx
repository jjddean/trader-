import { Metadata } from "next";
import Link from "next/link";
import { SignUpCta } from "@/components/sign-up-cta";

export const metadata: Metadata = {
  title: "How to Read Your CDS CSV Export from TRE | FreightCode",
  description: "A practical column-by-column guide to reading your CDS CSV export from HMRC's Trade Reporting and Extracting (TRE) service — what each field means and how to use the data.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "How to Read Your CDS CSV Export from TRE",
    description: "A practical column-by-column guide to reading your CDS CSV export from HMRC's Trade Reporting and Extracting (TRE) service — what each field means and how to use the data.",
    type: "article",
  },
  alternates: {
    canonical: "https://www.freightcode.co.uk/guides/how-to-read-cds-csv-export-tre",
  },
};

export default function Guide4Page() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "How to Read Your CDS CSV Export from TRE",
    "description": "A practical column-by-column guide to reading your CDS CSV export from HMRC's Trade Reporting and Extracting (TRE) service — what each field means and how to use the data.",
    "url": "https://www.freightcode.co.uk/guides/how-to-read-cds-csv-export-tre",
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
        "name": "How to Read Your CDS CSV Export from TRE",
        "item": "https://www.freightcode.co.uk/guides/how-to-read-cds-csv-export-tre"
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <article className="max-w-3xl mx-auto px-6 py-12 md:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
        How to Read Your CDS CSV Export from TRE
      </h1>
      
      <p className="text-[16px] text-slate-600 leading-relaxed mb-8">
        A practical column-by-column guide to reading your CDS CSV export from HMRC's <strong>Trade Reporting and Extracting (TRE)</strong> service — what each field means and how to use the data.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Why the CSV is hard to read</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        When you or your customs agent export your declaration data from HMRC's systems, the result is a CSV file with dozens of columns, cryptic headers, and coded values that don't mean much without a reference guide.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        This guide explains the most important columns, what the values in them mean, and how to use the data practically.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">The key columns explained</h2>
      
      <div className="space-y-6 mb-6">
        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">MRN (Movement Reference Number)</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The unique identifier for each customs declaration. Format: two-digit year + two-letter country code + 14 alphanumeric characters (e.g. 24GB12345678901234). Every declaration has one MRN. If you need to query a specific shipment with HMRC or your agent, this is the reference to use.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Acceptance Date</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The date CDS accepted the declaration. This is the official date of import for customs purposes — it's the date you should use when reconciling declarations against your accounts and VAT return. Note: the acceptance date may differ from the date your goods physically arrived or were delivered.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Declarant EORI</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The EORI number of the person or company that submitted the declaration — usually your customs agent. This is different from the Importer EORI.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Importer EORI</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            Your EORI number (as the importer of record). Declarations submitted by your agent on your behalf will show your EORI in this column, even though the agent's EORI appears in the Declarant column.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Commodity Code</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The 10-digit tariff commodity code used to classify the goods. The first 6 digits are the international HS code; the last 4 digits are UK-specific. This is one of the most important columns to audit. If the same type of goods appears under different commodity codes across different shipments, that's a flag for a compliance review.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Customs Procedure Code (CPC)</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed mb-2">A 7-character code that defines what is happening to the goods. The first 4 digits are the procedure; the last 3 are the additional procedure. Common values you'll see:</p>
          <ul className="list-disc pl-6 space-y-2 text-[15px] text-slate-700">
            <li><strong>4000 000</strong> — standard release into free circulation, no relief</li>
            <li><strong>4051 000</strong> — release into free circulation with end-use relief</li>
            <li><strong>5100 000</strong> — customs warehousing</li>
            <li><strong>2100 000</strong> — inward processing</li>
          </ul>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Country of Origin</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The two-letter ISO country code for where the goods originated (where they were manufactured or substantially transformed), not where they were shipped from. This is critical for determining duty rates. GB/EU trade: goods originating in the EU may qualify for zero duty under the UK-EU Trade and Cooperation Agreement, provided you have the correct origin proof.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Country of Dispatch</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            Where the goods were shipped from. This can differ from country of origin — for example, goods manufactured in China may be dispatched via the Netherlands.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Customs Value (GBP)</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The value used to calculate duty, expressed in pounds sterling. This is typically the transaction value (what you paid) plus the cost of freight and insurance to the UK port of entry (CIF — cost, insurance, freight). For air freight, a standard deduction is sometimes applied. If this figure looks significantly different from your invoice value, check whether your agent is adding freight correctly.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Duty Rate (%) & Duty Paid (GBP)</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The percentage duty rate applied to the goods, determined by the commodity code and country of origin. A value of 0.00 doesn't necessarily mean no duty applies — it may indicate a preferential rate of zero has been applied. <strong>Duty Paid</strong> is the customs duty charged on this declaration, calculated as Customs Value × Duty Rate.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Import VAT (GBP)</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            The import VAT charged. Calculated as (Customs Value + Customs Duty) × VAT Rate (usually 20%). If you are using Postponed VAT Accounting (PVA), this column may show zero or a nominal value, because the VAT is being accounted for on your VAT return rather than paid at the border.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Preference Indicator</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            A code indicating whether a preferential duty rate has been claimed. If this column is blank or shows a non-preference code on goods from a country the UK has a trade agreement with, you may be overpaying duty.
          </p>
        </div>

        <div>
          <h3 className="text-[18px] font-semibold text-slate-800">Document Codes and References</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            Columns with names like "Document Type 1," "Document Reference 1" etc. contain the codes and reference numbers for any documents attached to the declaration — licences, certificates, preference evidence. Common document codes: <strong>C505</strong> (ATA carnet), <strong>C644</strong> (Phytosanitary certificate), <strong>U110</strong> (Preference — UK-EU TCA), <strong>9WKS</strong> (calculation worksheet).
          </p>
        </div>
      </div>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Practical audit workflow</h2>
      <ol className="list-decimal pl-6 mb-6 space-y-3 text-[15px] text-slate-700">
        <li>Open the CSV in Excel or Google Sheets.</li>
        <li>Filter by Commodity Code and sort. Look for the same goods classified under different codes.</li>
        <li>Sum the Duty Paid column by Commodity Code. Identify your highest-cost commodity codes — these are the ones worth reviewing for relief opportunities.</li>
        <li>Filter for Country of Origin values from countries with UK trade agreements (EU member states, Japan, Canada, South Korea, etc.). Check the Preference Indicator for those rows. If it's blank, you may have missed a preferential claim.</li>
        <li>Cross-reference Customs Value against your purchase invoices for a sample of declarations. Large discrepancies need investigation.</li>
        <li>Sort by Acceptance Date and look for gaps — periods where you'd expect imports but no declarations appear. This can indicate declarations made against a different EORI, or shipments that weren't declared.</li>
      </ol>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Use this data in Freightcode</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          Upload your TRE Item Report CSV in Import TRE to store line items in your org workspace, scan for possible preference gaps, and keep history alongside your CDS declarations — without filtering thousands of rows in Excel.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SignUpCta variant="light" />
          <Link href="/dashboard/tre-import" className="text-[14px] font-medium text-slate-300 hover:text-white">
            Already have an account? Import TRE →
          </Link>
        </div>
      </div>
    </article>
    </>
  );
}
