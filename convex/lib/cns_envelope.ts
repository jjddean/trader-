/**
 * CNS notification envelope parsing.
 *
 * Notification APIs v1.0.3 §9. The batch wrapper is XML or JSON depending on the
 * Accept header, but each notification BODY is base64 and its own format is
 * declared by that notification's Content-Type header — not by the wrapper. A
 * JSON batch can carry XML bodies. Callers must read the per-notification
 * Content-Type, never assume from the Accept type.
 *
 * Lives in convex/lib because the poller runs as a Convex action; Convex cannot
 * import from src/. Kept pure (no fetch, no env) so it is directly testable.
 */

export type CnsNotificationType = "API" | "DMS" | "CILE" | "HEARTBEAT" | "UNKNOWN";

export interface CnsNotificationHeaders {
  [name: string]: string;
}

export interface CnsNotificationEnvelope {
  /** Unique delivery/dedupe key for the topic message. */
  id: string;
  partition?: number;
  queuedDateTime?: string;
  headers: CnsNotificationHeaders;
  /** Raw base64 body exactly as delivered — retained for replay and audit. */
  bodyBase64: string;
}

export interface CnsNotificationBatch {
  topic: string;
  count: number;
  notifications: CnsNotificationEnvelope[];
}

/** Case-insensitive header lookup — CSPs vary the casing. */
export function header(
  headers: CnsNotificationHeaders,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function attr(fragment: string, name: string): string {
  // Attribute values may use straight or typographic quotes — the published
  // samples use both.
  const match = fragment.match(
    new RegExp(`${name}\\s*=\\s*["'\u201c\u201d\u2018\u2019]([^"'\u201c\u201d\u2018\u2019]*)["'\u201c\u201d\u2018\u2019]`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

function parseHeaderList(fragment: string): CnsNotificationHeaders {
  const headers: CnsNotificationHeaders = {};
  const headerRegex = /<header\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(fragment)) !== null) {
    const name = attr(match[1], "name");
    if (name) headers[name] = attr(match[1], "value");
  }
  return headers;
}

function parseXmlBatch(payload: string): CnsNotificationBatch {
  const root = payload.match(/<notifications\b([^>]*)>/i)?.[1] ?? "";
  const topic = attr(root, "topic");
  const declaredCount = Number(attr(root, "count"));

  const notifications: CnsNotificationEnvelope[] = [];
  const notificationRegex = /<notification\b([^>]*)>([\s\S]*?)<\/notification>/gi;
  let match: RegExpExecArray | null;
  while ((match = notificationRegex.exec(payload)) !== null) {
    const [, attrs, inner] = match;
    const partitionRaw = attr(attrs, "partition");
    const partition = Number(partitionRaw);
    notifications.push({
      id: attr(attrs, "id"),
      ...(partitionRaw && Number.isFinite(partition) ? { partition } : {}),
      queuedDateTime:
        inner.match(/<queuedDateTime>([\s\S]*?)<\/queuedDateTime>/i)?.[1]?.trim() || undefined,
      headers: parseHeaderList(
        inner.match(/<headers>([\s\S]*?)<\/headers>/i)?.[1] ?? "",
      ),
      bodyBase64: (inner.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "").trim(),
    });
  }

  return {
    topic,
    count: Number.isFinite(declaredCount) ? declaredCount : notifications.length,
    notifications,
  };
}

function parseJsonBatch(payload: string): CnsNotificationBatch {
  const parsed = JSON.parse(payload) as {
    topic?: string;
    count?: number;
    notifications?: Array<{
      id?: string;
      partition?: number;
      queuedDateTime?: string;
      headers?: Array<{ name?: string; value?: string }>;
      body?: string;
    }>;
  };

  const notifications = (parsed.notifications ?? []).map((item) => {
    const headers: CnsNotificationHeaders = {};
    for (const h of item.headers ?? []) {
      // The published JSON sample contains keys like "X-CSP-ID:" with a stray
      // trailing colon. Strip it rather than creating a distinct header name.
      const name = String(h?.name ?? "").replace(/:+$/, "").trim();
      if (name) headers[name] = String(h?.value ?? "");
    }
    return {
      id: String(item.id ?? ""),
      ...(typeof item.partition === "number" ? { partition: item.partition } : {}),
      queuedDateTime: item.queuedDateTime,
      headers,
      bodyBase64: String(item.body ?? "").trim(),
    };
  });

  return {
    topic: String(parsed.topic ?? ""),
    count: typeof parsed.count === "number" ? parsed.count : notifications.length,
    notifications,
  };
}

/** Parse a Get Notification Batch response body (XML or JSON wrapper). */
export function parseCnsBatch(payload: string): CnsNotificationBatch {
  const trimmed = String(payload ?? "").trim();
  if (!trimmed) return { topic: "", count: 0, notifications: [] };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonBatch(trimmed);
  }
  return parseXmlBatch(trimmed);
}

/**
 * Decode a notification body. Returns the decoded text plus the byte length, so
 * a parser failure can be diagnosed without re-decoding.
 *
 * Uses atob + TextDecoder rather than Buffer: this module runs inside the Convex
 * poller, and Convex's default runtime has no Node globals. atob alone is not
 * enough — it yields a binary string, so any multi-byte UTF-8 in a DMS body
 * (trader names, addresses) would be mangled without the explicit decode.
 *
 * Throws on malformed base64. That is deliberate: the raw body is persisted
 * before decoding, so the failure is recorded as a parserError against a row
 * that can be replayed once the cause is understood.
 */
export function decodeCnsBody(bodyBase64: string): { text: string; byteLength: number } {
  const raw = String(bodyBase64 ?? "").trim();
  if (!raw) return { text: "", byteLength: 0 };

  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { text: new TextDecoder("utf-8").decode(bytes), byteLength: bytes.byteLength };
}

/** Diagnostic hash. NOT the dedupe key — that is topic + notification id. */
export function hashCnsBody(bodyBase64: string): string {
  // FNV-1a. Sufficient for spotting redelivery of altered content in support
  // conversations; nothing security-relevant depends on it.
  let hash = 0x811c9dc5;
  const value = String(bodyBase64 ?? "");
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Classify a notification for routing (spec §8.7).
 *
 * Heartbeat has no X-Notification-Type; it is identified by the Test header the
 * heartbeat endpoint sets, or by its documented body shape.
 */
export function classifyCnsNotification(
  envelope: CnsNotificationEnvelope,
  decodedBody?: string,
): CnsNotificationType {
  if (header(envelope.headers, "Test")) return "HEARTBEAT";
  if (decodedBody && /<heartbeat\b/i.test(decodedBody)) return "HEARTBEAT";
  if (decodedBody && /"type"\s*:\s*"heartbeat"/i.test(decodedBody)) return "HEARTBEAT";

  const type = (header(envelope.headers, "X-Notification-Type") ?? "").toUpperCase();
  if (type === "API" || type === "DMS" || type === "CILE") return type;
  return "UNKNOWN";
}

/** Acknowledgement body for a batch (Notification APIs v1.0.3 §10). */
export function buildAcknowledgementXml(notificationIds: string[]): string {
  const ids = notificationIds
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
    .map((id) => `  <id>${id}</id>`)
    .join("\n");
  return `<notifications>\n${ids}\n</notifications>`;
}
