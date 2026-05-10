/**
 * Parses HMRC DMS notification XML payloads into structured fields.
 * Used by both the push webhook and pull notifications routes.
 */

const DMS_TYPES = ["DMSCLE", "DMSACC", "DMSREJ", "DMSROG", "DMSINV", "DMSTAX", "DMSCTL", "DMSRES", "DMSRCV", "DMSREQ", "DMSQRY", "DMSDOC", "DMSNOTFN", "DMSSUB", "DMSUB"];

const FUNCTION_CODE_MAP: Record<string, string> = {
  "01": "DMSACC",
  "02": "DMSINV",
  "03": "DMSREJ",
  "04": "DMSROG",
  "05": "DMSROG",
  "06": "DMSTAX",
  "07": "DMSCTL",
  "08": "DMSRES",
  "09": "DMSACC",
  "10": "DMSDOC",
  "11": "DMSCLE",
  "13": "DMSREJ",
  "14": "DMSINV",
};

export interface ParsedNotification {
  notificationType: string;
  mrn: string;
  errorCodes: string[];
  fieldErrors: Array<{ field: string; code?: string; reason: string }>;
}

function readTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<(?:[^>]*:)?${tagName}[^>]*>([^<]+)<\\/(?:[^>]*:)?${tagName}>`, "i"));
  return match?.[1]?.trim() || "";
}

function formatPointers(errorBlock: string): string {
  const parts: string[] = [];
  const pointerRegex = /<(?:[^>]*:)?Pointer[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Pointer>/gi;
  let pointerMatch: RegExpExecArray | null;
  while ((pointerMatch = pointerRegex.exec(errorBlock)) !== null) {
    const pointer = pointerMatch[1];
    const section = readTag(pointer, "DocumentSectionCode");
    const sequence = readTag(pointer, "SequenceNumeric");
    const tagId = readTag(pointer, "TagID");
    const sectionPart = section
      ? `${section}${sequence ? `[${sequence}]` : ""}`
      : sequence
        ? `Sequence ${sequence}`
        : "";
    const tagPart = tagId ? `Tag ${tagId}` : "";
    const formatted = [sectionPart, tagPart].filter(Boolean).join(" ");
    if (formatted) parts.push(formatted);
  }
  return parts.join(" > ");
}

function decodePointerField(pointerPath: string): string {
  if (!pointerPath) return "Declaration";
  if (pointerPath.includes("64A Tag L110")) return "AdditionalInformation L110";
  if (pointerPath.includes("64A Tag L016")) return "AdditionalInformation L016";
  if (pointerPath.includes("02A[1] Tag D006")) return "AdditionalDocument D006";
  if (pointerPath.includes("02A[1] Tag D031")) return "AdditionalDocument D031";
  if (pointerPath.includes("02A[1] Tag 360")) return "AdditionalDocument 360";
  if (pointerPath.includes("17C[1] Tag R145")) return "Declarant R145";
  if (pointerPath.includes("17C[1] Tag R144")) return "Declarant R144";
  if (pointerPath.includes("05A Tag R004")) return "Declarant R004";
  if (pointerPath.includes("57B Tag R123")) return "BorderTransportMeans R123";
  if (pointerPath.includes("74A Tag R038")) return "PaymentMethod R038";
  if (pointerPath.includes("41A Tag 122")) return "Packaging Tag 122";
  if (pointerPath.includes("39B Tag 188")) return "GovernmentProcedure Tag 188";
  if (pointerPath.includes("99B Tag 465")) return "AdditionalDocument Tag 465";
  if (pointerPath.includes("22B")) return "ExportCountry";
  if (pointerPath.includes("30A")) return "ValuationAdjustment";
  return pointerPath;
}

export function parseHmrcNotification(rawPayload: string): ParsedNotification {
  const upper = rawPayload.toUpperCase();

  // 1. Literal DMS code in payload body
  let notificationType = "UNKNOWN";
  for (const t of DMS_TYPES) {
    if (upper.includes(t)) { notificationType = t; break; }
  }

  // 2. <NameCode> element
  if (notificationType === "UNKNOWN") {
    const m = rawPayload.match(/<(?:[^>]*:)?NameCode[^>]*>([^<]+)<\/(?:[^>]*:)?NameCode>/i);
    if (m?.[1]) notificationType = m[1].trim().toUpperCase();
  }

  // 3. <FunctionCode> numeric fallback (extended map)
  if (notificationType === "UNKNOWN") {
    const m = rawPayload.match(/<(?:[^>]*:)?FunctionCode[^>]*>(\d+)<\/(?:[^>]*:)?FunctionCode>/i);
    if (m?.[1]) notificationType = FUNCTION_CODE_MAP[m[1]] || `FUNC_${m[1]}`;
  }

  // MRN — try <ID> tag with 18-char CDS format first, then bare regex
  let mrn = "UNKNOWN";
  const idTagMatch = rawPayload.match(/<(?:[^>]*:)?ID[^>]*>([0-9]{2}[A-Za-z]{2}[A-Za-z0-9]{14})<\/(?:[^>]*:)?ID>/i);
  if (idTagMatch?.[1]) {
    mrn = idTagMatch[1];
  } else {
    const bareMatch = rawPayload.match(/\b(\d{2}[A-Z]{2}[A-Z0-9]{14})\b/);
    if (bareMatch?.[1]) mrn = bareMatch[1];
  }

  // Error codes and field errors from <FunctionalError> elements (DMSREJ / DMSINV)
  const errorCodes: string[] = [];
  const fieldErrors: Array<{ field: string; code?: string; reason: string }> = [];

  const functionalErrorRegex = /<(?:[^>]*:)?FunctionalError[^>]*>([\s\S]*?)<\/(?:[^>]*:)?FunctionalError>/gi;
  let errMatch: RegExpExecArray | null;
  while ((errMatch = functionalErrorRegex.exec(rawPayload)) !== null) {
    const block = errMatch[1];
    const pointer = readTag(block, "ErrorPointer");
    const code = readTag(block, "ValidationCode") || readTag(block, "ErrorCode");
    const reason = readTag(block, "ErrorReason");
    if (code && !errorCodes.includes(code)) errorCodes.push(code);
    if (pointer || reason) {
      fieldErrors.push({ field: pointer || "Declaration", code: code || undefined, reason: reason || code });
    }
  }

  const errorRegex = /<(?:[^>]*:)?Error[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Error>/gi;
  while ((errMatch = errorRegex.exec(rawPayload)) !== null) {
    const block = errMatch[1];
    const code =
      readTag(block, "ValidationCode") ||
      readTag(block, "Code") ||
      readTag(block, "ErrorCode");
    const reason =
      readTag(block, "Description") ||
      readTag(block, "Reason") ||
      readTag(block, "Text");
    const pointerPath = formatPointers(block);
    if (code && !errorCodes.includes(code)) errorCodes.push(code);
    if (code || pointerPath || reason) {
      fieldErrors.push({
        field: decodePointerField(pointerPath),
        code: code || undefined,
        reason: reason || (code ? `${code}${pointerPath ? ` at ${pointerPath}` : ""}` : "HMRC validation error"),
      });
    }
  }

  return { notificationType, mrn, errorCodes, fieldErrors };
}
