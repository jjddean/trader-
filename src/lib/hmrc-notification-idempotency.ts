import { createHash } from "crypto";

// Build a stable idempotency key for an HMRC notification payload.
// Uses SHA-256 of the trimmed payload so identical payloads map to the same key.
export function buildHmrcNotificationIdempotencyKey(rawPayload: string | null | undefined): string {
  const normalized = (rawPayload || "").trim();
  const hash = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `hmrc:${hash}`;
}

export default buildHmrcNotificationIdempotencyKey;
