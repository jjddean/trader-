import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { consultantPartnerSecret } from "./partner-registry";

const PRODUCTION_COOKIE_NAME = "__Host-fc_end_user";
const DEVELOPMENT_COOKIE_NAME = "fc_end_user_dev";
const SECRET_PATTERN = /^[a-f0-9]{64}$/;

export const END_USER_STATEMENT_MAX_BYTES = 64 * 1024;

export function endUserCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

function randomSecret(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashEndUserSecret(token) };
}

/** One-time value placed in the email URL. Only its hash is persisted. */
export function generateEndUserRedemptionCode() {
  const generated = randomSecret();
  return { code: generated.token, codeHash: generated.tokenHash };
}

/** Separate browser session created only after the email code is consumed. */
export function generateEndUserSession() {
  return randomSecret();
}

export function hashEndUserSecret(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const wanted = endUserCookieName();
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== wanted) continue;
    const value = pair.slice(separator + 1).trim().toLowerCase();
    return SECRET_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function endUserCredentialFromRequest(request: Request): {
  tokenHash: string;
  partnerSecret: string;
} | null {
  const token = tokenFromCookieHeader(request.headers.get("cookie"));
  const partnerSecret = consultantPartnerSecret();
  if (!token || !partnerSecret) return null;
  return { tokenHash: hashEndUserSecret(token), partnerSecret };
}

export async function endUserCredentialFromCookies(): Promise<{
  tokenHash: string;
  partnerSecret: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(endUserCookieName())?.value?.trim().toLowerCase();
  const partnerSecret = consultantPartnerSecret();
  if (!token || !SECRET_PATTERN.test(token) || !partnerSecret) return null;
  return { tokenHash: hashEndUserSecret(token), partnerSecret };
}

export function endUserCookie(token: string, expiresAt: number) {
  return {
    name: endUserCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
    priority: "high" as const,
  };
}

export function expiredEndUserCookie() {
  return {
    name: endUserCookieName(),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}

export function endUserRequestIsSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
