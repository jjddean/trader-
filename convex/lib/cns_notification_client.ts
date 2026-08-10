/**
 * CNS Notification API client for the Convex runtime.
 *
 * Notification APIs v1.0.3 §§8-13. Pure transport: it performs the HTTP calls
 * and returns raw results. Persistence ordering, leasing and parsing live in
 * convex/cns_notifications.ts, because those are database concerns.
 *
 * X-Badge-ID is deliberately never sent on these endpoints — v1.0.3 marks the
 * badge filter "(Not used by CNS)", and sending it risks a 403 against a topic
 * that routes more than one badge.
 */

import { basicAuthorization, type CnsNotificationConfig } from "./cns_config";

export interface CnsHttpResult {
  status: number;
  ok: boolean;
  body: string;
}

function notificationHeaders(
  config: CnsNotificationConfig,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    Authorization: basicAuthorization(config.username, config.password),
    Accept: config.notificationAccept,
    "User-Agent": config.userAgent,
    ...extra,
  };
}

/** SSRF guard — every notification call must stay on the configured host. */
function notificationUrl(config: CnsNotificationConfig, path: string): string {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:") {
    throw new Error("CNS base URL must use https.");
  }
  const url = new URL(`${base.pathname}${path}`, base.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error("Refusing CNS notification request outside the configured base.");
  }
  return url.toString();
}

async function call(
  config: CnsNotificationConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  init: { body?: string; contentType?: string } = {},
): Promise<CnsHttpResult> {
  const url = notificationUrl(config, path);
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(config.requestTimeoutMs)
      : undefined;

  const response = await fetch(url, {
    method,
    headers: notificationHeaders(
      config,
      init.contentType ? { "Content-Type": init.contentType } : {},
    ),
    ...(init.body !== undefined ? { body: init.body } : {}),
    ...(signal ? { signal } : {}),
  });

  return {
    status: response.status,
    ok: response.ok,
    body: await response.text(),
  };
}

/**
 * Whether a push consumer is configured on the topic.
 *
 * Must be checked before polling starts: with a consumer attached, batch reads
 * return 423 LOCKED_PUSH_MESSAGING_ACTIVE and pull is unavailable entirely.
 */
export async function getTopicConsumer(
  config: CnsNotificationConfig,
): Promise<CnsHttpResult> {
  return call(config, "GET", `/notifications/${encodeURIComponent(config.topic)}/consumer`);
}

/** Connectivity test — raises a notification on the topic. */
export async function sendHeartbeat(config: CnsNotificationConfig): Promise<CnsHttpResult> {
  return call(config, "POST", `/notifications/${encodeURIComponent(config.topic)}/heartbeat`);
}

/**
 * Fetch a batch of unacknowledged notifications.
 * 200 with a body, or 204 when the topic is empty.
 */
export async function getNotificationBatch(
  config: CnsNotificationConfig,
): Promise<CnsHttpResult> {
  return call(
    config,
    "GET",
    `/notifications/${encodeURIComponent(config.topic)}?max=${config.batchMax}`,
  );
}

/**
 * Acknowledge a batch. Only ever called after every notification in it has been
 * durably persisted — CNS may delete an acknowledged message at any time and is
 * not required to redeliver it.
 */
export async function acknowledgeBatch(
  config: CnsNotificationConfig,
  acknowledgementXml: string,
): Promise<CnsHttpResult> {
  return call(config, "DELETE", `/notifications/${encodeURIComponent(config.topic)}`, {
    body: acknowledgementXml,
    contentType: "application/xml; charset=utf-8",
  });
}

/** Machine-readable code from a CNS error body, for logging and alerting. */
export function notificationErrorCode(body: string): string {
  return (
    body.match(/<(?:[^>]*:)?code[^>]*>([\s\S]*?)<\/(?:[^>]*:)?code>/i)?.[1]?.trim() ?? ""
  );
}

/**
 * The configured push endpoint, or "" when none is set.
 *
 * Two shapes exist. Notification APIs v1.0.3 documents the attribute form:
 *   <consumer endpointUrl="https://..." authorization="Basic ABC"></consumer>
 * CNS EUAT actually returns the element form, capitalised, and self-closing when
 * unset:
 *   <Consumer><endpointUrl/><authorization/></Consumer>
 *
 * Both are handled. Getting this wrong is not cosmetic: a missed push consumer
 * means the poller starts, every batch read returns 423, and the topic looks
 * silently broken.
 */
export function parseConsumerEndpoint(body: string): string {
  const attribute = body.match(
    /endpointUrl\s*=\s*["']([^"']*)["']/i,
  )?.[1];
  if (attribute !== undefined) return attribute.trim();

  const element = body.match(
    /<(?:[^>]*:)?endpointUrl[^>]*>([\s\S]*?)<\/(?:[^>]*:)?endpointUrl>/i,
  )?.[1];
  if (element !== undefined) return element.trim();

  // <endpointUrl/> — present but empty means no consumer configured.
  return "";
}
