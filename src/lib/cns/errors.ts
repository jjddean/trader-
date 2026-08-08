/**
 * CNS error normalisation.
 *
 * Two response body shapes exist across CSPs (Declaration API v1.0.3, Error
 * scenarios): MCP wraps in <errorResponse>, CNS wraps in <error>. MDTP errors
 * forwarded by the CSP add a nested <errorDetail><errors><error> block carrying
 * the XSD validation failures. All three are handled here.
 *
 * Disposition follows spec §6.4 and drives whether an attempt may be retried.
 */

/** What the caller is allowed to do next. */
export type CnsErrorDisposition =
  /** Configuration/credential defect. Never retry until an operator fixes it. */
  | "stop_configuration"
  /** The payload is wrong. Never retry the same XML. */
  | "stop_payload"
  /** Transport rate limit. The attempt stays pending; back off and retry later. */
  | "retry_backoff"
  /** No definitive answer. Outcome is unknown — poll notifications before retrying. */
  | "outcome_unknown";

export interface CnsErrorDetailItem {
  code: string;
  message: string;
}

export interface NormalizedCnsError {
  httpStatus: number;
  /** Machine-readable code from the body, e.g. INVALID_BADGE_ID. */
  code: string;
  message: string;
  /** Nested XSD/schema failures from an MDTP <errorDetail> block. */
  details: CnsErrorDetailItem[];
  disposition: CnsErrorDisposition;
  /** True when an operator/developer must be alerted rather than the end user. */
  alert: boolean;
  /** Raw body, truncated. Persisted for support escalation with CNS. */
  rawBody: string;
}

const MAX_RAW_BODY = 8000;

/** Namespace-tolerant single-element text extractor. */
function tagText(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<(?:[^>]*:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^>]*:)?${tag}>`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

/**
 * Pull the nested errorDetail entries. These carry the actual schema pointer,
 * e.g. "cvc-complex-type.2.4.a: Invalid content was found starting with
 * element '…TypeCode'" — the operator-facing detail on a 400.
 */
function extractErrorDetails(body: string): CnsErrorDetailItem[] {
  const detailBlock = body.match(
    /<(?:[^>]*:)?errorDetail[^>]*>([\s\S]*?)<\/(?:[^>]*:)?errorDetail>/i,
  )?.[1];
  if (!detailBlock) return [];

  const items: CnsErrorDetailItem[] = [];
  const errorRegex = /<(?:[^>]*:)?error[^>]*>([\s\S]*?)<\/(?:[^>]*:)?error>/gi;
  let match: RegExpExecArray | null;
  while ((match = errorRegex.exec(detailBlock)) !== null) {
    const inner = match[1];
    const code = tagText(inner, "code");
    const message = tagText(inner, "message");
    if (code || message) items.push({ code, message });
  }
  return items;
}

/**
 * Codes that mean "the request will never succeed as configured", regardless of
 * the HTTP status they arrive with.
 */
const CONFIGURATION_CODES = new Set([
  "INVALID_BADGE_ID",
  "NOT_AUTHORIZED",
  "TOPIC_NOT_FOUND",
  "LOCKED_PUSH_MESSAGING_ACTIVE",
  "HTTPS_NOT_SPECIFIED",
  "PARTITION_PARAM_MISS_MATCH",
]);

/** Payload defects — the XML itself is wrong. */
const PAYLOAD_CODES = new Set(["MALFORMED_XML", "MISSING_FIELD"]);

function resolveDisposition(httpStatus: number, code: string): CnsErrorDisposition {
  const upper = code.toUpperCase();
  if (CONFIGURATION_CODES.has(upper)) return "stop_configuration";
  if (PAYLOAD_CODES.has(upper)) return "stop_payload";

  // 401/403 are always credential or subscription defects. 404/405/406 mean the
  // endpoint, method or Accept header is wrong. None are retryable as-is.
  if (httpStatus === 401 || httpStatus === 403) return "stop_configuration";
  if (httpStatus === 404 || httpStatus === 405 || httpStatus === 406) return "stop_configuration";
  if (httpStatus === 422 || httpStatus === 423) return "stop_configuration";

  // A 400 is a validation failure against the DMS XSD or a missing element.
  // Retrying byte-identical XML cannot succeed.
  if (httpStatus === 400) return "stop_payload";

  if (httpStatus === 429) return "retry_backoff";

  // 5xx, gateway timeouts and transport failures leave the outcome genuinely
  // unknown — CNS may still have forwarded the declaration. Never assume failure.
  return "outcome_unknown";
}

export function normalizeCnsError(httpStatus: number, rawBody: string): NormalizedCnsError {
  const body = String(rawBody ?? "");
  const code = tagText(body, "code");
  const message = tagText(body, "message");
  const details = extractErrorDetails(body);
  const disposition = resolveDisposition(httpStatus, code);

  return {
    httpStatus,
    code: code || `HTTP_${httpStatus}`,
    message: message || details[0]?.message || "CNS returned an error with no message.",
    details,
    disposition,
    // Configuration defects are never the operator's fault and never resolve on
    // their own; they need a developer. Unknown outcomes need the ops queue.
    alert: disposition === "stop_configuration" || disposition === "outcome_unknown",
    rawBody: body.slice(0, MAX_RAW_BODY),
  };
}

/**
 * Transport-level failure (timeout, DNS, socket) — no HTTP response at all.
 * Always an unknown outcome: the request may or may not have reached CNS.
 */
export function cnsTransportFailure(error: unknown): NormalizedCnsError {
  const message = error instanceof Error ? error.message : String(error);
  return {
    httpStatus: 0,
    code: "TRANSPORT_FAILURE",
    message,
    details: [],
    disposition: "outcome_unknown",
    alert: true,
    rawBody: "",
  };
}

/** True when the same operation may be re-sent unchanged after a delay. */
export function isRetryable(error: NormalizedCnsError): boolean {
  return error.disposition === "retry_backoff";
}

/**
 * True when the declaration state must become cns_outcome_unknown rather than
 * failed — the submission may still be in flight inside CNS.
 */
export function isOutcomeUnknown(error: NormalizedCnsError): boolean {
  return error.disposition === "outcome_unknown";
}
