export type HmrcConnectionStatus =
  | "loading"
  | "connected"
  | "expiring"
  | "expired"
  | "disconnected";

type HmrcConnection = {
  expiresAt: number;
};

const EXPIRING_WINDOW_MS = 30 * 60 * 1000;

export function resolveHmrcConnectionStatus(
  connection: HmrcConnection | null | undefined,
  now = Date.now(),
): HmrcConnectionStatus {
  if (connection === undefined) return "loading";
  if (connection === null) return "disconnected";
  if (connection.expiresAt <= now) return "expired";
  if (connection.expiresAt - now < EXPIRING_WINDOW_MS) return "expiring";
  return "connected";
}

export function formatHmrcTokenExpiry(expiresAt: number): string {
  return `Expires ${new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  })}`;
}
