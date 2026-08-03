import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "International Trade Support | freightcode®",
  description:
    "A secure customs workspace for international businesses to exchange documents, monitor UK declarations and work with their customs representative.",
  alternates: {
    canonical: "/solutions/international-trade",
  },
};

const customerCapabilities = [
  "View declarations submitted on your behalf",
  "Monitor customs status and clearance progress",
  "Upload invoices, packing lists and supporting documents",
  "Respond to customs and compliance requests",
  "Exchange messages with your representative",
  "Access declaration and document history",
  "Maintain company and contact information",
  "Participate in export-control assessments where required",
];

export default function InternationalTradeSolutionPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
        International trade
      </p>
      <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
        Your UK customs representative, connected to your business
      </h1>
      <p className="mb-6 text-[16px] leading-relaxed text-slate-600">
        freightcode gives international businesses a secure online workspace to work directly with their UK customs
        representative throughout the customs process.
      </p>
      <p className="mb-10 text-[15px] leading-relaxed text-slate-700">
        Whether you are based in Europe, the Middle East, Asia or North America, you can exchange documents, monitor
        declaration progress and respond to customs or compliance requests without needing Government Gateway or
        direct access to HMRC systems.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
        One shared customs record
      </h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        Email chains and shared folders separate documents from the declaration they support. freightcode connects
        the business, its representative, each request and every completed record in one controlled workspace.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
        What you can do
      </h2>
      <ul className="mb-10 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">
        {customerCapabilities.map((capability) => (
          <li key={capability}>{capability}</li>
        ))}
      </ul>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
        Support for indirect representation
      </h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        Where indirect representation is required, your representative remains responsible for the customs filing
        process while you retain visibility of the information, evidence, requests and declaration outcome held in
        freightcode. The applicable representation terms and responsibilities are agreed with your appointed
        representative.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
        Export-control collaboration
      </h2>
      <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
        When an export requires additional control checks, overseas parties can receive secure requests for end-user
        information and supporting evidence. Completed undertakings and documents return to the relevant assessment,
        keeping the compliance record connected to the customs activity.
      </p>

      <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
        Access without HMRC credentials
      </h2>
      <p className="mb-10 text-[15px] leading-relaxed text-slate-700">
        International customers use their freightcode portal account to collaborate with their representative. They
        do not need the representative&apos;s Government Gateway details or direct access to HMRC systems.
      </p>

      <p className="text-[15px] leading-relaxed text-slate-700">
        <Link href="/solutions" className="font-semibold text-blue-600 hover:text-blue-700">
          All solutions
        </Link>
      </p>
    </article>
  );
}
