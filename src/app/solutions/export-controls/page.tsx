import { Metadata } from "next";
import Link from "next/link";
import { TradeCompliancePreview } from "@/components/trade-compliance-preview";

export const metadata: Metadata = {
  title: "UK Export Controls | freightcode®",
  description:
    "Export-control assessments in Freightcode: classification, UK sanctions screening, end-user undertakings, licence draft packs for LITE and SPIRE, consultancy support — alongside CDS declarations.",
  alternates: {
    canonical: "/solutions/export-controls",
  },
};

export default function ExportControlsSolutionPage() {
  return (
    <article className="max-w-3xl py-4 xl:max-w-none">
      <div className="max-w-3xl">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
          Trade compliance
        </p>
        <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
          UK export controls
        </h1>
        <p className="mb-6 text-[16px] leading-relaxed text-slate-600">
          When a UK export may be strategic or dual-use, ECJU (Department for Business and Trade) expects a
          licence application with structured facts about the goods, the parties, and the intended use — backed by
          an undertaking from the overseas end user and evidence of what the item is. Freightcode holds that work
          as one assessment, attached to your CDS workspace. Licence applications are filed on GOV.UK (LITE or
          SPIRE); Freightcode does not submit them.
        </p>
        <p className="mb-10 text-[15px] leading-relaxed text-slate-700">
          This is UK-focused: Strategic Export Control Lists, UK Sanctions List, EUSU, LITE/SPIRE/OTSI routing.
          It is not a multi-jurisdiction export-control suite.
        </p>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
          The problem
        </h2>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Exporters and brokers assemble classification, party screening, end-user paperwork, and technical
          evidence across email and spreadsheets, then re-key the same facts into LITE or SPIRE. Incomplete or
          mismatched undertakings and missing technical specs are common causes of delay. Freightcode keeps the
          case, the undertaking, the evidence, and the draft pack on one record — with an audit trail.
        </p>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
          Who is involved
        </h2>
        <ul className="mb-6 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">
          <li>The exporter or broker (organisation workspace)</li>
          <li>Our independent consultancy — advise and sign off, or manage and file on GOV.UK</li>
          <li>The overseas buyer / end user (completes the undertaking via a secure link)</li>
          <li>ECJU at DBT (assesses the licence on the official service)</li>
        </ul>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
          Typical path
        </h2>
        <ol className="mb-10 space-y-0 text-[15px] leading-relaxed text-slate-700">
          {[
            "Assessment created",
            "Documents uploaded",
            "Classification approved",
            "Sanctions complete",
            "EUSU requested",
            "EUSU signed",
            "Application pack generated",
            "Submitted via GOV.UK",
            "ECJU information request",
            "Response uploaded",
            "Licence granted",
            "Licence linked to declaration",
          ].map((step, index, steps) => (
            <li key={step} className="flex flex-col items-start">
              <span className="font-medium text-slate-900">{step}</span>
              {index < steps.length - 1 && (
                <span className="my-1 pl-1 text-slate-300" aria-hidden>
                  ↓
                </span>
              )}
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
          How a case runs
        </h2>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">1. Assessment and documents</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Open an export assessment in Trade Compliance. Upload a commercial invoice or specification; AI extracts
          product names, technical detail, parties, and destination for you to check.
        </p>
      </div>

      <div className="mb-10 mt-2 flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
        <div className="max-w-md shrink-0 xl:w-[340px]">
          <h3 className="mb-3 text-[17px] font-semibold text-slate-900">2. Classification</h3>
          <p className="text-[15px] leading-relaxed text-slate-700">
            AI proposes candidate control entries against the UK Strategic Export Control Lists, with confidence.
            You approve or override before anything counts as decided.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <TradeCompliancePreview />
        </div>
      </div>

      <div className="max-w-3xl">
        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">3. Sanctions screening</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Buyers, consignees, and end users are screened against the UK Sanctions List using rule-based name
          matching. Probable matches stay in review until you confirm or dismiss them.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">4. Routing</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          From destination, control entry, and licence type, the case indicates whether the application path is
          LITE (Apply for a SIEL) or SPIRE / OTSI — for example sanctioned destinations or control entries that
          remain on SPIRE per GOV.UK guidance.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">5. End-user and stockist undertaking (EUSU)</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          The exporter or consultant sends a secure, time-limited link to the overseas party. The form follows
          the structure of the official DBT/ECJU EUSU: roles (consignee, end user, intermediate user, ultimate
          end user, stockist), items, intended use, certifications, and signature. On submit it is stored on the
          assessment. The party can print or download their completed copy. ECJU still expects the official
          undertaking to be checked against GOV.UK before filing.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">6. Product evidence</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          DBT needs to understand what the item is and what it does — datasheets, specifications, brochures, or
          product URLs. Attach evidence on the case; it is included in the draft pack for download.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">7. Licence draft pack</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          The pack assembles the fields the online application asks for, with the completed undertaking and
          evidence. Printable and downloadable. There is no government API to submit a strategic export licence
          from Freightcode — the handoff to LITE or SPIRE is deliberate.
        </p>

        <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900">8. Recording the outcome</h3>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          After filing, record the application reference and, when issued, the licence number — with type (SIEL,
          SITCL, SITL, F680, OIEL, OGEL, OTSI). The assessment audit trail covers the journey on the case.
        </p>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
          Consultancy
        </h2>
        <p className="mb-4 text-[15px] leading-relaxed text-slate-700">
          Complete the assessment in your organisation workspace. Use the draft pack to file on LITE or SPIRE,
          attach the undertaking and evidence, and record references when ECJU responds.
        </p>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          You can engage our independent consultancy on the same assessment. They may advise and sign off only, or
          manage the licensing process and file on GOV.UK on your behalf — using the pack, undertaking, and evidence
          already on the case. SPIRE company registration allows authorised users (including consultants) to prepare
          and submit applications for a company; that filing still happens on the official service, not inside
          Freightcode.
        </p>
        <p className="mb-6 text-[15px] leading-relaxed text-slate-700">
          Classification approval and sanctions adjudication today remain with the organisation user in the
          dashboard. The consultancy review link can view the case, dispatch the EUSU, and complete sign-off or
          block with notes (and record licence references if they filed).
        </p>

        <h2 className="mb-4 mt-8 text-[20px] font-semibold tracking-tight text-slate-900">
          Boundaries
        </h2>
        <ul className="mb-10 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">
          <li>Control entries are recommendations until you approve them</li>
          <li>Freightcode does not submit licence applications to ECJU or OTSI</li>
          <li>Nothing on the platform is legal advice</li>
          <li>EUSU output follows the official form structure; check against GOV.UK before filing</li>
        </ul>

        <p className="text-[15px] leading-relaxed text-slate-700">
          <Link href="/dashboard/trade-compliance" className="font-semibold text-blue-600 hover:text-blue-700">
            Open Trade Compliance
          </Link>
          {" · "}
          <Link href="/solutions" className="font-semibold text-blue-600 hover:text-blue-700">
            All solutions
          </Link>
          {" · "}
          <Link
            href="https://www.gov.uk/guidance/apply-to-export-controlled-goods"
            className="font-semibold text-blue-600 hover:text-blue-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply to export controlled goods (GOV.UK)
          </Link>
        </p>
      </div>
    </article>
  );
}
