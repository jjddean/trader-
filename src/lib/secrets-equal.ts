import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare for bearer tokens and shared secrets. */
export function secretsEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
