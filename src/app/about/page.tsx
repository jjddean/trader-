import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | freightcode®",
  description:
    "FreightCode is building technology to simplify global trade data, starting with UK customs declarations through HMRC CDS.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">Company</p>
      <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">About FreightCode</h1>
      <p className="mb-10 text-[16px] leading-relaxed text-slate-600">
        FreightCode is building the technology to simplify global trade data, starting with the UK border.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">What we build</h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        We provide software for UK customs declarations through HMRC&apos;s Customs Declaration Service (CDS): declaration workspace, dry-run validation, invoice extraction, duty estimates, and OAuth connectivity for submit and status.
      </p>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        We believe that international trade should not be slowed down by complex rules, manual data entry, or preventable errors. High-volume businesses and freight forwarders often lose money through overpaid duties and penalties caused by a lack of clear visibility into their supply chain.
      </p>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        By using secure direct connections and smart classification tools, FreightCode gives control back to supply chain operators — ensuring fast, compliant, and optimized customs clearance.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">Our goal</h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        To make customs data easy to use, eliminate shipping delays, and ensure smooth trade for every business.
      </p>
    </article>
  );
}
