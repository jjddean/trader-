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
    const pointer = block.match(/<(?:[^>]*:)?ErrorPointer[^>]*>([^<]+)<\/(?:[^>]*:)?ErrorPointer>/i)?.[1]?.trim() || "";
    const code = block.match(/<(?:[^>]*:)?ErrorCode[^>]*>([^<]+)<\/(?:[^>]*:)?ErrorCode>/i)?.[1]?.trim() || "";
    const reason = block.match(/<(?:[^>]*:)?ErrorReason[^>]*>([^<]+)<\/(?:[^>]*:)?ErrorReason>/i)?.[1]?.trim() || "";
    if (code && !errorCodes.includes(code)) errorCodes.push(code);
    if (pointer || reason) {
      fieldErrors.push({ field: pointer || "Declaration", code: code || undefined, reason: reason || code });
    }
  }

  // Also check <Error> elements (alternative HMRC error format)
  if (errorCodes.length === 0) {
    const errorRegex = /<(?:[^>]*:)?Error[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Error>/gi;
    while ((errMatch = errorRegex.exec(rawPayload)) !== null) {
      const block = errMatch[1];
      const code = block.match(/<(?:[^>]*:)?(?:Code|ErrorCode)[^>]*>([^<]+)<\/(?:[^>]*:)?(?:Code|ErrorCode)>/i)?.[1]?.trim() || "";
      const reason = block.match(/<(?:[^>]*:)?(?:Description|Reason|Text)[^>]*>([^<]+)<\/(?:[^>]*:)?(?:Description|Reason|Text)>/i)?.[1]?.trim() || "";
      if (code && !errorCodes.includes(code)) errorCodes.push(code);
      if (reason) fieldErrors.push({ field: "Declaration", code: code || undefined, reason });
    }
  }

  return { notificationType, mrn, errorCodes, fieldErrors };
}
