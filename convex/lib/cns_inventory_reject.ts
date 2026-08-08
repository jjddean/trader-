/**
 * Inventory pre-check failure detection.
 *
 * A CSP inventory pre-check rejection and an HMRC CDS rejection both arrive as
 * DMSREJ. Conflating them is the single worst failure mode in this integration:
 * an inventory rejection means the declaration never reached CDS at all, so
 * "rejected by HMRC" would be a false statement to the operator, and the
 * remediation is different (correct the Compass record, not the declaration).
 *
 * Signals (Declaration API v1.0.3 §7):
 *   - X-Notification-Type: DMS
 *   - Error/ValidationCode CDS20001 ("related Inventory movement not found")
 *   - Declaration/ID (MRN) always blank
 *   - X-CSP-ID present from the initial HTTP handshake
 *   - No ConversationID (not returned for pre-check failures)
 *   - AdditionalInformation/StatementCode  = CSP IRC code
 *   - AdditionalInformation/StatementDescription = IRC description
 */

import { header, type CnsNotificationHeaders } from "./cns_envelope";

/** Related inventory movement not found. */
export const INVENTORY_VALIDATION_CODE = "CDS20001";

/**
 * Existing declaration is not in a permissible state — raised when a Goods
 * Presentation is sent against an inventory-linked declaration.
 */
export const GPR_ON_INVENTORY_LINKED_CODE = "CDS12015";

export interface InventoryRejection {
  isInventoryPreCheck: boolean;
  validationCode: string;
  /** CSP IRC code from AdditionalInformation/StatementCode. */
  ircCode: string;
  /** IRC description from AdditionalInformation/StatementDescription. */
  ircDescription: string;
  /** Present only on a pre-check failure — the initial handshake correlation. */
  cspId: string;
  /** The LRN echoed back. The permanent correlation key. */
  functionalReferenceId: string;
  /** True when Declaration/ID carried no MRN, as expected for a pre-check fail. */
  mrnBlank: boolean;
}

function tagText(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<(?:[^>]*:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^>]*:)?${tag}>`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

function allTagText(xml: string, tag: string): string[] {
  const regex = new RegExp(
    `<(?:[^>]*:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^>]*:)?${tag}>`,
    "gi",
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const value = match[1]?.trim();
    if (value) out.push(value);
  }
  return out;
}

/**
 * Extract the MRN from a response Declaration block. Returns "" when blank,
 * which is the expected state for an inventory pre-check failure.
 */
function declarationMrn(payload: string): string {
  const declarationBlock = payload.match(
    /<(?:[^>]*:)?Declaration\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Declaration>/i,
  )?.[1];
  if (!declarationBlock) return "";
  const id = tagText(declarationBlock, "ID");
  // Only an 18-character CDS MRN counts; anything else is not an issued MRN.
  return /^[0-9]{2}[A-Za-z]{2}[A-Za-z0-9]{14}$/.test(id) ? id : "";
}

/**
 * Analyse a decoded DMS notification for inventory pre-check characteristics.
 *
 * Deliberately conservative: the validation code is the necessary condition.
 * The CSP-generated response carries ResponsibleAgencyName CSP, which is used as
 * corroboration but not required, since HMRC's own E0-equivalent DMSRCV also
 * carries CDS20001.
 */
export function analyseInventoryRejection(
  decodedBody: string,
  headers: CnsNotificationHeaders = {},
): InventoryRejection {
  const payload = String(decodedBody ?? "");

  const validationCodes = allTagText(payload, "ValidationCode");
  const validationCode =
    validationCodes.find((code) => code.toUpperCase() === INVENTORY_VALIDATION_CODE) ??
    validationCodes[0] ??
    "";

  const cspId = header(headers, "X-CSP-ID") ?? "";
  const mrn = declarationMrn(payload);

  // AdditionalInformation carries the IRC pair. Take the first block that has a
  // StatementCode — the pre-check response contains exactly one.
  const aiBlock =
    payload.match(
      /<(?:[^>]*:)?AdditionalInformation\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?AdditionalInformation>/i,
    )?.[1] ?? "";

  const isInventoryPreCheck =
    validationCode.toUpperCase() === INVENTORY_VALIDATION_CODE && mrn === "";

  return {
    isInventoryPreCheck,
    validationCode,
    ircCode: tagText(aiBlock, "StatementCode"),
    ircDescription: tagText(aiBlock, "StatementDescription"),
    cspId,
    functionalReferenceId: tagText(payload, "FunctionalReferenceID"),
    mrnBlank: mrn === "",
  };
}

/**
 * True when the notification reports a Goods Presentation sent against an
 * inventory-linked declaration. Should be unreachable — the transport refuses to
 * send GPR on this route — so reaching it means the guard was bypassed.
 */
export function isGprOnInventoryLinkedRejection(decodedBody: string): boolean {
  return allTagText(String(decodedBody ?? ""), "ValidationCode").some(
    (code) => code.toUpperCase() === GPR_ON_INVENTORY_LINKED_CODE,
  );
}

/**
 * Operator-facing summary. Shows the validation code, IRC pair and UCN so the
 * operator can act on the Compass record without reading raw XML (spec §9.3).
 */
export function describeInventoryRejection(
  rejection: InventoryRejection,
  ucn?: string,
): string {
  const parts = [`Inventory pre-check failed (${rejection.validationCode}).`];
  if (ucn) parts.push(`UCN ${ucn}.`);
  if (rejection.ircCode) {
    parts.push(
      rejection.ircDescription
        ? `IRC ${rejection.ircCode}: ${rejection.ircDescription}.`
        : `IRC ${rejection.ircCode}.`,
    );
  }
  parts.push("The declaration did not reach CDS.");
  return parts.join(" ");
}
