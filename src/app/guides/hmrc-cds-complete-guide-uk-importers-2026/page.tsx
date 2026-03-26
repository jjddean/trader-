import { Metadata } from "next";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "HMRC CDS: Complete Guide for UK Importers 2026 | FreightCode",
  description: "Everything a UK business needs to know about HMRC's Customs Declaration Service in 2026 — registration, declaration types, duty deferment, and practical filing tips.",
  openGraph: {
    title: "HMRC CDS: Complete Guide for UK Importers 2026",
    description: "Everything a UK business needs to know about HMRC's Customs Declaration Service in 2026 — registration, declaration types, duty deferment, and practical filing tips.",
    type: "article",
  }
};

export default function Guide1Page() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-12 md:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
        HMRC CDS: Complete Guide for UK Importers 2026
      </h1>
      
      <p className="text-[16px] text-slate-600 leading-relaxed mb-8">
        Everything a UK business needs to know about HMRC's Customs Declaration Service in 2026 — registration, declaration types, duty deferment, and practical filing tips.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What is HMRC CDS?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        The Customs Declaration Service (CDS) is HMRC's digital platform for submitting import and export declarations in the UK. It replaced the older CHIEF (Customs Handling of Import and Export Freight) system, which was fully switched off for imports in November 2023.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        If your business imports goods into the UK — whether directly or through a customs agent — CDS is the system your declarations now go through. Understanding how it works helps you stay compliant, avoid delays, and interpret the notifications you receive.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Who needs to use CDS?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">Any business or individual that:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Imports goods into Great Britain or Northern Ireland</li>
        <li>Acts as a customs agent or freight forwarder submitting declarations on behalf of importers</li>
        <li>Uses a duty deferment account to defer payment of import VAT and customs duty</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        If you use a customs agent, they submit declarations on your behalf — but you remain legally responsible for the accuracy of the information, and you'll still receive CDS notifications linked to your EORI number.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Getting started: registering for CDS</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">Before you or your agent can submit declarations, you need to be subscribed to CDS in your HMRC online account.</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>Step 1 — Get an EORI number.</strong> You need a UK EORI number (format: GB + 12 digits). Apply through HMRC's website if you don't already have one. Most VAT-registered businesses can get one within hours.</li>
        <li><strong>Step 2 — Subscribe to CDS.</strong> Log into your Government Gateway account, go to "Get access to a tax, duty or scheme," and select Customs Declaration Service. You'll need your EORI number ready.</li>
        <li><strong>Step 3 — Set up your CDS cash account or duty deferment account.</strong> For import duties, you can pay at point of declaration via your CDS cash account, or defer payment using a duty deferment account (which requires a bank guarantee or a Customs Comprehensive Guarantee).</li>
        <li><strong>Step 4 — Grant authority to your customs agent (if applicable).</strong> Use HMRC's Customs Declare Service to grant your agent standing authority to act on your behalf. Without this, your agent cannot submit declarations linked to your EORI.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">CDS declaration types explained</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">Every import declaration in CDS is assigned a procedure code that tells HMRC what's happening to the goods. The most common ones are:</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>H1 — Standard import declaration.</strong> Used when goods are released into free circulation in the UK. This is the most common declaration type. Duty and import VAT are calculated and due at this point.</li>
        <li><strong>H2 — Customs warehouse declaration.</strong> Goods placed into a customs warehouse without paying duty. Duty is suspended until goods are removed.</li>
        <li><strong>H3 — Inward processing.</strong> Goods imported temporarily for processing or repair, then re-exported. Duty relief may apply.</li>
        <li><strong>H4 — Temporary admission.</strong> Goods brought in temporarily (e.g. for exhibitions or events) with the intention of re-export.</li>
        <li><strong>H5 — End-use relief.</strong> Goods imported at a reduced or zero duty rate because of their specific intended use (e.g. aircraft parts).</li>
        <li><strong>I1 — Import simplified declaration.</strong> A simplified version submitted at the frontier, followed by a supplementary declaration.</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">For most regular importers, H1 is what you'll encounter. Your customs agent will select the correct procedure code.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">What information is in a CDS declaration?</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">A CDS import declaration contains dozens of data elements. The key ones are:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Declarant and importer EORI numbers</li>
        <li>Commodity code — the 10-digit tariff code identifying what the goods are</li>
        <li>Customs procedure codes — define what's happening to the goods (see above)</li>
        <li>Country of origin — affects duty rates under UK trade agreements</li>
        <li>Customs value — the value used to calculate duty (usually transaction value + freight + insurance to UK port)</li>
        <li>Duty calculation — CDS calculates duty automatically based on commodity code, origin, and value</li>
        <li>Consignor and consignee details</li>
        <li>Transport and port information</li>
        <li>Documents attached — licences, certificates, preference evidence (e.g. EUR.1 form or supplier declaration)</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How CDS calculates duty</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        Duty on imports is calculated as: <strong>Customs Value × Commodity Code Duty Rate</strong>. The customs value is typically the transaction value (what you paid for the goods) plus freight costs to the UK port of entry, plus insurance.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        Import VAT is then charged on top: <strong>(Customs Value + Customs Duty + any Excise Duty) × 20%</strong> (standard rate).
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        If goods originate from a country with which the UK has a trade agreement (e.g. EU, Japan, Canada), a preferential duty rate may apply — but you must be able to prove origin with the correct documents.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">CDS notifications: what to expect</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">Once a declaration is submitted, CDS sends a series of status notifications. These are sent to the declarant (usually your customs agent) and are visible in your CDS inbox if you're subscribed. The main ones are:</p>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>DMSACC — Declaration accepted.</strong> CDS has received and accepted the declaration.</li>
        <li><strong>DMSROG — Declaration registered.</strong> Goods have been registered and can be examined by Border Force if selected.</li>
        <li><strong>DMSCLE — Declaration cleared.</strong> Goods have been cleared and can be released.</li>
        <li><strong>DMSREJ — Declaration rejected.</strong> There's an error that must be corrected before goods can be released.</li>
        <li><strong>DMSCTL — Control notification.</strong> Goods have been selected for examination by Border Force.</li>
      </ul>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">Understanding these notifications helps you know exactly where your goods are in the process — and act quickly if something goes wrong.</p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Common mistakes UK importers make in CDS</h2>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>Wrong commodity code.</strong> Using an incorrect 10-digit commodity code is one of the most common errors. It can result in the wrong duty rate being applied, potential penalties, and delays.</li>
        <li><strong>Missing or incorrect preference documents.</strong> Claiming a preferential duty rate without the correct origin evidence (e.g. a valid supplier declaration or REX statement) will result in full duty being charged or a later demand from HMRC.</li>
        <li><strong>Incorrect customs value.</strong> Undervaluing goods — even accidentally — is a serious compliance issue. The customs value must include all costs up to the UK port of entry.</li>
        <li><strong>Not granting agent authority.</strong> If you haven't formally granted your customs agent authority in CDS, they may be submitting declarations without proper authorisation, which creates legal and liability issues.</li>
        <li><strong>Ignoring rejection notifications.</strong> A DMSREJ notification means the declaration failed. Goods will not be released until the error is corrected. If you're not monitoring notifications, this can cause costly delays.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">CDS and postponed VAT accounting (PVA)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">Most UK VAT-registered importers should be using Postponed VAT Accounting (PVA). This allows you to account for import VAT on your VAT return rather than paying it at the point of import — a significant cashflow benefit.</p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">To use PVA, your customs declaration must include your VAT number and the correct method of payment code. Your monthly PVA statement is available in your HMRC online account and must be used when completing your VAT return.</p>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">How FreightCode helps</h2>
        <p className="text-[14px] leading-relaxed text-slate-300">
          FreightCode connects directly to CDS and presents all your declaration data, notifications, and duty calculations in one clear dashboard. Instead of logging into HMRC to track notifications, you see every DMSACC, DMSROG, DMSCLE and DMSREJ in real time — with plain-English explanations of what each one means.
        </p>
        <div className="mt-8 max-w-sm">
          <WaitlistForm variant="light" />
        </div>
      </div>
    </article>
  );
}
