import { resolveSubmissionRoute, type RoutingResult } from "./routing";

export interface DraftPackParty {
  name?: string | null;
  address?: string | null;
  country?: string | null;
}

export interface DraftPackProductInput {
  name: string;
  techDescription?: string;
  quantity?: number;
  valueGbp?: number;
  manufacturer?: string;
  modelNo?: string;
  classificationRuns?: Array<{
    requiresReview: boolean;
    finalControlEntry?: string;
    createdAt: number;
  }>;
}

export interface DraftPackAssessmentInput {
  reference: string;
  destinationCountry?: string;
  originJurisdiction?: "GB" | "NI";
  consignee?: DraftPackParty | null;
  endUser?: DraftPackParty | null;
  intendedUse?: string;
  controlListVersion?: string;
  sanctionsVersion?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DraftPackScreeningInput {
  subjectType: string;
  subjectName: string;
  reviewStatus: string;
  createdAt: number;
}

export interface DraftPackLicenceInput {
  licenceType: string;
  applicationRef?: string;
  licenceRef?: string;
  recordedAt: number;
}

export interface DraftPackField {
  id: string;
  label: string;
  value: string;
  mandatory: boolean;
  group: "assessment" | "parties" | "products" | "compliance";
}

export interface DraftPackTimelineStep {
  id: string;
  label: string;
  status: "done" | "pending";
  date?: string;
  hint?: string;
}

export interface DraftPackBundle {
  reference: string;
  generatedAt: string;
  disclaimer: string;
  fields: DraftPackField[];
  missingMandatory: string[];
  supportingDocs: Array<{ id: string; label: string; note: string }>;
  routing: RoutingResult;
  timeline: DraftPackTimelineStep[];
  ecjuNote: string;
}

const DRAFT_PACK_DISCLAIMER =
  "Draft pack for decision support only. UK control entries are recommendations — human review required. FreightCode does not submit to government systems.";

const ECJU_NOTE =
  "ECJU aims to decide 70% of SIELs within 20 working days; sensitive destinations and complex cases often take longer.";

function formatParty(party?: DraftPackParty | null): string {
  if (!party) return "";
  return [party.name, party.address, party.country].filter(Boolean).join(", ");
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function approvedControlEntry(product: DraftPackProductInput): string | null {
  const run = product.classificationRuns?.[0];
  if (!run || run.requiresReview !== false) return null;
  return run.finalControlEntry ?? "";
}

function allProductsReviewed(products: DraftPackProductInput[]): boolean {
  if (products.length === 0) return false;
  return products.every((product) => {
    const run = product.classificationRuns?.[0];
    return run && run.requiresReview === false;
  });
}

export function buildDraftPackBundle(input: {
  assessment: DraftPackAssessmentInput;
  products: DraftPackProductInput[];
  screenings: DraftPackScreeningInput[];
  licences: DraftPackLicenceInput[];
}): DraftPackBundle {
  const { assessment, products, screenings, licences } = input;

  const approvedEntries = products.map((p) => approvedControlEntry(p) ?? "");
  const routing = resolveSubmissionRoute({
    originJurisdiction: assessment.originJurisdiction,
    destinationCountry: assessment.destinationCountry,
    approvedControlEntries: approvedEntries,
  });

  const fields: DraftPackField[] = [
    {
      id: "reference",
      label: "Assessment reference",
      value: assessment.reference,
      mandatory: false,
      group: "assessment",
    },
    {
      id: "destination",
      label: "Destination country",
      value: assessment.destinationCountry ?? "",
      mandatory: true,
      group: "assessment",
    },
    {
      id: "origin",
      label: "Origin jurisdiction",
      value: assessment.originJurisdiction ?? "GB",
      mandatory: false,
      group: "assessment",
    },
    {
      id: "consignee",
      label: "Consignee",
      value: formatParty(assessment.consignee as DraftPackParty | undefined),
      mandatory: true,
      group: "parties",
    },
    {
      id: "end_user",
      label: "End user",
      value: formatParty(assessment.endUser as DraftPackParty | undefined),
      mandatory: true,
      group: "parties",
    },
    {
      id: "intended_use",
      label: "Intended use / end use",
      value: assessment.intendedUse ?? "",
      mandatory: true,
      group: "parties",
    },
    {
      id: "submission_route",
      label: "Submission route",
      value: routing.route === "none" ? "" : routing.route.toUpperCase(),
      mandatory: false,
      group: "compliance",
    },
    {
      id: "control_list_version",
      label: "Control list version",
      value: assessment.controlListVersion ?? "",
      mandatory: false,
      group: "compliance",
    },
  ];

  products.forEach((product, index) => {
    const entry = approvedControlEntry(product);
    fields.push(
      {
        id: `product_${index}_description`,
        label: `Item ${index + 1} — description`,
        value: product.techDescription?.trim() || product.name,
        mandatory: true,
        group: "products",
      },
      {
        id: `product_${index}_control_entry`,
        label: `Item ${index + 1} — UK control entry / rating`,
        value: entry === null ? "" : entry.length === 0 ? "Not controlled" : entry,
        mandatory: true,
        group: "products",
      },
      {
        id: `product_${index}_quantity`,
        label: `Item ${index + 1} — quantity`,
        value: product.quantity != null ? String(product.quantity) : "",
        mandatory: true,
        group: "products",
      },
      {
        id: `product_${index}_value`,
        label: `Item ${index + 1} — value (GBP)`,
        value: product.valueGbp != null ? product.valueGbp.toFixed(2) : "",
        mandatory: false,
        group: "products",
      },
    );
  });

  const missingMandatory = fields
    .filter((field) => field.mandatory && !field.value.trim())
    .map((field) => field.label);

  const earliestProductTs = products.length > 0 ? assessment.updatedAt : undefined;
  const classifiedTs = products.some((p) => (p.classificationRuns?.length ?? 0) > 0)
    ? Math.max(...products.flatMap((p) => p.classificationRuns?.map((r) => r.createdAt) ?? [0]))
    : undefined;
  const screenedTs =
    screenings.length > 0 ? Math.max(...screenings.map((s) => s.createdAt)) : undefined;
  const packReady = allProductsReviewed(products);
  const submittedLicence = licences.find((l) => l.applicationRef?.trim());
  const recordedLicence = licences.find((l) => l.licenceRef?.trim());

  const timeline: DraftPackTimelineStep[] = [
    {
      id: "extracted",
      label: "Products extracted",
      status: products.length > 0 ? "done" : "pending",
      date: products.length > 0 ? formatDate(earliestProductTs ?? assessment.createdAt) : undefined,
    },
    {
      id: "classified",
      label: "Classification complete",
      status: classifiedTs ? "done" : "pending",
      date: classifiedTs ? formatDate(classifiedTs) : undefined,
      hint: "Run Classify and approve a control entry per product",
    },
    {
      id: "screened",
      label: "Sanctions screened",
      status: screenedTs ? "done" : "pending",
      date: screenedTs ? formatDate(screenedTs) : undefined,
    },
    {
      id: "pack",
      label: "Draft pack ready",
      status: packReady && missingMandatory.length === 0 ? "done" : "pending",
      hint: packReady ? undefined : "Complete mandatory fields and product reviews",
    },
    {
      id: "submitted",
      label: "Submitted (user-declared)",
      status: submittedLicence ? "done" : "pending",
      date: submittedLicence ? formatDate(submittedLicence.recordedAt) : undefined,
      hint: "Record application reference on Licences tab after GOV.UK submission",
    },
    {
      id: "licence",
      label: "Licence recorded",
      status: recordedLicence ? "done" : "pending",
      date: recordedLicence ? formatDate(recordedLicence.recordedAt) : undefined,
    },
  ];

  return {
    reference: assessment.reference,
    generatedAt: new Date().toISOString(),
    disclaimer: DRAFT_PACK_DISCLAIMER,
    fields,
    missingMandatory,
    supportingDocs: [
      {
        id: "eusu",
        label: "End-User Statement Undertaking (EUSU)",
        note: "Required when end user differs from consignee or for sensitive destinations.",
      },
      {
        id: "euu",
        label: "End-Use Undertaking (EUU)",
        note: "Confirm intended use and no diversion to prohibited end uses.",
      },
      {
        id: "tech_spec",
        label: "Technical specification / datasheet",
        note: "Supports control entry classification evidence.",
      },
      {
        id: "commercial_invoice",
        label: "Commercial invoice",
        note: "Line items, values, and parties.",
      },
    ],
    routing,
    timeline,
    ecjuNote: ECJU_NOTE,
  };
}

export function draftPackToJson(bundle: DraftPackBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function draftPackPrintableHtml(bundle: DraftPackBundle, reviewerNotes?: string): string {
  const fieldRows = bundle.fields
    .map(
      (field) => `
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;width:35%;vertical-align:top;">${escapeHtml(field.label)}${field.mandatory ? " *" : ""}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;">${escapeHtml(field.value || "—")}</td>
      </tr>`,
    )
    .join("");

  const docs = bundle.supportingDocs
    .map((doc) => `<li><strong>${escapeHtml(doc.label)}</strong> — ${escapeHtml(doc.note)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Export draft pack — ${escapeHtml(bundle.reference)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; margin: 32px; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .muted { color: #64748b; font-size: 11px; }
    .disclaimer { background: #fffbeb; border: 1px solid #fde68a; padding: 12px; margin: 16px 0; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    h2 { font-size: 13px; margin: 24px 0 8px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Export control draft pack</h1>
  <p class="muted">${escapeHtml(bundle.reference)} · Generated ${escapeHtml(new Date(bundle.generatedAt).toLocaleString("en-GB"))}</p>
  <div class="disclaimer">${escapeHtml(bundle.disclaimer)}</div>
  <p><strong>Submission route:</strong> ${escapeHtml(bundle.routing.headline)}</p>
  <h2>Fields for GOV.UK application</h2>
  <table>${fieldRows}</table>
  ${reviewerNotes?.trim() ? `<h2>Reviewer notes</h2><p>${escapeHtml(reviewerNotes)}</p>` : ""}
  <h2>Supporting documents checklist</h2>
  <ul>${docs}</ul>
  <p class="muted">${escapeHtml(bundle.ecjuNote)}</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printViaIframe(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Export draft pack print");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const doc = frameWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  frameWindow?.focus();
  frameWindow?.print();
  window.setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 1000);
  return true;
}

export function openDraftPackPrintDialog(bundle: DraftPackBundle, reviewerNotes?: string): boolean {
  const html = draftPackPrintableHtml(bundle, reviewerNotes);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");

  if (!win) {
    URL.revokeObjectURL(url);
    return printViaIframe(html);
  }

  const triggerPrint = () => {
    win.focus();
    win.print();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // Blob pages may already be loaded when open returns.
  if (win.document.readyState === "complete") {
    triggerPrint();
  } else {
    win.addEventListener("load", triggerPrint, { once: true });
  }

  return true;
}
