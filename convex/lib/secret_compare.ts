/** Constant-time compare for shared secrets. Convex mutations cannot use node:crypto. */
export function secretsEqual(expected: string, received: string): boolean {
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(received);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Throws unless `received` matches NOTIFICATION_INGEST_SECRET. */
export function assertIngestSecret(received: string): void {
  const expected = process.env.NOTIFICATION_INGEST_SECRET?.trim();
  if (!expected || !secretsEqual(expected, received)) {
    throw new Error("Unauthorized");
  }
}
