/**
 * Parses HMRC DMS notification XML. FunctionCode → DMS type comes only from
 * convex/lib/hmrc_notification_catalogue.ts (HMRC notifications guide).
 */

import {
  dmsTypeFromFunctionCode,
  extractFunctionCode,
  unknownFunctionCodeDmsType,
} from "./hmrc_notification_catalogue";

const LEGACY_DMS_TYPES = [
  "DMSCLE",
  "DMSACC",
  "DMSREJ",
  "DMSROG",
  "DMSINV",
  "DMSTAX",
  "DMSCTL",
  "DMSRES",
  "DMSRCV",
  "DMSREQ",
  "DMSQRY",
  "DMSDOC",
  "DMSCPI",
  "DMSCPR",
  "DMSEOG",
  "DMSEXT",
  "DMSGER",
  "DMSALV",
  "DMSNOTFN",
  "DMSSUB",
  "DMSUB",
];

const NAME_CODE_MAP: Record<string, string> = {
  "4": "DMSTAX",
  "67": "DMSTAX",
};

export interface ParsedNotification {
  notificationType: string;
  functionCode: string;
  mrn: string;
  errorCodes: string[];
  fieldErrors: Array<{ field: string; code?: string; reason: string }>;
  issueDateTime?: string;
}

export function hmrc304ToIso(raw: string | null | undefined): string | undefined {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, sec] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${sec}Z`;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? iso : undefined;
}

function notificationTypeFromPayload(rawPayload: string, functionCode: string): string {
  if (functionCode) {
    return dmsTypeFromFunctionCode(functionCode) ?? unknownFunctionCodeDmsType(functionCode);
  }

  const upper = rawPayload.toUpperCase();
  for (const t of LEGACY_DMS_TYPES) {
    if (upper.includes(t)) return t;
  }

  const m = rawPayload.match(/<(?:[^>]*:)?NameCode[^>]*>([^<]+)<\/(?:[^>]*:)?NameCode>/i);
  if (m?.[1]) {
    const code = m[1].trim().toUpperCase();
    return NAME_CODE_MAP[code] || code;
  }

  return "UNKNOWN";
}

export function parseHmrcNotification(rawPayload: string): ParsedNotification {
  const functionCode = extractFunctionCode(rawPayload);
  const notificationType = notificationTypeFromPayload(rawPayload, functionCode);

  let mrn = "UNKNOWN";
  const idTagMatch = rawPayload.match(/<(?:[^>]*:)?ID[^>]*>([0-9]{2}[A-Za-z]{2}[A-Za-z0-9]{14})<\/(?:[^>]*:)?ID>/i);
  if (idTagMatch?.[1]) {
    mrn = idTagMatch[1];
  } else {
    const bareMatch = rawPayload.match(/\b(\d{2}[A-Z]{2}[A-Z0-9]{14})\b/);
    if (bareMatch?.[1]) mrn = bareMatch[1];
  }

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

  const smartErrorReasons = [...rawPayload.matchAll(
    /<(?:[^>]*:)?AdditionalInformation\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?AdditionalInformation>/gi,
  )]
    .filter((match) => /<(?:[^>]*:)?StatementCode[^>]*>\s*smartErrorMsg\s*<\/(?:[^>]*:)?StatementCode>/i.test(match[1]))
    .map((match) => match[1].match(
      /<(?:[^>]*:)?StatementDescription[^>]*>([^<]+)<\/(?:[^>]*:)?StatementDescription>/i,
    )?.[1]?.trim() || "")
    .filter(Boolean);
  const errorRegex = /<(?:[^>]*:)?Error[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Error>/gi;
  let smartErrorIndex = 0;
  while ((errMatch = errorRegex.exec(rawPayload)) !== null) {
    const block = errMatch[1];
    const code =
      block.match(/<(?:[^>]*:)?(?:ValidationCode|ErrorCode|Code)[^>]*>([^<]+)<\/(?:[^>]*:)?(?:ValidationCode|ErrorCode|Code)>/i)?.[1]?.trim() || "";
    const reason = block.match(/<(?:[^>]*:)?(?:Description|Reason|Text)[^>]*>([^<]+)<\/(?:[^>]*:)?(?:Description|Reason|Text)>/i)?.[1]?.trim() || smartErrorReasons[smartErrorIndex] || "";
    smartErrorIndex += 1;
    const sectionPointers = [...block.matchAll(/<(?:[^>]*:)?DocumentSectionCode[^>]*>([^<]+)<\/(?:[^>]*:)?DocumentSectionCode>/gi)]
      .map((m) => m[1]?.trim())
      .filter(Boolean);
    const seq = block.match(/<(?:[^>]*:)?SequenceNumeric[^>]*>(\d+)<\/(?:[^>]*:)?SequenceNumeric>/i)?.[1];
    const field =
      sectionPointers.length > 0
        ? sectionPointers.join("/") + (seq ? ` item ${seq}` : "")
        : "Declaration";
    if (code && !errorCodes.includes(code)) errorCodes.push(code);
    if (code || reason) {
      fieldErrors.push({ field, code: code || undefined, reason: reason || code });
    }
  }

  const issueDateTimeRaw = rawPayload.match(
    /<(?:[^>]*:)?IssueDateTime[^>]*>[\s\S]*?<(?:[^>]*:)?DateTimeString[^>]*>([^<]+)<\/(?:[^>]*:)?DateTimeString>/i,
  )?.[1];
  const issueDateTime = hmrc304ToIso(issueDateTimeRaw);

  return { notificationType, functionCode, mrn, errorCodes, fieldErrors, issueDateTime };
}
