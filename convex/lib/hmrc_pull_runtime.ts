import { parseHmrcNotification } from "./hmrc_notification_parser";

export type PullSaveArgs = {
  mrn: string;
  conversationId: string;
  notificationType: string;
  fieldErrors: Array<{ field: string; code?: string; reason: string }>;
  errorCodes: string[];
  rawPayload: string;
  idempotencyKey?: string;
  hmrcNotificationId: string;
  issueDateTime?: string;
  source: string;
  timestamp: string;
};

function hmrcBaseUrl(environment: "sandbox" | "production"): string {
  return environment === "sandbox"
    ? process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk"
    : process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk";
}

function pullAcceptHeader(): string {
  return process.env.HMRC_ACCEPT_V1_XML || "application/vnd.hmrc.1.0+xml";
}

function serverGovHeaders(): Record<string, string> {
  const vendorIp = process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6";
  const product = process.env.HMRC_VENDOR_PRODUCT_NAME || "Freightcode";
  const version = process.env.HMRC_VENDOR_VERSION || "1.0.0";
  const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Vendor-Version": `${product}=${version}`,
    "Gov-Vendor-Product-Name": enc(product),
    "Gov-Client-Public-IP": vendorIp,
    "Gov-Vendor-Public-IP": vendorIp,
    "Gov-Client-Public-IP-Timestamp": new Date().toISOString(),
    "Gov-Client-Public-Port": "443",
    "Gov-Vendor-Forwarded": `by=${enc(vendorIp)}&for=${enc(vendorIp)}`,
  };
}

export function extractNotificationIds(listBody: string): string[] {
  const trimmed = listBody.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { notifications?: unknown[] }).notifications)
          ? (parsed as { notifications: unknown[] }).notifications
          : [];
      const ids: string[] = [];
      for (const item of items) {
        if (item && typeof item === "object" && "notificationId" in item) {
          const id = (item as { notificationId: unknown }).notificationId;
          if (typeof id === "string" && id.length > 0) ids.push(id);
        }
      }
      if (ids.length > 0) return ids;
    } catch {
      // fall through
    }
  }

  const notificationIds: string[] = [];
  const idRegex = /<(?:[^>]*:)?notification[^>]*href="[^"]*\/([^/"]+)"[^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(listBody)) !== null) {
    notificationIds.push(match[1]);
  }

  if (notificationIds.length === 0) {
    const simpleIdRegex =
      /<(?:[^>]*:)?(?:NotificationId|ID)[^>]*>([a-f0-9-]+)<\/(?:[^>]*:)?(?:NotificationId|ID)>/gi;
    while ((match = simpleIdRegex.exec(listBody)) !== null) {
      notificationIds.push(match[1]);
    }
  }

  return notificationIds;
}

function extractNotificationPayload(notifBody: string): string {
  const trimmed = notifBody.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { message?: unknown };
      if (typeof parsed.message === "string") return parsed.message;
    } catch {
      // use raw
    }
  }
  return notifBody;
}

async function hmrcGet(url: string, accessToken: string): Promise<Response> {
  return await fetch(url, {
    method: "GET",
    headers: {
      Accept: pullAcceptHeader(),
      Authorization: `Bearer ${accessToken}`,
      ...serverGovHeaders(),
    },
  });
}

/**
 * HMRC Pull Notifications API (list unpulled + retrieve each).
 * Persists via the supplied saveFn (typically notifications.saveWebhook).
 */
export async function pullHmrcNotificationsServer(
  conversationId: string,
  accessToken: string,
  environment: "sandbox" | "production",
  source: string,
  saveFn: (args: PullSaveArgs) => Promise<unknown>,
): Promise<{ conversationId: string; total: number; saved: number }> {
  const hmrcBase = hmrcBaseUrl(environment);
  const listUrl = `${hmrcBase}/notifications/conversationId/${encodeURIComponent(conversationId)}/unpulled`;
  const listResponse = await hmrcGet(listUrl, accessToken);

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    console.warn(`[HMRC-PULL-SERVER] List unavailable (${listResponse.status}):`, errorText.slice(0, 300));
    return { conversationId, total: 0, saved: 0 };
  }

  const listBody = await listResponse.text();
  const notificationIds = extractNotificationIds(listBody);
  let saved = 0;

  for (const notifId of notificationIds) {
    const notifUrl = `${hmrcBase}/notifications/unpulled/${notifId}`;
    const notifResponse = await hmrcGet(notifUrl, accessToken);
    if (!notifResponse.ok) continue;

    const notifBody = await notifResponse.text();
    const payload = extractNotificationPayload(notifBody);
    const { notificationType, mrn, errorCodes, fieldErrors, issueDateTime } = parseHmrcNotification(payload);

    await saveFn({
      mrn,
      conversationId,
      notificationType,
      fieldErrors,
      errorCodes,
      rawPayload: payload,
      hmrcNotificationId: notifId,
      issueDateTime,
      source,
      timestamp: new Date().toISOString(),
    });
    saved += 1;
  }

  return { conversationId, total: notificationIds.length, saved };
}
