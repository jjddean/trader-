import { createHash } from "node:crypto";

function normalizePayload(rawPayload: string): string {
  return rawPayload.replace(/\r\n/g, "\n").trim();
}

export function buildHmrcNotificationIdempotencyKey(rawPayload: string): string {
  return createHash("sha256").update(normalizePayload(rawPayload), "utf8").digest("hex");
}
