/**
 * Authenticated CNS HTTP client.
 *
 * Deliberately NOT an extension of fetchHmrc(): the direct HMRC path uses OAuth
 * Bearer tokens plus the Gov-* fraud-prevention header set, while CNS uses HTTP
 * Basic against the CSP gateway with X-Badge-ID. Merging the two would put an
 * OAuth token and a Basic credential in the same code path.
 *
 * The Authorization value is constructed here and nowhere else, and is never
 * logged, returned, or persisted.
 */

import { buildCnsUserAgent, type CnsConfig } from "./config";

export type CnsApiKind = "declaration" | "notification";

export interface CnsRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Path relative to the configured base URL, e.g. "/cds/customs/declarations/". */
  path: string;
  kind: CnsApiKind;
  body?: string;
  /** Content-Type for the request body. Required whenever `body` is set. */
  contentType?: string;
  /**
   * Gov-* fraud-prevention headers forwarded unaltered from the originating
   * browser request. CNS appends its own IPs to the Forwarded header before
   * passing them to HMRC (Declaration API v1.0.3 §10). Never manufacture these.
   */
  forwardedGovHeaders?: Record<string, string>;
  signal?: AbortSignal;
}

export interface CnsResponse {
  status: number;
  ok: boolean;
  body: string;
  headers: Headers;
}

/**
 * Only these headers are ever forwarded from the browser. An allowlist prefix
 * check rather than a passthrough, so a caller cannot smuggle Authorization or
 * cookies into the CSP request.
 */
const GOV_HEADER_PREFIX = "gov-";

function sanitizeGovHeaders(input: Record<string, string> | undefined): Record<string, string> {
  if (!input) return {};
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    if (!name.toLowerCase().startsWith(GOV_HEADER_PREFIX)) continue;
    if (!value) continue;
    out[name] = value;
  }
  return out;
}

/**
 * SSRF guard. Every outbound URL must resolve to the configured CNS host over
 * https. Prevents a mis-set env var or an injected path from redirecting a
 * request that carries live CSP credentials.
 */
export function resolveCnsUrl(config: CnsConfig, path: string): string {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:") {
    throw new Error("CNS base URL must use https.");
  }

  const url = new URL(path.startsWith("/") ? `${base.pathname}${path}` : path, base.origin);

  if (url.origin !== base.origin) {
    throw new Error(`Refusing CNS request to unexpected origin ${url.origin}.`);
  }
  if (!url.pathname.startsWith(base.pathname)) {
    throw new Error(`Refusing CNS request outside base path ${base.pathname}.`);
  }
  return url.toString();
}

/** HTTP Basic credential. Constructed at call time; never stored or logged. */
function basicAuthorization(config: CnsConfig): string {
  const encoded = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}

function buildHeaders(config: CnsConfig, options: CnsRequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: basicAuthorization(config),
    Accept: options.kind === "declaration" ? config.declarationAccept : config.notificationAccept,
    "User-Agent": buildCnsUserAgent(config),
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = options.contentType || "application/xml; charset=utf-8";
  }

  if (options.kind === "declaration") {
    // Declaration API v1.0.3: X-Badge-ID is required and tells the CSP which
    // badge to submit under.
    headers["X-Badge-ID"] = config.badgeId;

    // Optional in v1.0.3. Omit the header entirely rather than sending an empty
    // value, which some gateways treat as a malformed EORI.
    if (config.submitterEori) {
      headers["X-Submitter-Identifier"] = config.submitterEori;
    }

    Object.assign(headers, sanitizeGovHeaders(options.forwardedGovHeaders));
  }
  // Notification endpoints deliberately omit X-Badge-ID: Notification APIs
  // v1.0.3 §9 marks the badge filter "(Not used by CNS)". Sending it risks a
  // 403 INVALID_BADGE_ID against a topic that routes multiple badges.

  return headers;
}

/**
 * Perform an authenticated CNS request.
 *
 * Returns the response rather than throwing on non-2xx — callers classify via
 * normalizeCnsError so that a 202, a 400 and a 504 each take their documented
 * path (spec §6.3, §6.4).
 */
export async function fetchCns(
  config: CnsConfig,
  options: CnsRequestOptions,
): Promise<CnsResponse> {
  const url = resolveCnsUrl(config, options.path);
  const headers = buildHeaders(config, options);

  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(config.requestTimeoutMs)
      : undefined;
  const signal =
    options.signal && timeoutSignal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : options.signal ?? timeoutSignal;

  // Authorization is intentionally absent from this log line.
  console.log(`[CNS] ${options.method} ${url} (accept=${headers.Accept})`);

  const response = await fetch(url, {
    method: options.method,
    headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(signal ? { signal } : {}),
  });

  const body = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    body,
    headers: response.headers,
  };
}

/**
 * X-CSP-ID from a declaration response. Correlates the initial request with an
 * inventory pre-check failure notification. Per Declaration API v1.0.3 this is
 * explicitly "not to be used for declaration tracking purposes" — store it, but
 * the LRN remains the permanent key.
 */
export function readCspId(headers: Headers): string | null {
  return headers.get("X-CSP-ID") || headers.get("x-csp-id");
}
