import { Metadata } from "next";

export const metadata: Metadata = {
  title: "What is TRE and How to Use Your HMRC Trade Data | FreightCode",
  description: "A plain-English guide to HMRC's Tariff Rate Extracts (TRE) — what the data contains, how to access it, and how to use it to understand your import costs and patterns.",
  openGraph: {
    title: "What is TRE and How to Use Your HMRC Trade Data",
    description: "A plain-English guide to HMRC's Tariff Rate Extracts (TRE) — what the data contains, how to access it, and how to use it to understand your import costs and patterns.",
    type: "article",
  }
};

export default function Guide2Page() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-12 md:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
        What is TRE and How to Use Your HMRC Trade Data
      </h1>
      
      <p className="text-[16px] text-slate-600 leading-relaxed mb-8">
        A plain-English guide to HMRC's Tariff Rate Extracts (TRE) — what the data contains, how to access it, and how to use it to understand your import costs and patterns.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What is TRE?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        TRE stands for Tariff Rate Extract. It is a data export that HMRC makes available to traders and their agents, containing a record of the customs declarations submitted against a specific EORI number.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        In plain terms: it is your customs data. Every time a declaration is submitted through CDS (or previously CHIEF) against your EORI number, a record is created. TRE is how you get that data out in bulk.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        This data is valuable for several reasons. It lets you reconcile what was declared at the border against your own procurement and shipping records. It helps you understand your duty spend by commodity, supplier, or country. And it can flag discrepancies — goods declared under the wrong commodity code, incorrect values, or missing preference claims — that may be costing you money.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What data does TRE contain?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">A TRE export typically includes, for each declaration:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Declaration reference number (MRN — Movement Reference Number)</li>
        <li>Date of acceptance</li>
        <li>Importer and declarant EORI numbers</li>
        <li>Commodity codes declared</li>
        <li>Customs procedure codes</li>
        <li>Country of origin and country of dispatch</li>
        <li>Customs value</li>
        <li>Duty calculated and paid (or deferred)</li>
        <li>Import VAT amount</li>
        <li>Port of entry</li>
        <li>Consignor name and address</li>
        <li>Any licences or certificates attached</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        The exact columns vary depending on how the extract is generated and which system (CDS or legacy CHIEF) the declarations were submitted through.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How to access your TRE data</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">TRE data is accessible through HMRC's systems. Access routes include:</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>Via your customs agent.</strong> Your agent can pull TRE data on your behalf and provide it to you as a CSV or spreadsheet export. This is the most common route for most importers.</li>
        <li><strong>Direct access via the CDS dashboard.</strong> If you are subscribed to CDS, you can access certain declaration data directly through your HMRC online account, including your import duty certificates and monthly statements.</li>
        <li><strong>Via HMRC's data services.</strong> Larger traders with direct system integration can access declaration data via API.</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        For most businesses, the practical starting point is asking your customs agent for a TRE extract covering a defined period — for example, the last 12 months — in CSV format.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How to use your TRE data</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">Once you have the raw data, here is what to do with it:</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>Duty spend analysis.</strong> Group declarations by commodity code and sum the duty paid. This tells you where your duty costs are concentrated — and where duty relief measures (inward processing, tariff suspensions, preferential rates) might make the biggest difference.</li>
        <li><strong>Commodity code audit.</strong> Look for the same type of goods being declared under different commodity codes at different times. This is a common sign of inconsistency, and it may mean you're overpaying duty on some shipments or have a compliance risk on others.</li>
        <li><strong>Origin and preference review.</strong> Cross-reference country of origin against the duty rates applied. If goods are originating in a country with which the UK has a trade agreement, are you actually claiming the preferential rate? Missed preference claims are money left on the table.</li>
        <li><strong>Supplier and value reconciliation.</strong> Compare the customs values declared against your purchase invoices. The two should broadly align (accounting for freight and insurance adjustments). Large discrepancies warrant investigation.</li>
        <li><strong>Frequency and volume tracking.</strong> TRE data shows you your import frequency and volumes over time. This is useful for supplier negotiations, logistics planning, and demonstrating import history if you're applying for customs authorisations.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Common questions about TRE</h2>
      <div className="space-y-6 mb-6">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-800">How far back does TRE data go?</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">HMRC retains declaration data, but the practical access window via extracts is typically the last 4–6 years. For compliance purposes, you're required to retain customs records for 4 years.</p>
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-slate-800">Can I get TRE data for declarations submitted by my agent?</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">Yes — because declarations are linked to your EORI number as the importer of record, the data belongs to you, even if your agent submitted it.</p>
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-slate-800">Is TRE the same as my C79 certificate?</h3>
          <p className="text-[15px] text-slate-700 leading-relaxed">No. Your C79 certificate (now superseded by PVA monthly statements for most importers) is specifically about import VAT. TRE data covers the full picture of what was declared, including all duty elements.</p>
        </div>
      </div>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">How FreightCode uses your TRE data</h2>
        <p className="text-[14px] leading-relaxed text-slate-300">
          FreightCode ingests your TRE data and organises it into an analytics dashboard. Instead of working through raw CSV exports, you see your duty spend by commodity, your declaration history by supplier, and flags for potential anomalies — all in one place.
        </p>
      </div>
    </article>
  );
}
