/**
 * Consultant partner configuration, Convex side.
 *
 * Convex reads outbound-only credentials. Inbound partner authentication is
 * configured separately in the Next.js runtime and is never copied here.
 *
 * Convex only ever needs to call OUT to a partner (status sync, expiry), so
 * only the intake URL and outbound key are read here. Inbound credentials are
 * checked in the API routes and are not needed in this runtime.
 */

export interface PartnerEndpoint {
  slug: string;
  name: string;
  intakeUrl?: string;
  outboundKey?: string;
  outboundSigningKey?: string;
  keyId?: string;
  signingConfigurationInvalid?: boolean;
}

export function partnerEndpoint(slug: string): PartnerEndpoint | null {
  const raw = process.env.CONSULTANT_PARTNER_OUTBOUND?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[partner_config] CONSULTANT_PARTNER_OUTBOUND is not valid JSON");
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const wanted = slug.trim().toLowerCase();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.slug !== "string" || record.slug.trim().toLowerCase() !== wanted) continue;
    const outboundSigningKey =
      typeof record.outboundSigningKey === "string"
        ? record.outboundSigningKey.trim()
        : undefined;
    const keyId = typeof record.keyId === "string" ? record.keyId.trim() : undefined;
    const outboundKey =
      typeof record.outboundKey === "string" ? record.outboundKey.trim() : undefined;
    const signingConfigured = outboundSigningKey !== undefined || keyId !== undefined;
    const outboundKeyInvalid = Boolean(
      outboundKey && new TextEncoder().encode(outboundKey).byteLength < 32,
    );
    const signingValid = Boolean(
      outboundSigningKey &&
        new TextEncoder().encode(outboundSigningKey).byteLength >= 32 &&
        outboundKey &&
        new TextEncoder().encode(outboundKey).byteLength >= 32 &&
        keyId &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(keyId),
    );
    return {
      slug: wanted,
      name: typeof record.name === "string" ? record.name : wanted,
      intakeUrl: typeof record.intakeUrl === "string" ? record.intakeUrl.trim() : undefined,
      outboundKey:
        outboundKey && new TextEncoder().encode(outboundKey).byteLength >= 32
          ? outboundKey
          : undefined,
      outboundSigningKey: signingValid ? outboundSigningKey : undefined,
      keyId: signingValid ? keyId : undefined,
      signingConfigurationInvalid: outboundKeyInvalid || (signingConfigured && !signingValid),
    };
  }
  return null;
}

/**
 * Who WE are to a partner.
 *
 * A partner's inbox keys cases on the sending system's slug, so an outbound
 * status push must carry our identity — not the partner's. Sending
 * `partner.slug` here authenticated as the wrong system and every status
 * update was rejected.
 */
export function sourceSlug(): string {
  return process.env.CONSULTANT_SOURCE_SLUG?.trim() || "freightcode";
}
