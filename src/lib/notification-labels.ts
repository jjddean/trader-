/**
 * Display + status normalization for HMRC notification types stored on notifications rows.
 * Legacy rows may have numeric NameCodes (4, 67) from older parser versions.
 */

const NUMERIC_NAME_TO_DMS: Record<string, string> = {
  "4": "DMSTAX",
  "67": "DMSTAX",
};

const FUNC_PREFIX_TO_DMS: Record<string, string> = {
  FUNC_01: "DMSACC",
  FUNC_09: "DMSACC",
  FUNC_11: "DMSCLE",
  FUNC_13: "DMSTAX",
};

export function normalizeNotificationType(raw: string | undefined | null): string {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t) return "UNKNOWN";
  if (t.startsWith("DMS") || t === "DMSSUB" || t === "DMSUB") return t;
  if (NUMERIC_NAME_TO_DMS[t]) return NUMERIC_NAME_TO_DMS[t];
  if (FUNC_PREFIX_TO_DMS[t]) return FUNC_PREFIX_TO_DMS[t];
  return t;
}

export interface NotificationDisplay {
  title: string;
  subtitle?: string;
  tone: "success" | "danger" | "warning" | "info";
}

export function getNotificationDisplay(raw: string | undefined | null): NotificationDisplay {
  const type = normalizeNotificationType(raw);

  switch (type) {
    case "DMSCLE":
      return { title: "Goods cleared (DMSCLE)", tone: "success" };
    case "DMSACC":
      return { title: "Declaration accepted (DMSACC)", tone: "success" };
    case "DMSTAX":
      return {
        title: "Tax assessed (DMSTAX)",
        subtitle: raw === "67" ? "Indicative customs debt" : raw === "4" ? "Payment / final debt" : undefined,
        tone: "info",
      };
    case "DMSROG":
      return { title: "Registered (DMSROG)", tone: "warning" };
    case "DMSREJ":
      return { title: "Declaration rejected (DMSREJ)", tone: "danger" };
    case "DMSINV":
      return { title: "Declaration invalid (DMSINV)", tone: "danger" };
    case "DMSCTL":
      return { title: "Under control (DMSCTL)", tone: "warning" };
    case "DMSRCV":
      return { title: "Received by CDS (DMSRCV)", tone: "info" };
    default:
      return { title: `HMRC update (${raw || type})`, tone: "info" };
  }
}
