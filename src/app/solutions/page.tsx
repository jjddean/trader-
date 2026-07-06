import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solutions | freightcode®",
  description:
    "Build and submit UK customs declarations through HMRC CDS, with dry-run validation, document storage, and duty estimates — in one workspace.",
  alternates: {
    canonical: "/solutions",
  },
};

const capabilities = [
  {
    id: "historical",
    label: "Historical Data Analysis",
    benefit: "Review past declaration patterns when TRE data is imported (planned).",
    how: "Export CSV reports from HMRC TRE and import them into Freightcode to structure line items for estimates and HS suggestions.",
  },
  {
    id: "savings",
    label: "Duty Refund Detection",
    benefit: "Highlight possible preference or duty review opportunities — indicative, not filed reclaims.",
    how: "When historical data is available, the platform can flag lines where a preference code may have been missed. Your customs adviser confirms before any reclaim.",
  },
  {
    id: "prefill",
    label: "Smart Declaration Drafting",
    benefit: "Create new draft declarations instantly and save time finding the correct HS Commodity Codes.",
    how: "As you start a declaration, the system looks at your most frequent shipping routes and past successful filings to recommend the most accurate commodity codes.",
  },
  {
    id: "scoring",
    label: "Broker Performance Monitoring",
    benefit: "Track how well your freight forwarders and customs brokers are performing.",
    how: "We compare successful filings against errors to give you a clear view of which agents are performing best and where improvements are needed.",
  },
  {
    id: "hmrc",
    label: "HMRC OAuth connection",
    benefit: "Connect to HMRC to submit declarations and pull status and notifications.",
    how: "Connect via official HMRC OAuth to submit declarations and pull status and notifications. Tokens refresh in the background while your session stays authorised.",
  },
  {
    id: "storage",
    label: "Secure Document Storage",
    benefit: "Keep your invoices, packing lists, and customs documents in one secure, compliant place.",
    how: "Attach documents directly to your declaration records. We use secure cloud storage to ensure you can find what you need quickly during an HMRC audit.",
  },
];

export default function SolutionsPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">Platform</p>
      <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">Our Services</h1>
      <p className="mb-10 text-[16px] leading-relaxed text-slate-600">
        Build and submit UK customs declarations through HMRC CDS, with dry-run validation, document storage, and duty estimates — in one workspace.
      </p>

      {capabilities.map((item) => (
        <div key={item.id} id={item.id} className="scroll-mt-24">
          <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">{item.label}</h2>
          <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
            <strong>{item.benefit}</strong> {item.how}
          </p>
        </div>
      ))}
    </article>
  );
}
