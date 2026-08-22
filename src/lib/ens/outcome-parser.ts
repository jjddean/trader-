/**
 * Parses responses from the S&S GB Outcomes API.
 *
 * Schemas: `docs/hmrc/ens/schemas/outcomes/`
 *   `outcomes.xsd`        — the list wrapper
 *   `CC328A-v10-0.xsd`    — IE328, new ENS accepted; carries the MRN
 *   `CC316A-v10-0.xsd`    — IE316, new ENS rejected
 *   `CC304A-v10-0.xsd`    — IE304, amendment accepted
 *   `CC305A-v10-0.xsd`    — IE305, amendment rejected
 *
 * Two things the schema settles that the prose does not:
 *
 * 1. On the **list**, presence of `<MRN>` is the accept/reject discriminator.
 *    The schema says so directly: "This element is only present for
 *    declarations that have been successfully issued with an MRN. If no MRN
 *    element is present, perform a GET on the link to collect the error
 *    response."
 * 2. On a **retrieved IE328**, the MRN is `HEAHEA/DocNumHEA5`, not `RefNumHEA4`.
 *    `RefNumHEA4` is the LRN the trader sent. Reading the wrong one gives a
 *    plausible-looking string that is not an MRN.
 */

import { XMLParser } from "fast-xml-parser";

import type { EnsIntervention, EnsOutcomeType, EnsSubmissionError } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const inner = (value as Record<string, unknown>)["#text"];
    return inner === undefined ? "" : String(inner).trim();
  }
  return String(value).trim();
}

/** One entry from `GET /customs/imports/outcomes`. */
export interface EnsOutcomeListEntry {
  correlationId: string;
  /** HMRC's own link — use it rather than rebuilding the path. */
  link: string;
  /** Present only on acceptance. Absence means this is a rejection. */
  movementReferenceNumber?: string;
  /** Derived from MRN presence, per the schema annotation. */
  accepted: boolean;
}

/**
 * Parse the unacknowledged-outcomes list.
 *
 * The schema caps `response` at 50 per page, so an empty list does not mean
 * "nothing pending" — it means nothing pending *right now*. Callers should keep
 * polling until the list is empty across a full cycle.
 */
export function parseOutcomeList(xml: string): EnsOutcomeListEntry[] {
  if (!xml) return [];
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const root = doc?.entryDeclarationResponses;
  if (!root) return [];

  return asArray<Record<string, any>>(root.response)
    .map((r) => {
      const correlationId = text(r?.correlationId);
      const mrn = text(r?.MRN);
      return {
        correlationId,
        link: text(r?.link),
        movementReferenceNumber: mrn || undefined,
        accepted: Boolean(mrn),
      };
    })
    .filter((e) => e.correlationId);
}

/** A retrieved outcome, whichever message it turned out to be. */
export interface ParsedEnsOutcome {
  outcomeType: EnsOutcomeType;
  /** `MesIdeMES19` */
  messageId?: string;
  /** `CorIdeMES25` — the original message's correlation identifier. */
  correlationIdentifier?: string;
  /** `HEAHEA/RefNumHEA4` — the LRN the trader sent. Never the MRN. */
  localReferenceNumber?: string;
  /** `HEAHEA/DocNumHEA5` — present on IE328 and IE304. */
  movementReferenceNumber?: string;
  /** IE316 `DecRejReaHEA252`, or the IE305 equivalent. */
  rejectionReason?: string;
  /** `HEAHEA/DecRegDatTimHEA115` or the rejection timestamp. */
  outcomeDateTime?: string;
  /** `FUNERRER1` entries on a rejection. */
  errors: EnsSubmissionError[];
  accepted: boolean;
}

const MESSAGE_TO_OUTCOME: Record<string, EnsOutcomeType> = {
  CC328A: "IE328",
  CC316A: "IE316",
  CC304A: "IE304",
  CC305A: "IE305",
};

/**
 * `FUNERRER1` → the same error shape the submission path produces, so the UI
 * has one error type to render regardless of which layer rejected.
 *
 * `ErrPoiER12` is the XML pointer and maps to `contextElement` in
 * `docs/hmrc/ens/validation/business-rules.json`.
 */
function parseFunctionalErrors(node: unknown): EnsSubmissionError[] {
  return asArray<Record<string, any>>(node as never)
    .map((e) => ({
      errorCode: text(e?.ErrTypER11),
      contextElement: text(e?.ErrPoiER12) || undefined,
      description: text(e?.ErrReaER13) || undefined,
      originalValue: text(e?.OriAttValER14) || undefined,
    }))
    .filter((e) => e.errorCode || e.contextElement || e.description);
}

/**
 * Parse a retrieved outcome document.
 *
 * Returns null when the body is not a recognised outcome message — the caller
 * must not guess, because recording the wrong outcome type against a
 * declaration is worse than recording none.
 */
export function parseOutcome(xml: string): ParsedEnsOutcome | null {
  if (!xml) return null;
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }

  // The retrieve endpoint may wrap the message; unwrap one level if needed.
  const container = doc?.outcomeResponse?.response ?? doc?.response ?? doc;
  let messageKey: string | undefined;
  let body: Record<string, any> | undefined;
  for (const key of Object.keys(MESSAGE_TO_OUTCOME)) {
    if (container?.[key]) {
      messageKey = key;
      body = container[key];
      break;
    }
  }
  if (!messageKey || !body) return null;

  const head = body.HEAHEA ?? {};
  const outcomeType = MESSAGE_TO_OUTCOME[messageKey];
  const accepted = outcomeType === "IE328" || outcomeType === "IE304";

  return {
    outcomeType,
    messageId: text(body.MesIdeMES19) || undefined,
    correlationIdentifier: text(body.CorIdeMES25) || undefined,
    localReferenceNumber: text(head.RefNumHEA4) || undefined,
    // DocNumHEA5 is the MRN. RefNumHEA4 is the trader's LRN — not interchangeable.
    movementReferenceNumber: text(head.DocNumHEA5) || undefined,
    rejectionReason: text(head.DecRejReaHEA252) || text(head.AmeRejReaHEA602) || undefined,
    outcomeDateTime:
      text(head.DecRegDatTimHEA115)
      || text(head.DecRejDatTimHEA116)
      || text(head.AmeAccDatTimHEA111)
      || text(head.AmeRejDatTimHEA112)
      || undefined,
    errors: parseFunctionalErrors(body.FUNERRER1),
    accepted,
  };
}

/** One entry from `GET /customs/imports/notifications`. */
export interface EnsNotificationListEntry {
  notificationId: string;
  correlationId?: string;
  link?: string;
}

/** Parse the unacknowledged-notifications list (`listInterventions.xsd`). */
export function parseNotificationList(xml: string): EnsNotificationListEntry[] {
  if (!xml) return [];
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const root = doc?.entryDeclarationResponses ?? doc?.notifications ?? doc?.interventions;
  if (!root) return [];
  return asArray<Record<string, any>>(root.response ?? root.notification)
    .map((r) => ({
      notificationId: text(r?.notificationId) || text(r?.notificationID),
      correlationId: text(r?.correlationId) || undefined,
      link: text(r?.link) || undefined,
    }))
    .filter((e) => e.notificationId);
}

export interface ParsedEnsNotification {
  messageId?: string;
  correlationIdentifier?: string;
  movementReferenceNumber?: string;
  interventions: EnsIntervention[];
  /** True when any intervention is a Do Not Load. */
  doNotLoad: boolean;
  /** The DELETE href HMRC supplies in `<acknowledgement>`. Prefer it. */
  acknowledgementHref?: string;
}

/**
 * Do Not Load intervention codes.
 *
 * HMRC does not publish a machine-readable DNL code list in this pack, so
 * detection is by the documented `A001` code plus a text match on the
 * intervention description. Erring toward flagging: a DNL missed is goods
 * loaded that must not be, while a false positive is a operator reading one
 * extra alert.
 */
const DNL_CODES = new Set(["A001"]);

function isDoNotLoad(i: EnsIntervention): boolean {
  if (DNL_CODES.has(i.interventionCode.toUpperCase())) return true;
  const t = (i.interventionText ?? "").toLowerCase();
  return t.includes("do not load") || t.includes("donotload");
}

/** Parse a retrieved IE351 advanced notification (`advancedNotification.xsd`). */
export function parseNotification(xml: string): ParsedEnsNotification | null {
  if (!xml) return null;
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }

  const wrapper = doc?.notificationResponse ?? doc;
  const container = wrapper?.response ?? wrapper;
  const body = container?.CC351A;
  if (!body) return null;

  const head = body.HEAHEA ?? {};
  const interventions: EnsIntervention[] = asArray<Record<string, any>>(body.CUSINT632)
    .map((i) => ({
      interventionCode: text(i?.CusIntCodCUSINT665),
      interventionText: text(i?.CusIntTexCUSINT666) || undefined,
      itemNumber: text(i?.IteNumConCUSINT668) ? Number(text(i?.IteNumConCUSINT668)) : undefined,
    }))
    .filter((i) => i.interventionCode || i.interventionText);

  const ack = wrapper?.acknowledgement;
  const acknowledgementHref = ack ? text(ack["@_href"]) || undefined : undefined;

  return {
    messageId: text(body.MesIdeMES19) || undefined,
    correlationIdentifier: text(body.CorIdeMES25) || undefined,
    movementReferenceNumber: text(head.DocNumHEA5) || undefined,
    interventions,
    doNotLoad: interventions.some(isDoNotLoad),
    acknowledgementHref,
  };
}
