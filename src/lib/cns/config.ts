/**
 * CNS (Community Network Services) transport configuration.
 *
 * Server-side only. No value here may be exposed through a browser bundle or a
 * client-side log — the Basic auth password is a live CSP credential.
 * See docs/cns/IMPLEMENTATION-PLAN.md and the governing spec §4.
 *
 * Environment separation is deliberate: EUAT and production credentials are
 * distinct secrets and production values are never inferred from EUAT ones.
 */

export type CnsEnvironment = "euat" | "production";
export type CnsNotificationMode = "pull" | "push";

/** CSP CDS Interface Specification — Customs Declaration API v1.0.3 §13, API Access. */
const EUAT_BASE_URL = "https://www.euat.cnsonline.co.uk/api";
const PRODUCTION_BASE_URL = "https://www.cnsonline.co.uk/api";

/**
 * Declaration media type. CNS confirmed EUAT/TDR uses the same value as
 * production: application/vnd.hmrc.1.0+xml. This is NOT the same axis as the
 * direct-HMRC Accept in hmrc-config.ts — do not couple them.
 */
const DEFAULT_DECLARATION_ACCEPT = "application/vnd.hmrc.1.0+xml";

/** Notification media type — identical across all CNS environments. */
const DEFAULT_NOTIFICATION_ACCEPT = "application/vnd.csp.1.0+xml";

/**
 * Notification APIs v1.0.3, Implementation Restrictions: polling must not exceed
 * once per 30s after a 204. This is a floor, not a default to tune below.
 */
export const MIN_POLL_INTERVAL_SECONDS = 30;

/** Get Notification Batch `max` bounds (Notification APIs v1.0.3 §9). */
export const MIN_BATCH_MAX = 1;
export const MAX_BATCH_MAX = 100;

export interface CnsConfig {
  enabled: boolean;
  environment: CnsEnvironment;
  baseUrl: string;
  username: string;
  password: string;
  badgeId: string;
  topic: string;
  gatewayEpu: string;
  goodsLocationCode: string;
  /** Optional X-Submitter-Identifier. Omit the header entirely when unset. */
  submitterEori: string;
  declarationAccept: string;
  notificationAccept: string;
  userAgent: {
    vendor: string;
    application: string;
    version: string;
    clientId: string;
  };
  notificationMode: CnsNotificationMode;
  batchMax: number;
  pollIntervalSeconds: number;
  pollLeaseSeconds: number;
  requestTimeoutMs: number;
  unknownOutcomeObservationSeconds: number;
  maxConsecutivePollFailuresBeforeAlert: number;
  compassUrl: string;
}

const str = (value: string | undefined, fallback = ""): string =>
  (value ?? "").trim() || fallback;

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function defaultBaseUrl(environment: CnsEnvironment): string {
  return environment === "production" ? PRODUCTION_BASE_URL : EUAT_BASE_URL;
}

function resolveEnvironment(): CnsEnvironment {
  return str(process.env.CNS_ENVIRONMENT).toLowerCase() === "production"
    ? "production"
    : "euat";
}

/**
 * Read CNS configuration from the environment. Performs no validation — call
 * `validateCnsConfig` (or `requireCnsConfig`) before using the result to make a
 * network call.
 */
export function readCnsConfig(): CnsConfig {
  const environment = resolveEnvironment();

  return {
    // Disabled unless explicitly turned on. Local development stays off unless
    // sandbox credentials are deliberately present (spec §4.2).
    enabled: str(process.env.CNS_ENABLED).toLowerCase() === "true",
    environment,
    baseUrl: str(process.env.CNS_BASE_URL, defaultBaseUrl(environment)).replace(/\/+$/, ""),
    username: str(process.env.CNS_API_USERNAME),
    password: str(process.env.CNS_API_PASSWORD),
    badgeId: str(process.env.CNS_BADGE_ID),
    topic: str(process.env.CNS_TOPIC),
    gatewayEpu: str(process.env.CNS_GATEWAY_EPU),
    goodsLocationCode: str(process.env.CNS_GOODS_LOCATION_CODE).toUpperCase(),
    submitterEori: str(process.env.CNS_SUBMITTER_EORI).toUpperCase(),
    declarationAccept: str(process.env.CNS_DECLARATION_ACCEPT, DEFAULT_DECLARATION_ACCEPT),
    notificationAccept: str(process.env.CNS_NOTIFICATION_ACCEPT, DEFAULT_NOTIFICATION_ACCEPT),
    userAgent: {
      vendor: str(process.env.CNS_USER_AGENT_VENDOR, "Freightcode"),
      application: str(process.env.CNS_USER_AGENT_APPLICATION, "Freightcode"),
      version: str(process.env.CNS_USER_AGENT_VERSION, "1.0.0"),
      // The client company name. Defaults to Freightcode for EUAT because
      // FreightCode is both badge holder and declarant; production should carry
      // the legal name agreed with CNS (spec §6.2).
      clientId: str(process.env.CNS_USER_AGENT_CLIENT_ID, "Freightcode"),
    },
    notificationMode:
      str(process.env.CNS_NOTIFICATION_MODE).toLowerCase() === "push" ? "push" : "pull",
    batchMax: num(process.env.CNS_NOTIFICATION_BATCH_MAX, 20),
    pollIntervalSeconds: num(process.env.CNS_POLL_INTERVAL_SECONDS, MIN_POLL_INTERVAL_SECONDS),
    pollLeaseSeconds: num(process.env.CNS_POLL_LEASE_SECONDS, 90),
    requestTimeoutMs: num(process.env.CNS_REQUEST_TIMEOUT_MS, 30000),
    unknownOutcomeObservationSeconds: num(process.env.CNS_UNKNOWN_OUTCOME_OBSERVATION_SECONDS, 300),
    maxConsecutivePollFailuresBeforeAlert: num(
      process.env.CNS_MAX_CONSECUTIVE_POLL_FAILURES_BEFORE_ALERT,
      3,
    ),
    compassUrl: str(process.env.CNS_COMPASS_URL).replace(/\/+$/, ""),
  };
}

/**
 * Startup validation per spec §4.3. Returns one message per defect; an empty
 * array means the configuration is safe to use.
 *
 * Messages must never interpolate the password or an Authorization value.
 */
export function validateCnsConfig(config: CnsConfig): string[] {
  const errors: string[] = [];

  // A disabled integration needs no further checks — that is the whole point of
  // the flag. It must still never claim to be usable.
  if (!config.enabled) return errors;

  const required: Array<[keyof CnsConfig, string, string]> = [
    ["baseUrl", "CNS_BASE_URL", "API base URL"],
    ["username", "CNS_API_USERNAME", "CCMI username"],
    ["password", "CNS_API_PASSWORD", "API password"],
    ["badgeId", "CNS_BADGE_ID", "declaration badge"],
    ["topic", "CNS_TOPIC", "notification topic"],
  ];
  for (const [key, envVar, label] of required) {
    if (!config[key]) {
      errors.push(`CNS_ENABLED is true but ${envVar} is not set (${label}).`);
    }
  }

  if (config.baseUrl && !config.baseUrl.startsWith("https://")) {
    // Declaration API v1.0.3: plain HTTP against the gateway is rejected with 403.
    errors.push("CNS_BASE_URL must be an https:// URL.");
  }

  if (config.declarationAccept !== DEFAULT_DECLARATION_ACCEPT) {
    errors.push(
      `CNS_DECLARATION_ACCEPT must be exactly ${DEFAULT_DECLARATION_ACCEPT} for the ${config.environment} environment.`,
    );
  }

  if (config.notificationAccept !== DEFAULT_NOTIFICATION_ACCEPT) {
    errors.push(
      `CNS_NOTIFICATION_ACCEPT must be exactly ${DEFAULT_NOTIFICATION_ACCEPT} (identical across all CNS environments).`,
    );
  }

  if (config.pollIntervalSeconds < MIN_POLL_INTERVAL_SECONDS) {
    errors.push(
      `CNS_POLL_INTERVAL_SECONDS must be at least ${MIN_POLL_INTERVAL_SECONDS} (Notification APIs v1.0.3 implementation restriction).`,
    );
  }

  if (config.batchMax < MIN_BATCH_MAX || config.batchMax > MAX_BATCH_MAX) {
    errors.push(
      `CNS_NOTIFICATION_BATCH_MAX must be between ${MIN_BATCH_MAX} and ${MAX_BATCH_MAX}.`,
    );
  }

  if (config.pollLeaseSeconds <= config.pollIntervalSeconds) {
    // A lease shorter than the poll cadence lets a second poller claim the topic
    // mid-cycle, which duplicates unacknowledged batches.
    errors.push("CNS_POLL_LEASE_SECONDS must be greater than CNS_POLL_INTERVAL_SECONDS.");
  }

  // Production host is only ever legitimate on a production deployment. This is
  // the CNS-side mirror of the declaration environment lock already applied to
  // the direct HMRC path.
  const isProductionDeployment =
    process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
  if (config.baseUrl.startsWith(PRODUCTION_BASE_URL) && !isProductionDeployment) {
    errors.push(
      "CNS production base URL is configured on a non-production deployment. Use the EUAT URL.",
    );
  }
  if (config.environment === "production" && !isProductionDeployment) {
    errors.push("CNS_ENVIRONMENT=production is not permitted on a non-production deployment.");
  }

  return errors;
}

/** True when CNS is switched on and every required value validates. */
export function isCnsUsable(config: CnsConfig = readCnsConfig()): boolean {
  return config.enabled && validateCnsConfig(config).length === 0;
}

/**
 * Read + validate, throwing on any defect. Use at the entry point of every CNS
 * action so a misconfiguration fails loudly rather than producing a 401/403
 * round-trip against the CSP.
 */
export function requireCnsConfig(): CnsConfig {
  const config = readCnsConfig();
  if (!config.enabled) {
    throw new Error("CNS integration is disabled (CNS_ENABLED is not 'true').");
  }
  const errors = validateCnsConfig(config);
  if (errors.length > 0) {
    throw new Error(`CNS configuration invalid:\n- ${errors.join("\n- ")}`);
  }
  return config;
}

/**
 * User-Agent per Declaration API v1.0.3 §11 and Notification APIs v1.0.3.
 * Format: Vendor=…, Application=…, Version=…, Badge=…, ClientID=…
 */
export function buildCnsUserAgent(config: CnsConfig): string {
  const { vendor, application, version, clientId } = config.userAgent;
  return `Vendor=${vendor}, Application=${application}, Version=${version}, Badge=${config.badgeId}, ClientID=${clientId}`;
}

/**
 * Safe-to-log projection. Never includes the password, and never the
 * Authorization header value.
 */
export function describeCnsConfig(config: CnsConfig): Record<string, string | number | boolean> {
  return {
    enabled: config.enabled,
    environment: config.environment,
    baseUrl: config.baseUrl,
    username: config.username,
    passwordConfigured: Boolean(config.password),
    badgeId: config.badgeId,
    topic: config.topic,
    gatewayEpu: config.gatewayEpu,
    goodsLocationCode: config.goodsLocationCode,
    submitterEoriConfigured: Boolean(config.submitterEori),
    declarationAccept: config.declarationAccept,
    notificationAccept: config.notificationAccept,
    notificationMode: config.notificationMode,
    batchMax: config.batchMax,
    pollIntervalSeconds: config.pollIntervalSeconds,
  };
}
