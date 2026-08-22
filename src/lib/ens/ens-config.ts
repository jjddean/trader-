/**
 * ENS (Safety & Security GB) endpoint and header configuration.
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md` §2
 * API mirrors: `docs/hmrc/ens/api/`
 *
 * Kept separate from `hmrc-config.ts`, which is CDS-shaped: that module
 * switches Accept headers by TDR/Trade Test/Live phase, whereas the S&S APIs
 * publish a single Accept value with an enum of exactly one. Folding ENS into
 * the phase logic would imply a version negotiation that does not exist.
 *
 * Hosts are shared with CDS — same HMRC platform, same sandbox and production
 * base URLs — so those are read from `HMRC_CONFIG` rather than duplicated.
 */

import { HMRC_CONFIG } from "../hmrc-config";

/**
 * The only scope for all three S&S APIs, including the read-only Outcomes and
 * Notifications endpoints. Named `write:` by HMRC despite covering reads.
 */
export const ENS_SCOPE = "write:import-control-system";

/** OAS declares this as an enum of one value. There is no alternative. */
export const ENS_ACCEPT_HEADER = "application/vnd.hmrc.1.0+xml";

/** Submission bodies are XML. */
export const ENS_CONTENT_TYPE = "application/xml; charset=UTF-8";

export type EnsEnvironment = "sandbox" | "production";

/** Base URL for the given environment. Shared with the CDS transport. */
export function ensBaseUrl(environment: EnsEnvironment): string {
  return environment === "production" ? HMRC_CONFIG.productionBaseUrl : HMRC_CONFIG.sandboxBaseUrl;
}

/**
 * Endpoint paths, from the three OpenAPI specifications.
 *
 * Note the trailing slash on the collection paths: HMRC declares
 * `/customs/imports/declarations/` and `/customs/imports/outcomes/` with one,
 * while the service guide prose omits it. The OAS is the normative source, so
 * the slash is kept.
 */
export const ENS_PATHS = {
  /** POST — submit a new ENS (IE315). */
  submit: "/customs/imports/declarations/",
  /** PUT — submit an amendment (IE313) against an existing MRN. */
  amend: (mrn: string) => `/customs/imports/declarations/${encodeURIComponent(mrn)}`,
  /** GET — list unacknowledged outcomes. */
  listOutcomes: "/customs/imports/outcomes/",
  /** GET one, DELETE to acknowledge. */
  outcome: (correlationId: string) => `/customs/imports/outcomes/${encodeURIComponent(correlationId)}`,
  /** GET — list unacknowledged advanced notifications. */
  listNotifications: "/customs/imports/notifications/",
  /** GET one, DELETE to acknowledge. */
  notification: (notificationId: string) =>
    `/customs/imports/notifications/${encodeURIComponent(notificationId)}`,
} as const;

/**
 * Sandbox simulation headers.
 *
 * Documented on the rendered Developer Hub page only — they are absent from the
 * OpenAPI file, so anyone generating a client from the OAS will not find them.
 * See `docs/hmrc/ens/testing/sandbox.md`.
 *
 * Without `simulateRiskingResponse`, **no outcome is ever produced** in sandbox.
 * A poller waiting on one will wait forever and look broken.
 */
export interface EnsSandboxSimulation {
  /** `accept` produces a positive outcome with an MRN; `reject` a negative one. */
  riskingResponse?: "accept" | "reject";
  /** Which rejection to simulate. Defaults to `badTransportMode` when omitted. */
  riskingResponseError?: "nonUniqueLRN" | "badTransportMode" | "badMessageCode";
  /** Delay before the outcome appears. Values above 30000 are treated as 30s. */
  riskingResponseLatencyMillis?: number;
  /** When true, an advanced notification is produced. */
  interventionResponse?: boolean;
  /** Delay before the notification appears. Same 30s cap. */
  interventionResponseLatencyMillis?: number;
}

const LATENCY_CAP_MS = 30_000;

/**
 * Build the sandbox simulation headers.
 *
 * Returns `{}` for production: sending simulation headers at a live endpoint is
 * meaningless at best, so the environment gate is here rather than at each
 * call site.
 */
export function ensSimulationHeaders(
  environment: EnsEnvironment,
  simulation?: EnsSandboxSimulation,
): Record<string, string> {
  if (environment !== "sandbox" || !simulation) return {};
  const headers: Record<string, string> = {};

  if (simulation.riskingResponse) {
    headers.simulateRiskingResponse = simulation.riskingResponse;
  }
  if (simulation.riskingResponseError) {
    headers.riskingResponseError = simulation.riskingResponseError;
  }
  if (typeof simulation.riskingResponseLatencyMillis === "number") {
    headers.simulateRiskingResponseLatencyMillis = String(
      Math.max(0, Math.min(simulation.riskingResponseLatencyMillis, LATENCY_CAP_MS)),
    );
  }
  if (typeof simulation.interventionResponse === "boolean") {
    headers.simulateInterventionResponse = String(simulation.interventionResponse);
  }
  if (typeof simulation.interventionResponseLatencyMillis === "number") {
    headers.simulateInterventionResponseLatencyMillis = String(
      Math.max(0, Math.min(simulation.interventionResponseLatencyMillis, LATENCY_CAP_MS)),
    );
  }
  return headers;
}

/** Headers common to every ENS request. */
export function ensBaseHeaders(accessToken: string): Record<string, string> {
  return {
    Accept: ENS_ACCEPT_HEADER,
    Authorization: `Bearer ${accessToken}`,
  };
}
