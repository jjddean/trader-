/**
 * End-user and stockist undertaking (EUSU) — aligned to the official DBT/ECJU form
 * (docs/export-controls/sources/eusu-form-2025-09-08.docx, "Last updated: June 2025").
 * Source: https://www.gov.uk/government/publications/end-user-undertaking-euu-form
 */

export interface EusuRoles {
  consignee: boolean;
  endUser: boolean;
  intermediateUser: boolean;
  ultimateEndUser: boolean;
  stockistNoOrders: boolean;
  stockistConfirmed: boolean;
}

export interface EusuItemLine {
  description: string;
  quantity?: string;
  unit?: string;
}

/** Optional EUSU sections beyond the legacy core statement fields. */
export interface EusuDetails {
  roles: EusuRoles;
  /** Section 1 */
  exporterName?: string;
  exporterLicenceRef?: string;
  /** Section 2 */
  items?: EusuItemLine[];
  /** Section 3 */
  consigneeName?: string;
  consigneeAddress?: string;
  /** Section 4 extras */
  endUserWebsite?: string;
  armedForces?: boolean;
  /** Section 5 */
  incorporation?: boolean;
  soleUser?: boolean;
  otherSupportingInfo?: string;
  /** Section 6 */
  intermediateUserDetails?: string;
  intermediateUse?: string;
  /** Section 7 */
  newProductDescription?: string;
  ultimateEndUserDetails?: string;
  /** Sections 8 / 9 */
  signatureSection?: "end_user" | "stockist";
  signedJobRole?: string;
  stockistReExport?: "no_reexport" | "likely_exports";
  stockistLikelyExports?: string;
}

export interface EndUserStatementInput {
  assessmentReference: string;
  destinationCountry?: string;
  products: Array<{ name: string; techDescription?: string; quantity?: number }>;
  endUserName: string;
  endUserAddress: string;
  endUserCountry: string;
  contactName: string;
  contactEmail?: string;
  intendedUse: string;
  signedBy: string;
  signedAt: number;
  eusu?: EusuDetails;
}

const END_USER_CERTIFICATIONS = [
  "The end-user will use the items for the purposes described in Section 5.",
  "The items will not be used for any purpose connected with chemical, biological or nuclear weapons, or missiles capable of delivering such weapons.",
  "The items will not be re-exported or otherwise resold or transferred if it is known or suspected that they are intended or likely to be used for such purposes.",
  "The items will not be re-exported or otherwise resold or transferred to a destination subject to UN, EU, UK or OSCE sanctions or embargoes where that act would be in breach of the terms of those measures.",
  "The items, or any replica thereof, will not be used in any nuclear explosive activity or unsafeguarded nuclear fuel cycle.",
];

const STOCKIST_CERTIFICATIONS = [
  "The items are intended for stock to be held against future orders.",
  "The items will not be supplied to an entity if it is known or suspected that they are intended or likely to be used for any purpose connected with chemical, biological or nuclear weapons, or missiles capable of delivering such weapons.",
  "The items will not be supplied to an entity in the future in a destination subject to UN, EU, UK or OSCE sanctions or embargo where that act would be in breach of the terms of those measures.",
  "The items, or any replica of them, will not be supplied if it is known or suspected that they are intended or likely to be used in any nuclear explosive activity or unsafeguarded nuclear fuel cycle.",
];

export const EUSU_ROLE_LABELS: Array<{ key: keyof EusuRoles; label: string; sections: string }> = [
  { key: "consignee", label: "Consignee", sections: "Section 3" },
  { key: "endUser", label: "End-user", sections: "Sections 4, 5, 8" },
  { key: "intermediateUser", label: "Intermediate user", sections: "Section 6" },
  { key: "ultimateEndUser", label: "Ultimate end-user", sections: "Section 7" },
  { key: "stockistNoOrders", label: "Stockist — no orders", sections: "Sections 4, 9" },
  { key: "stockistConfirmed", label: "Stockist — confirmed orders", sections: "Sections 3, 4, 5, 8" },
];

export { END_USER_CERTIFICATIONS, STOCKIST_CERTIFICATIONS };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function row(label: string, value?: string): string {
  return `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value?.trim() || "—")}</td></tr>`;
}

function yesNo(value?: boolean): string {
  if (value === undefined) return "—";
  return value ? "YES" : "NO";
}

function sectionHeading(title: string): string {
  return `<h2 style="font-size:14px;margin:24px 0 8px">${escapeHtml(title)}</h2>`;
}

export function endUserStatementPrintableHtml(input: EndUserStatementInput): string {
  const eusu = input.eusu;

  const itemLines: EusuItemLine[] =
    eusu?.items && eusu.items.length > 0
      ? eusu.items
      : input.products.map((p) => ({
          description: p.techDescription?.trim() || p.name,
          quantity: p.quantity != null ? String(p.quantity) : undefined,
        }));

  const itemsRows = itemLines
    .map(
      (item, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.quantity ?? "—")}</td><td>${escapeHtml(item.unit ?? "—")}</td></tr>`,
    )
    .join("");

  const rolesLine = eusu
    ? EUSU_ROLE_LABELS.filter((r) => eusu.roles[r.key])
        .map((r) => r.label)
        .join(", ") || "—"
    : "End-user";

  const isStockist = eusu?.signatureSection === "stockist";
  const certifications = isStockist ? STOCKIST_CERTIFICATIONS : END_USER_CERTIFICATIONS;
  const certIntro = isStockist
    ? "I certify that I have the authority to sign for the stockist of the items described in Section 2, which will be supplied by the UK exporter named in Section 1. I also certify that:"
    : "I certify that I have the authority to sign for the end-user of the items described in Section 2, which will be supplied by the UK exporter named in Section 1. I certify that:";

  const stockistChoice = isStockist
    ? eusu?.stockistReExport === "likely_exports"
      ? `<p><strong>Re-export position:</strong> The items are likely to be exported to the following countries and customers: ${escapeHtml(eusu?.stockistLikelyExports?.trim() || "—")}</p>`
      : `<p><strong>Re-export position:</strong> The items will not be re-exported, sold for export or otherwise exported from the country where we are based.</p>`
    : "";

  const optionalSections: string[] = [];

  if (eusu?.roles.intermediateUser) {
    optionalSections.push(`
  ${sectionHeading("Section 6: Intermediate user")}
  <table>
    ${row("Name and address (used after incorporation or processing)", eusu.intermediateUserDetails)}
    ${row("Intended intermediate use", eusu.intermediateUse)}
  </table>`);
  }

  if (eusu?.roles.ultimateEndUser || eusu?.soleUser === false) {
    optionalSections.push(`
  ${sectionHeading("Section 7: Ultimate end-user")}
  <table>
    ${row("New product or higher-level system", eusu?.newProductDescription)}
    ${row("Ultimate end-user name and address", eusu?.ultimateEndUserDetails)}
  </table>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>End-user and stockist undertaking (EUSU) — ${escapeHtml(input.assessmentReference)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; margin: 32px; line-height: 1.5; font-size: 13px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td, th { padding: 8px; border: 1px solid #e2e8f0; vertical-align: top; text-align: left; }
    td.label { width: 32%; font-weight: 600; background: #f8fafc; }
    .undertaking { margin: 16px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>End-user and stockist undertaking (EUSU)</h1>
  <p class="meta">Assessment ${escapeHtml(input.assessmentReference)} · Destination ${escapeHtml(input.destinationCountry ?? "—")} · Parties: ${escapeHtml(rolesLine)}</p>

  ${sectionHeading("Section 1: UK exporter")}
  <table>
    ${row("Name of UK exporter", eusu?.exporterName)}
    ${row("Licence application reference (optional)", eusu?.exporterLicenceRef)}
  </table>

  ${sectionHeading("Section 2: Items")}
  <table>
    <tr><th>#</th><th>Item description</th><th>Quantity</th><th>Unit of measurement</th></tr>
    ${itemsRows || "<tr><td colspan=\"4\">—</td></tr>"}
  </table>

  ${sectionHeading("Section 3: Consignee")}
  <table>
    ${row("Consignee's name", eusu?.consigneeName)}
    ${row("Consignee's address", eusu?.consigneeAddress)}
  </table>

  ${sectionHeading("Section 4: End-user")}
  <table>
    ${row("End-user's name", input.endUserName)}
    ${row("End-user's address", input.endUserAddress)}
    ${row("Country", input.endUserCountry)}
    ${row("Contact (responsible official)", `${input.contactName}${input.contactEmail ? ` (${input.contactEmail})` : ""}`)}
    ${row("End-user's website", eusu?.endUserWebsite)}
    ${row("Part of armed forces or internal security forces?", yesNo(eusu?.armedForces))}
  </table>

  ${sectionHeading("Section 5: Intended end-use")}
  <table>
    ${row("Intended end-use of the items", input.intendedUse)}
    ${row("Will the items be incorporated into another product or higher-level system?", yesNo(eusu?.incorporation))}
    ${row("Will the end-user be the only user of the new product or system?", yesNo(eusu?.soleUser))}
    ${row("Other supporting information (optional)", eusu?.otherSupportingInfo)}
  </table>
  ${optionalSections.join("\n")}

  ${sectionHeading(isStockist ? "Section 9: Stockist sign and date" : "Section 8: End-user sign and date")}
  <div class="undertaking">
    <p>${escapeHtml(certIntro)}</p>
    <ul>
      ${certifications.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
    </ul>
    ${stockistChoice}
  </div>

  <table>
    <tr><td class="label">Signed by (print name)</td><td>${escapeHtml(input.signedBy)}</td></tr>
    <tr><td class="label">Job role</td><td>${escapeHtml(eusu?.signedJobRole?.trim() || "—")}</td></tr>
    <tr><td class="label">Date</td><td>${formatDate(input.signedAt)}</td></tr>
  </table>

  <p class="footer">Generated by Freightcode from the end-user's online submission, following the structure of the official GOV.UK EUSU form (June 2025). ECJU requires the official form submitted as a non-editable PDF — verify against gov.uk before filing. Not a licence or legal advice.</p>
</body>
</html>`;
}

function printViaIframe(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return false;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  window.setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 1000);
  return true;
}

export function openEndUserStatementPrintDialog(input: EndUserStatementInput): boolean {
  const html = endUserStatementPrintableHtml(input);
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

  if (win.document.readyState === "complete") {
    triggerPrint();
  } else {
    win.addEventListener("load", triggerPrint, { once: true });
  }

  return true;
}

/** Download the completed EUSU as an HTML file the end user can save / convert to PDF. */
export function downloadEndUserStatementHtml(input: EndUserStatementInput): void {
  const html = endUserStatementPrintableHtml(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `EUSU-${input.assessmentReference}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
