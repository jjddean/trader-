/**
 * HTTP client for the S&S GB Declarations API.
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md` §3–4
 *
 * Deliberately **not** routed through `hmrc-fetch.ts`. That wrapper is built for
 * the CDS Declarations API: it attaches fraud-prevention headers, an
 * `X-Submitter-Identifier`, and CDS Accept negotiation. The S&S APIs take none
 * of those, and passing them risks the HMRC WAF rejecting the request outright
 * (the `PAYLOAD_FORBIDDEN` class of failure the CDS path already had to work
 * around). Token acquisition, storage and environment selection are shared —
 * only the transport differs.
 *
 * Nothing here retries. A resubmission of a declaration HMRC already accepted
 * would create a second ENS with a second correlation ID, and the caller is the
 * only layer that knows whether that is safe.
 */

import { buildCC313A, buildCC315A, type BuildOptions } from "./cc315-builder";
import {
  ENS_CONTENT_TYPE,
  ensBaseHeaders,
  ensBaseUrl,
  ENS_PATHS,
  ensSimulationHeaders,
  type EnsEnvironment,
  type EnsSandboxSimulation,
} from "./ens-config";
import { parseSubmissionResponse, type EnsSubmissionResponse } from "./ens-response-parser";
import { validateEnsBusinessRules, type EnsRuleViolation } from "./ens-rules";
import type { EnsDeclaration } from "./types";

export interface EnsClientOptions {
  environment: EnsEnvironment;
  accessToken: string;
  /** `MesSenMES3` — must match the EORI the token was issued for. */
  messageSender: string;
  messageRecipient?: string;
  /** Sandbox only; ignored in production. See `docs/hmrc/ens/testing/sandbox.md`. */
  simulation?: EnsSandboxSimulation;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Fixes the clock so a build is reproducible. */
  now?: Date;
  timeoutMs?: number;
}

export interface EnsSubmitResult {
  /** HTTP status, or 0 when the request never completed. */
  httpStatus: number;
  /** Parsed body. Absent only when the request failed before a response. */
  response?: EnsSubmissionResponse;
  /** The XML sent, for the audit record. */
  requestXml: string;
  /** The body received, verbatim. */
  responseXml?: string;
  /** Local rule violations. When non-empty, nothing was sent. */
  localViolations?: EnsRuleViolation[];
  /** Transport-level failure — timeout, DNS, TLS. */
  transportError?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function buildOptions(opts: EnsClientOptions): BuildOptions {
  return {
    messageSender: opts.messageSender,
    messageRecipient: opts.messageRecipient,
    now: opts.now,
  };
}

async function post(
  url: string,
  method: "POST" | "PUT",
  xml: string,
  opts: EnsClientOptions,
): Promise<{ status: number; body?: string; error?: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method,
      headers: {
        ...ensBaseHeaders(opts.accessToken),
        "Content-Type": ENS_CONTENT_TYPE,
        ...ensSimulationHeaders(opts.environment, opts.simulation),
      },
      body: xml,
      signal: controller.signal,
    });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    // A timeout here is genuinely ambiguous: HMRC may still have stored the
    // declaration. The caller must treat this as "unknown", never as "failed".
    return { status: 0, error: err instanceof Error ? err.message : "Request failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submit a new ENS (IE315).
 *
 * Runs the local business rules first. A submission that fails HMRC validation
 * produces no outcome at all, so catching it here saves a round trip and, more
 * importantly, avoids creating a correlation ID with nothing behind it.
 */
export async function submitEns(
  declaration: EnsDeclaration,
  opts: EnsClientOptions,
): Promise<EnsSubmitResult> {
  const localViolations = validateEnsBusinessRules(declaration, {
    messageSender: opts.messageSender,
  });
  if (localViolations.length > 0) {
    return { httpStatus: 0, requestXml: "", localViolations };
  }

  const requestXml = buildCC315A(declaration, buildOptions(opts));
  const url = `${ensBaseUrl(opts.environment)}${ENS_PATHS.submit}`;
  const { status, body, error } = await post(url, "POST", requestXml, opts);

  if (error) return { httpStatus: 0, requestXml, transportError: error };

  return {
    httpStatus: status,
    requestXml,
    responseXml: body,
    response: parseSubmissionResponse(body ?? ""),
  };
}

/**
 * Submit an amendment (IE313) against an accepted MRN.
 *
 * The builder cross-checks `DocNumHEA5` against the path MRN, which HMRC would
 * otherwise only reveal after a round trip.
 */
export async function amendEns(
  declaration: EnsDeclaration,
  mrn: string,
  opts: EnsClientOptions,
): Promise<EnsSubmitResult> {
  const localViolations = validateEnsBusinessRules(declaration, {
    messageSender: opts.messageSender,
  });
  if (localViolations.length > 0) {
    return { httpStatus: 0, requestXml: "", localViolations };
  }

  const requestXml = buildCC313A(declaration, { ...buildOptions(opts), mrn });
  const url = `${ensBaseUrl(opts.environment)}${ENS_PATHS.amend(mrn)}`;
  const { status, body, error } = await post(url, "PUT", requestXml, opts);

  if (error) return { httpStatus: 0, requestXml, transportError: error };

  return {
    httpStatus: status,
    requestXml,
    responseXml: body,
    response: parseSubmissionResponse(body ?? ""),
  };
}

/**
 * The correlation ID from a successful submission, or null.
 *
 * Convenience so callers do not have to narrow the union at every call site and
 * accidentally treat a 200-with-errors as accepted.
 */
export function correlationIdOf(result: EnsSubmitResult): string | null {
  return result.response?.kind === "success" ? result.response.correlationId : null;
}
