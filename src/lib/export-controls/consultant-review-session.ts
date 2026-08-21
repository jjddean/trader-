import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { consultantPartnerSecret } from "./partner-registry";

const PRODUCTION_COOKIE_NAME = "__Host-fc_consultant_review";
const DEVELOPMENT_COOKIE_NAME = "fc_consultant_review_dev";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function consultantReviewCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

export function generateConsultantReviewSession(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashConsultantReviewSession(token) };
}

export function hashConsultantReviewSession(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const wanted = consultantReviewCookieName();
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== wanted) continue;
    const value = pair.slice(separator + 1).trim();
    return TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function consultantReviewCredentialFromRequest(request: Request): {
  tokenHash: string;
  partnerSecret: string;
} | null {
  const token = tokenFromCookieHeader(request.headers.get("cookie"));
  const partnerSecret = consultantPartnerSecret();
  if (!token || !partnerSecret) return null;
  return { tokenHash: hashConsultantReviewSession(token), partnerSecret };
}

export async function consultantReviewCredentialFromCookies(): Promise<{
  tokenHash: string;
  partnerSecret: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(consultantReviewCookieName())?.value;
  const partnerSecret = consultantPartnerSecret();
  if (!token || !TOKEN_PATTERN.test(token) || !partnerSecret) return null;
  return { tokenHash: hashConsultantReviewSession(token), partnerSecret };
}

export function consultantReviewCookie(
  token: string,
  expiresAt: number,
) {
  return {
    name: consultantReviewCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
    priority: "high" as const,
  };
}

export function expiredConsultantReviewCookie() {
  return {
    name: consultantReviewCookieName(),
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

export function requestIsSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export const CONSULTANT_REVIEW_ACTION_MAX_BYTES = 8 * 1024;
