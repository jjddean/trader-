import { presentationForDmsType, resolveHmrcDmsType } from "../../convex/lib/hmrc_notification_catalogue";

export function normalizeNotificationType(raw: string | undefined | null): string {
  return resolveHmrcDmsType({ storedNotificationType: raw });
}

export interface NotificationDisplay {
  title: string;
  subtitle?: string;
  tone: "success" | "danger" | "warning" | "info";
}

export function getNotificationDisplay(raw: string | undefined | null): NotificationDisplay {
  const type = resolveHmrcDmsType({ storedNotificationType: raw });
  const p = presentationForDmsType(type);
  return {
    title: p.timelineTitle,
    subtitle: p.detail,
    tone: p.tone === "neutral" ? "info" : p.tone,
  };
}
