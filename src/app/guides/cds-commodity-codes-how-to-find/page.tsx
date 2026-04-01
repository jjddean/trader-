import { Metadata } from "next";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "CDS Commodity Codes: How to Find the Right One for Your Goods | FreightCode",
  description: "A practical guide to finding the correct 10-digit commodity code for your goods under the UK Global Tariff — with step-by-step lookup instructions and tips for avoiding common classification mistakes.",
  openGraph: {
    title: "CDS Commodity Codes: How to Find the Right One for Your Goods",
    description: "A practical guide to finding the correct 10-digit commodity code for your goods under the UK Global Tariff — with step-by-step lookup instructions and tips for avoiding common classification mistakes.",
    type: "article",
  },
  alternates: {
    canonical: "/guides/cds-commodity-codes-how-to-find",
  },
};

export default function Guide5Page() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-12 md:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
        CDS Commodity Codes: How to Find the Right One for Your Goods
      </h1>
      
      <p className="text-[16px] text-slate-600 leading-relaxed mb-8">
        A practical guide to finding the correct 10-digit commodity code for your goods under the UK Global Tariff — with step-by-step lookup instructions and tips for avoiding common classification mistakes.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What is a commodity code?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        A commodity code (also called a tariff code or HS code) is the number used to classify goods in international trade. In the UK, import declarations use a 10-digit code. The code determines:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>The rate of customs duty that applies to your goods</li>
        <li>Whether import licences or certificates are required</li>
        <li>Whether trade restrictions or sanctions apply</li>
        <li>Whether preferential duty rates are available under trade agreements</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Getting the commodity code wrong is one of the most common and costly mistakes in customs compliance. The wrong code can result in paying too much duty, paying too little and later receiving a demand from HMRC, delays at the border, or penalties.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How the code is structured</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">A 10-digit UK commodity code breaks down as follows:</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>Digits 1–2: Chapter.</strong> The broad product category. Chapter 84, for example, covers machinery. Chapter 61 covers knitted clothing.</li>
        <li><strong>Digits 3–4: Heading.</strong> A more specific product group within the chapter. 8471 covers computers and data processing machines.</li>
        <li><strong>Digits 5–6: Subheading.</strong> The international HS (Harmonised System) code ends here. The first 6 digits are the same across most countries in the world.</li>
        <li><strong>Digits 7–8: Combined Nomenclature.</strong> Further subdivision used across the UK and EU tariffs.</li>
        <li><strong>Digits 9–10: UK-specific.</strong> Additional subdivisions unique to the UK Global Tariff.</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6 font-mono bg-slate-100 p-4 rounded-lg">
        Example: 8471.30.00.00 — laptop computers<br/>
        <span className="text-sm">84 (machinery chapter), 8471 (computers), 847130 (portable computers), and further UK subdivisions.</span>
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How to find the right commodity code</h2>
      <ol className="list-decimal pl-6 mb-6 space-y-4 text-[15px] text-slate-700">
        <li><strong>Step 1 — Use the UK Trade Tariff tool.</strong> Go to gov.uk and search for "UK Trade Tariff: look up commodity codes." This is HMRC's official lookup tool. You can search by description or browse the tariff tree.</li>
        <li><strong>Step 2 — Search by description.</strong> Enter a plain-English description of your goods. Be specific — "men's cotton woven trousers" will return more accurate results than "trousers." The tool will suggest matching commodity codes.</li>
        <li><strong>Step 3 — Browse the tariff tree.</strong> If the description search doesn't give you a clear result, browse from the chapter level down. Think about what your goods are made of, what they do, and what they're used for. The classification rules at the front of each chapter can help.</li>
        <li><strong>Step 4 — Read the chapter notes.</strong> Every chapter of the tariff has legal notes that define what is and isn't included. These notes override common sense — goods that you might think belong in one chapter are often specifically excluded by the notes and classified elsewhere.</li>
        <li><strong>Step 5 — Check the duty rate and measures.</strong> Once you've identified a code, the tariff tool will show you the duty rate, any import VAT surcharges, and any measures that apply (licences, prohibitions, quotas). Review these carefully.</li>
      </ol>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Classification rules: what the tariff actually says</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        The international rules for commodity code classification are set out in the General Rules of Interpretation (GRIs). In practice, the most important ones are:
      </p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>GRI 1 — Headings first.</strong> Classification is determined first by the heading text and chapter notes, not by the goods' commercial description.</li>
        <li><strong>GRI 3 — Most specific wins.</strong> When goods could fall under two headings, the more specific heading takes priority over a general one.</li>
        <li><strong>GRI 6 — Subheadings follow the same rules.</strong> The same logic applies when choosing between subheadings.</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        For most importers, you don't need to memorise the GRIs — but knowing they exist helps you understand why a code that seems obvious is sometimes wrong.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Common classification mistakes</h2>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>Classifying by what it's called rather than what it is.</strong> A "phone stand" sounds like it should be in the telecommunications chapter. It's probably actually classified as furniture or as an article of plastic, depending on what it's made of.</li>
        <li><strong>Ignoring materials.</strong> The material composition of goods is often decisive. A bag made of leather classifies differently from an identical bag made of synthetic material, even if they look the same.</li>
        <li><strong>Using a 6-digit HS code instead of the full 10 digits.</strong> The 6-digit international code gives you the subheading, but for UK import declarations you need the full 10-digit code. The last 4 digits affect your duty rate.</li>
        <li><strong>Using last year's code.</strong> The UK tariff is updated every year on 1 January. Commodity codes can change — subheadings are split, merged, or deleted. A code that was correct in 2024 may not be valid in 2026. Always verify against the current tariff.</li>
        <li><strong>Copying your supplier's HS code.</strong> Your supplier's country may use a different tariff schedule. The first 6 digits should match, but the last 4 are country-specific. Always verify against the UK tariff.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">When goods are difficult to classify</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        Some goods are genuinely difficult to classify — multi-function products, composite goods, new technologies, or goods that sit on the boundary between two chapters. In these cases, you have options:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li><strong>Binding Tariff Information (BTI).</strong> You can apply to HMRC for a legally binding commodity code ruling for your goods. This takes several months but gives you certainty and protection against future HMRC challenges.</li>
        <li><strong>Speak to a customs agent or tariff specialist.</strong> An experienced customs agent will have classified thousands of products and can advise quickly on difficult cases. For high-volume or high-value goods, professional advice pays for itself.</li>
        <li><strong>Check HMRC's tariff classification decisions database.</strong> HMRC publishes some classification decisions, which can help with similar goods.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What if you've been using the wrong code?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">If you discover that goods have been imported under an incorrect commodity code, you should take the following steps:</p>
      <ol className="list-decimal pl-6 mb-6 space-y-3 text-[15px] text-slate-700">
        <li>First, work out whether the error resulted in underpayment or overpayment of duty. If you've underpaid, you have an obligation to correct it and pay the difference — voluntary disclosure to HMRC typically results in a more favourable outcome than waiting for HMRC to find the error. If you've overpaid, you can claim a refund using form C285.</li>
        <li>Second, correct the commodity code on all future declarations immediately.</li>
        <li>Third, consider whether the error affected other aspects of the declaration — preference claims, licence requirements, or import controls.</li>
      </ol>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">FreightCode helps you stay on top of classification</h2>
        <p className="text-[14px] leading-relaxed text-slate-300">
          FreightCode tracks the commodity codes used across all your declarations and flags cases where the same goods appear under different codes, or where a code has changed in the annual tariff update. It won't classify your goods for you — that requires professional judgement — but it will make sure inconsistencies don't go unnoticed.
        </p>
        <div className="mt-8 max-w-sm">
          <WaitlistForm variant="light" />
        </div>
        <p className="text-sm text-slate-400 mt-6 pt-6 border-t border-slate-700/50">
          These guides are produced by FreightCode. FreightCode is a platform for UK importers and customs agents that connects directly to HMRC's Customs Declaration Service, providing real-time declaration tracking, notification monitoring, and data analytics.
        </p>
      </div>
    </article>
  );
}
