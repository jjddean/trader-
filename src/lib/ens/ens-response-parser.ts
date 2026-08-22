/**
 * Parses the synchronous responses from the S&S Declarations API.
 *
 * Schemas:
 *   `docs/hmrc/ens/schemas/declarations/SuccessResponse-v2-0.xsd`
 *   `docs/hmrc/ens/schemas/declarations/errorresponse-v2.0.xsd`
 *
 * A 200 carries a `SuccessResponse` with a correlation ID. That means HMRC
 * accepted the *message*, not the declaration — the outcome arrives later on a
 * different API, and the correlation ID is the only handle on it until an MRN
 * exists. Persist it before returning.
 *
 * A 400 carries an `ErrorResponse` listing every error found. Schema errors are
 * 4000–4999, business-rule errors mainly 8000–8999. Either way **no outcome is
 * ever produced**, so nothing should be queued for polling.
 */

import { XMLParser } from "fast-xml-parser";

import type { EnsSubmissionError } from "./types";

/** Namespace-agnostic: HMRC prefixes vary between `ns:` and none. */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
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

export interface EnsSuccessResponse {
  kind: "success";
  correlationId: string;
}

export interface EnsErrorResponse {
  kind: "error";
  errors: EnsSubmissionError[];
}

export type EnsSubmissionResponse = EnsSuccessResponse | EnsErrorResponse;

/**
 * Parse a `SuccessResponse`. Returns null when the body is not one, so the
 * caller can fall through to the error parser rather than guessing from the
 * HTTP status alone.
 */
export function parseSuccessResponse(xml: string): EnsSuccessResponse | null {
  if (!xml || !xml.includes("SuccessResponse")) return null;
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  const root = doc?.SuccessResponse;
  if (!root) return null;
  const correlationId = text(root?.ResponseData?.CorrelationId);
  if (!correlationId) return null;
  return { kind: "success", correlationId };
}

/**
 * Parse an `ErrorResponse`.
 *
 * The schema puts the code in `Number`, the human text in one or more `Text`
 * elements, and the XML path in `Location`. `Location` is what maps an error
 * back to a field — it matches the `contextElement` recorded in
 * `docs/hmrc/ens/validation/business-rules.json`.
 */
export function parseErrorResponse(xml: string): EnsErrorResponse | null {
  if (!xml || !xml.includes("ErrorResponse")) return null;
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  const root = doc?.ErrorResponse;
  if (!root) return null;

  const errors: EnsSubmissionError[] = asArray<Record<string, any>>(root.Error).map((err) => {
    const description = asArray<unknown>(err?.Text).map(text).filter(Boolean).join(" ");
    return {
      errorCode: text(err?.Number),
      contextElement: text(err?.Location) || undefined,
      description: description || text(err?.Type) || undefined,
    };
  });

  return { kind: "error", errors };
}

/**
 * Parse whichever response HMRC returned.
 *
 * Body shape decides, not HTTP status: a 200 with an unparseable body is a
 * failure, and treating status as authoritative would record a submission as
 * accepted with no correlation ID to track it.
 */
export function parseSubmissionResponse(xml: string): EnsSubmissionResponse {
  const success = parseSuccessResponse(xml);
  if (success) return success;

  const error = parseErrorResponse(xml);
  if (error) return error;

  return {
    kind: "error",
    errors: [
      {
        errorCode: "UNPARSEABLE",
        description: "HMRC returned a body that is neither a SuccessResponse nor an ErrorResponse.",
      },
    ],
  };
}

/** True when every error is a schema error (4000–4999). */
export function isSchemaOnlyFailure(errors: EnsSubmissionError[]): boolean {
  if (errors.length === 0) return false;
  return errors.every((e) => {
    const n = Number(e.errorCode);
    return Number.isFinite(n) && n >= 4000 && n <= 4999;
  });
}

/** Groups errors by band for display. Unknown codes are kept, never dropped. */
export function groupErrorsByBand(errors: EnsSubmissionError[]) {
  const schema: EnsSubmissionError[] = [];
  const business: EnsSubmissionError[] = [];
  const other: EnsSubmissionError[] = [];
  for (const e of errors) {
    const n = Number(e.errorCode);
    if (Number.isFinite(n) && n >= 4000 && n <= 4999) schema.push(e);
    else if (Number.isFinite(n) && n >= 8000 && n <= 8999) business.push(e);
    else other.push(e);
  }
  return { schema, business, other };
}
