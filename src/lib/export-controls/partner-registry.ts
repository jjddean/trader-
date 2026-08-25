/**
 * Consultant partners — the systems that run a consultant inbox for us.
 *
 * Inbound configuration lives in one env var rather than the database, so a database
 * read can never yield a credential, and adding a partner is a deploy-time
 * change reviewed like any other.
 *
 *   CONSULTANT_PARTNER_INBOUND='[{
 *     "slug": "bec",
 *     "name": "British Export Control",
 *     "inboundKey": "...",     // they present this to us
 *     "inboundSigningKey": "...",
 *     "keyId": "freightcode-bec-2026-01"
 *   }]'
 *
 * Server-side only. Nothing here may be imported into a client component.
 */

import { secretsEqual } from "@/lib/secrets-equal";

export interface ConsultantPartner {
  slug: string;
  name: string;
  intakeUrl?: string;
  /** Credential the partner presents when calling us. */
  inboundKey: string;
  /** Credential we present when calling them. */
  outboundKey?: string;
  /** HMAC key used to verify requests the partner sends us. */
  inboundSigningKey?: string;
  /** HMAC key used to sign requests we send the partner. */
  outboundSigningKey?: string;
  /** Active protocol signing-key identifier. */
  keyId?: string;
}

let cached: { raw: string; partners: ConsultantPartner[] } | null = null;

function signingKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return Buffer.byteLength(key, "utf8") >= 32 ? key : undefined;
}

function signingKeyId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const keyId = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(keyId) ? keyId : undefined;
}

export function listConsultantPartners(): ConsultantPartner[] {
  const raw = process.env.CONSULTANT_PARTNER_INBOUND?.trim() ?? "";
  if (!raw) return [];
  if (cached && cached.raw === raw) return cached.partners;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("CONSULTANT_PARTNER_INBOUND is not valid JSON — no partners configured");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error("CONSULTANT_PARTNER_INBOUND must be a JSON array — no partners configured");
    return [];
  }

  const partners: ConsultantPartner[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const slug = typeof record.slug === "string" ? record.slug.trim().toLowerCase() : "";
    const inboundKey = typeof record.inboundKey === "string" ? record.inboundKey.trim() : "";
    if (
      !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug) ||
      Buffer.byteLength(inboundKey, "utf8") < 32
    ) continue;
    partners.push({
      slug,
      name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : slug,
      inboundKey,
      inboundSigningKey: signingKey(record.inboundSigningKey),
      keyId: signingKeyId(record.keyId),
    });
  }

  cached = { raw, partners };
  return partners;
}

export function getConsultantPartner(slug: string): ConsultantPartner | null {
  const wanted = slug.trim().toLowerCase();
  return listConsultantPartners().find((partner) => partner.slug === wanted) ?? null;
}

/** The partner we dispatch to by default. First configured entry. */
export function defaultConsultantPartner(): ConsultantPartner | null {
  const configured = process.env.CONSULTANT_DEFAULT_PARTNER?.trim().toLowerCase();
  if (configured) return getConsultantPartner(configured);
  return listConsultantPartners()[0] ?? null;
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Identify the partner behind a request by its credential.
 *
 * Compares against every configured partner in constant time and returns null
 * on any failure, so the endpoint cannot be used to discover which slugs exist
 * or which keys are close to correct.
 */
export function authenticatePartner(request: Request): ConsultantPartner | null {
  const presented = bearerToken(request.headers.get("authorization"));
  if (!presented) return null;

  let matched: ConsultantPartner | null = null;
  for (const partner of listConsultantPartners()) {
    if (secretsEqual(partner.inboundKey, presented)) matched = partner;
  }
  return matched;
}

/** Secret our own API routes use to reach the Convex partner surface. */
export function consultantPartnerSecret(): string {
  const secret = process.env.CONSULTANT_PARTNER_SECRET?.trim() ?? "";
  return Buffer.byteLength(secret, "utf8") >= 32 ? secret : "";
}

/** Who we are to a partner. See convex/lib/partner_config.ts for the twin. */
export function sourceSlug(): string {
  return process.env.CONSULTANT_SOURCE_SLUG?.trim() || "freightcode";
}
