/**
 * CNS configuration for the Convex runtime.
 *
 * A deliberate, minimal duplicate of the values in src/lib/cns/config.ts.
 * Convex cannot import from src/, and the notification poller must run as a
 * scheduled Convex action because Vercel kills in-process timers. Only the
 * values the notification side needs are mirrored — the validation logic and the
 * declaration-transport settings are not duplicated.
 *
 * Written for Convex's default runtime: no Node globals.
 */

export interface CnsNotificationConfig {
  enabled: boolean;
  baseUrl: string;
  username: string;
  password: string;
  topic: string;
  notificationAccept: string;
  userAgent: string;
  batchMax: number;
  pollIntervalSeconds: number;
  pollLeaseSeconds: number;
  requestTimeoutMs: number;
  mode: "pull" | "push";
  maxConsecutiveFailuresBeforeAlert: number;
}

const str = (value: string | undefined, fallback = ""): string =>
  (value ?? "").trim() || fallback;

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Notification APIs v1.0.3 — no more than one poll per 30s after a 204. */
export const MIN_POLL_INTERVAL_SECONDS = 30;

export function readCnsNotificationConfig(): CnsNotificationConfig {
  const badge = str(process.env.CNS_BADGE_ID);
  const vendor = str(process.env.CNS_USER_AGENT_VENDOR, "Freightcode");
  const application = str(process.env.CNS_USER_AGENT_APPLICATION, "Freightcode");
  const version = str(process.env.CNS_USER_AGENT_VERSION, "1.0.0");
  const clientId = str(process.env.CNS_USER_AGENT_CLIENT_ID, "Freightcode");

  const pollIntervalSeconds = Math.max(
    MIN_POLL_INTERVAL_SECONDS,
    num(process.env.CNS_POLL_INTERVAL_SECONDS, MIN_POLL_INTERVAL_SECONDS),
  );

  return {
    enabled: str(process.env.CNS_ENABLED).toLowerCase() === "true",
    baseUrl: str(process.env.CNS_BASE_URL).replace(/\/+$/, ""),
    username: str(process.env.CNS_API_USERNAME),
    password: str(process.env.CNS_API_PASSWORD),
    topic: str(process.env.CNS_TOPIC),
    notificationAccept: str(
      process.env.CNS_NOTIFICATION_ACCEPT,
      "application/vnd.csp.1.0+xml",
    ),
    userAgent: `Vendor=${vendor}, Application=${application}, Version=${version}, Badge=${badge}, ClientID=${clientId}`,
    // Get Notification Batch max is 1..100.
    batchMax: Math.min(100, Math.max(1, num(process.env.CNS_NOTIFICATION_BATCH_MAX, 20))),
    pollIntervalSeconds,
    pollLeaseSeconds: num(process.env.CNS_POLL_LEASE_SECONDS, 90),
    requestTimeoutMs: num(process.env.CNS_REQUEST_TIMEOUT_MS, 30000),
    mode: str(process.env.CNS_NOTIFICATION_MODE).toLowerCase() === "push" ? "push" : "pull",
    maxConsecutiveFailuresBeforeAlert: num(
      process.env.CNS_MAX_CONSECUTIVE_POLL_FAILURES_BEFORE_ALERT,
      3,
    ),
  };
}

/** Returns one message per defect; empty means usable. Never echoes the password. */
export function validateCnsNotificationConfig(config: CnsNotificationConfig): string[] {
  if (!config.enabled) return [];
  const errors: string[] = [];
  if (!config.baseUrl) errors.push("CNS_BASE_URL is not set.");
  if (config.baseUrl && !config.baseUrl.startsWith("https://")) {
    errors.push("CNS_BASE_URL must be https.");
  }
  if (!config.username) errors.push("CNS_API_USERNAME is not set.");
  if (!config.password) errors.push("CNS_API_PASSWORD is not set.");
  if (!config.topic) errors.push("CNS_TOPIC is not set.");
  return errors;
}

/**
 * HTTP Basic value. btoa alone throws on any non-Latin1 character, so the
 * credential is UTF-8 encoded to a binary string first — a CSP password is not
 * guaranteed to be ASCII.
 */
export function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}
