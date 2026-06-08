import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { fetchHmrc } from "./hmrc-fetch";
import { HMRC_CONFIG } from "./hmrc-config";
import { parseHmrcNotification } from "./hmrc-notification-parser";
import { buildHmrcNotificationIdempotencyKey } from "./hmrc-notification-idempotency";

export type PullNotificationsResult = {
  conversationId: string;
  total: number;
  saved: number;
};

function extractNotificationIds(listBody: string): string[] {
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
      // fall through to XML parsing
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
      // use raw body
    }
  }
  return notifBody;
}

/**
 * HMRC Pull Notifications API (two-step list + retrieve).
 * Used after submit (localhost has no push webhooks) and from the pull route.
 */
export async function pullHmrcNotificationsForConversation(params: {
  conversationId: string;
  accessToken: string;
  request: Request;
  convex: ConvexHttpClient;
}): Promise<PullNotificationsResult> {
  const { conversationId, accessToken, request, convex } = params;

  const hmrcBase =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;

  const pullAccept = HMRC_CONFIG.accept.v1Xml;
  const listUrl = `${hmrcBase}/notifications/conversationId/${encodeURIComponent(conversationId)}/unpulled`;
  const listResponse = await fetchHmrc(
    listUrl,
    { method: "GET", headers: { Accept: pullAccept } },
    request,
    accessToken,
  );

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    console.warn("[HMRC-PULL] List unavailable:", listResponse.status, errorText.slice(0, 300));
    // v2 Trade Test conversationIds often 400 on v1 pull — do not crash submit/status polling.
    return { conversationId, total: 0, saved: 0 };
  }

  const listBody = await listResponse.text();
  const notificationIds = extractNotificationIds(listBody);

  let saved = 0;
  for (const notifId of notificationIds) {
    const notifUrl = `${hmrcBase}/notifications/unpulled/${notifId}`;
    const notifResponse = await fetchHmrc(
      notifUrl,
      { method: "GET", headers: { Accept: pullAccept } },
      request,
      accessToken,
    );

    if (!notifResponse.ok) continue;

    const notifBody = await notifResponse.text();
    const payload = extractNotificationPayload(notifBody);
    const { notificationType, mrn, errorCodes, fieldErrors } = parseHmrcNotification(payload);
    const idempotencyKey = buildHmrcNotificationIdempotencyKey(payload);
    console.log(
      `[HMRC-PULL] Parsed: type=${notificationType}, mrn=${mrn}, errorCodes=${errorCodes.join(",") || "none"}`,
    );

    await convex.mutation(api.notifications.saveWebhook, {
      mrn,
      conversationId,
      notificationType,
      fieldErrors,
      errorCodes,
      rawPayload: payload,
      idempotencyKey,
      hmrcNotificationId: notifId,
      source: "pull",
      timestamp: new Date().toISOString(),
    });
    saved += 1;
  }

  return { conversationId, total: notificationIds.length, saved };
}

/** Fire delayed pulls — DMSREJ often arrives seconds after the 202. */
export function schedulePostSubmitNotificationPulls(params: {
  conversationId: string;
  accessToken: string;
  request: Request;
  convex: ConvexHttpClient;
}): void {
  const delaysMs = [0, 4000, 12000, 30000];
  for (const delayMs of delaysMs) {
    setTimeout(() => {
      pullHmrcNotificationsForConversation(params).catch((err) => {
        console.warn(`[HMRC-PULL] Delayed pull (${delayMs}ms) failed:`, err);
      });
    }, delayMs);
  }
}
