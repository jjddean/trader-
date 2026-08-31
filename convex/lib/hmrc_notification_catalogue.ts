/**
 * Authoritative HMRC notification catalogue.
 *
 * Source: Customs Declarations End-to-End Service Guide — Receiving notifications
 * https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/notifications.html
 *
 * FunctionCode → DMS type is taken only from that table. Payload, originating
 * operation, and UI must not rename the HMRC event.
 *
 * HTTP 202 on submit is not a DMS notification (Customs Declarations API /
 * Pull Notifications API). Received ≠ legally accepted ≠ released
 * (Customs Declarations Information API: ReceivedDateTime, AcceptanceDateTime,
 * GoodsReleasedDateTime).
 */

export type CdsBadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

export type FreightCodeDeclarationStatus =
  | "Draft"
  | "Submitted"
  | "Processing"
  | "Received"
  | "Accepted"
  | "Released"
  | "Cleared"
  | "Rejected"
  | "Cancelled"
  | "Invalid"
  | "Action Required"
  | "Amended"
  | "Amendment Processing"
  | "Cancellation Requested"
  | "Inventory Rejected";

export interface HmrcNotificationCatalogueEntry {
  functionCode: string;
  dmsType: string;
  hmrcMeaning: string;
  businessStatus: FreightCodeDeclarationStatus;
  userLabel: string;
  timelineTitle: string;
  tone: CdsBadgeTone;
  actionRequired: boolean;
}

/** Official FunctionCode → DMS type. FC 04 is not on the HMRC table. */
export const HMRC_FUNCTION_CODE_TO_DMS: Record<string, string> = {
  "01": "DMSACC",
  "02": "DMSRCV",
  "03": "DMSREJ",
  "05": "DMSCTL",
  "06": "DMSDOC",
  "07": "DMSRES",
  "08": "DMSROG",
  "09": "DMSCLE",
  "10": "DMSINV",
  "11": "DMSREQ",
  "13": "DMSTAX",
  "14": "DMSCPI",
  "15": "DMSCPR",
  "16": "DMSEOG",
  "17": "DMSEXT",
  "18": "DMSGER",
  "50": "DMSALV",
  "51": "DMSQRY",
};

const ENTRIES: HmrcNotificationCatalogueEntry[] = [
  {
    functionCode: "01",
    dmsType: "DMSACC",
    hmrcMeaning: "The declaration has been legally accepted.",
    businessStatus: "Accepted",
    userLabel: "Accepted by HMRC",
    timelineTitle: "Declaration legally accepted (DMSACC)",
    tone: "success",
    actionRequired: false,
  },
  {
    functionCode: "02",
    dmsType: "DMSRCV",
    hmrcMeaning: "The message has been registered. This can apply to pre-lodged declarations as well as additional messages.",
    businessStatus: "Received",
    userLabel: "Received by HMRC",
    timelineTitle: "Message registered (DMSRCV)",
    tone: "info",
    actionRequired: false,
  },
  {
    functionCode: "03",
    dmsType: "DMSREJ",
    hmrcMeaning: "The received message has been rejected. This can apply to declarations and additional messages.",
    businessStatus: "Rejected",
    userLabel: "Rejected by HMRC",
    timelineTitle: "Message rejected (DMSREJ)",
    tone: "danger",
    actionRequired: true,
  },
  {
    functionCode: "05",
    dmsType: "DMSCTL",
    hmrcMeaning: "Customs intends to physically examine the goods. Only received when the goods are on hand.",
    businessStatus: "Action Required",
    userLabel: "Goods selected for examination",
    timelineTitle: "Physical examination (DMSCTL)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "06",
    dmsType: "DMSDOC",
    hmrcMeaning: "The submitter is asked to present one or more documents related to the declaration.",
    businessStatus: "Action Required",
    userLabel: "Documents required",
    timelineTitle: "Documents required (DMSDOC)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "07",
    dmsType: "DMSRES",
    hmrcMeaning: "Corrections have been applied to the declaration by the trader, or as a result of physical inspection by customs.",
    businessStatus: "Amended",
    userLabel: "Declaration corrected",
    timelineTitle: "Corrections applied (DMSRES)",
    tone: "info",
    actionRequired: false,
  },
  {
    functionCode: "08",
    dmsType: "DMSROG",
    hmrcMeaning: "The goods can now be released. This is different to clearance as it implies that the debt calculated is not yet finalised.",
    businessStatus: "Released",
    userLabel: "Goods released",
    timelineTitle: "Goods released (DMSROG)",
    tone: "success",
    actionRequired: false,
  },
  {
    functionCode: "09",
    dmsType: "DMSCLE",
    hmrcMeaning: "The declaration is now cleared, and by implication, the goods can be released.",
    businessStatus: "Cleared",
    userLabel: "Declaration cleared",
    timelineTitle: "Declaration cleared (DMSCLE)",
    tone: "success",
    actionRequired: false,
  },
  {
    functionCode: "10",
    dmsType: "DMSINV",
    hmrcMeaning: "The declaration has now been cancelled. This can be as a result of a trader-initiated invalidation, or system-initiated.",
    businessStatus: "Cancelled",
    userLabel: "Declaration cancelled",
    timelineTitle: "Declaration cancelled (DMSINV)",
    tone: "success",
    actionRequired: false,
  },
  {
    functionCode: "11",
    dmsType: "DMSREQ",
    hmrcMeaning: "Acceptance or denial of the additional message submitted to customs.",
    businessStatus: "Action Required",
    userLabel: "Additional message outcome",
    timelineTitle: "Additional message outcome (DMSREQ)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "13",
    dmsType: "DMSTAX",
    hmrcMeaning: "The submitter is informed of the duties liable.",
    businessStatus: "Accepted",
    userLabel: "Duty and VAT assessed",
    timelineTitle: "Duties liable (DMSTAX)",
    tone: "info",
    actionRequired: false,
  },
  {
    functionCode: "14",
    dmsType: "DMSCPI",
    hmrcMeaning: "Insufficient balance against a deferred method of payment.",
    businessStatus: "Action Required",
    userLabel: "Insufficient deferment balance",
    timelineTitle: "Insufficient deferment balance (DMSCPI)",
    tone: "danger",
    actionRequired: true,
  },
  {
    functionCode: "15",
    dmsType: "DMSCPR",
    hmrcMeaning: "Reminder to take action on insufficient deferred balance, or to make an immediate payment.",
    businessStatus: "Action Required",
    userLabel: "Payment action required",
    timelineTitle: "Payment reminder (DMSCPR)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "16",
    dmsType: "DMSEOG",
    hmrcMeaning: "EXPORTS ONLY. The goods have now exited the customs union.",
    businessStatus: "Cleared",
    userLabel: "Goods exited",
    timelineTitle: "Goods exited the customs union (DMSEOG)",
    tone: "success",
    actionRequired: false,
  },
  {
    functionCode: "17",
    dmsType: "DMSEXT",
    hmrcMeaning: "The declaration needs to be handled manually.",
    businessStatus: "Action Required",
    userLabel: "Manual handling required",
    timelineTitle: "Manual handling (DMSEXT)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "18",
    dmsType: "DMSGER",
    hmrcMeaning: "EXPORTS ONLY. Exit results have not yet been received by the Export system.",
    businessStatus: "Action Required",
    userLabel: "Exit results not received",
    timelineTitle: "Exit results not received (DMSGER)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "50",
    dmsType: "DMSALV",
    hmrcMeaning: "A decision has been made by Defra that will delay clearance of the goods.",
    businessStatus: "Action Required",
    userLabel: "Defra decision — clearance delayed",
    timelineTitle: "Defra decision delaying clearance (DMSALV)",
    tone: "warning",
    actionRequired: true,
  },
  {
    functionCode: "51",
    dmsType: "DMSQRY",
    hmrcMeaning: "A query has been raised on the declaration by Customs.",
    businessStatus: "Action Required",
    userLabel: "Query raised by HMRC",
    timelineTitle: "Query raised (DMSQRY)",
    tone: "warning",
    actionRequired: true,
  },
];

const BY_FUNCTION_CODE = new Map(ENTRIES.map((e) => [e.functionCode, e]));
const BY_DMS_TYPE = new Map(ENTRIES.map((e) => [e.dmsType, e]));

export function padFunctionCode(raw: string): string {
  const digits = String(raw ?? "").trim();
  if (!/^\d+$/.test(digits)) return "";
  return digits.padStart(2, "0");
}

export function dmsTypeFromFunctionCode(functionCode: string): string | undefined {
  const code = padFunctionCode(functionCode);
  if (!code) return undefined;
  return HMRC_FUNCTION_CODE_TO_DMS[code];
}

export function catalogueEntryForFunctionCode(
  functionCode: string,
): HmrcNotificationCatalogueEntry | undefined {
  return BY_FUNCTION_CODE.get(padFunctionCode(functionCode));
}

export function catalogueEntryForDmsType(
  dmsType: string,
): HmrcNotificationCatalogueEntry | undefined {
  return BY_DMS_TYPE.get(String(dmsType ?? "").trim().toUpperCase());
}

/**
 * Prefer Response/FunctionCode (the notification). Fall back to the first
 * FunctionCode in the document.
 */
export function extractFunctionCode(rawPayload: string): string {
  const raw = String(rawPayload ?? "");
  const inResponse = raw.match(
    /<(?:[^>]*:)?Response\b[\s\S]*?<(?:[^>]*:)?FunctionCode[^>]*>(\d+)<\/(?:[^>]*:)?FunctionCode>/i,
  );
  if (inResponse?.[1]) return padFunctionCode(inResponse[1]);
  const first = raw.match(/<(?:[^>]*:)?FunctionCode[^>]*>(\d+)<\/(?:[^>]*:)?FunctionCode>/i);
  return first?.[1] ? padFunctionCode(first[1]) : "";
}

export function unknownFunctionCodeDmsType(functionCode: string): string {
  const code = padFunctionCode(functionCode);
  return code ? `FUNC_${code}` : "UNKNOWN";
}

/** Resolve the HMRC DMS type. FunctionCode in XML wins over a stored type. */
export function resolveHmrcDmsType(params: {
  rawPayload?: string | null;
  storedNotificationType?: string | null;
  functionCode?: string | null;
}): string {
  const fromArg = padFunctionCode(String(params.functionCode ?? ""));
  const fromXml = params.rawPayload ? extractFunctionCode(params.rawPayload) : "";
  const functionCode = fromArg || fromXml;
  if (functionCode) {
    return dmsTypeFromFunctionCode(functionCode) ?? unknownFunctionCodeDmsType(functionCode);
  }
  const stored = String(params.storedNotificationType ?? "").trim().toUpperCase();
  if (stored) return stored;
  return "UNKNOWN";
}

export function businessStatusFromDmsType(dmsType: string): FreightCodeDeclarationStatus {
  const entry = catalogueEntryForDmsType(dmsType);
  if (entry) return entry.businessStatus;
  if (dmsType === "DMSUB" || dmsType === "DMSSUB") return "Submitted";
  return "Processing";
}

export function presentationForDmsType(dmsType: string): {
  userLabel: string;
  badgeLabel: string;
  timelineTitle: string;
  detail: string;
  tone: CdsBadgeTone;
  actionRequired: boolean;
} {
  const entry = catalogueEntryForDmsType(dmsType);
  if (entry) {
    return {
      userLabel: entry.userLabel,
      badgeLabel: `${entry.userLabel} (${entry.dmsType})`,
      timelineTitle: entry.timelineTitle,
      detail: entry.hmrcMeaning,
      tone: entry.tone,
      actionRequired: entry.actionRequired,
    };
  }
  if (dmsType === "DMSUB" || dmsType === "DMSSUB") {
    return {
      userLabel: "Submitted",
      badgeLabel: "Submitted",
      timelineTitle: "Declaration submitted",
      detail: "FreightCode submitted the declaration. HTTP 202 is not a DMS notification.",
      tone: "info",
      actionRequired: false,
    };
  }
  return {
    userLabel: "HMRC update",
    badgeLabel: `HMRC update (${dmsType || "UNKNOWN"})`,
    timelineTitle: `HMRC update (${dmsType || "UNKNOWN"})`,
    detail: "Unrecognised notification type.",
    tone: "info",
    actionRequired: false,
  };
}

export const CATALOGUE_SOURCE_URL =
  "https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/notifications.html";
