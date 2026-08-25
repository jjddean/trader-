import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { consultantPartnerSecret } from "@/lib/export-controls/partner-registry";
import {
  endUserCookie,
  generateEndUserSession,
  hashEndUserSecret,
} from "@/lib/export-controls/end-user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function securedRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const origin = new URL(request.url).origin;
  const unavailable = new URL("/r/end-user/unavailable", origin);
  const { code } = await context.params;
  const normalizedCode = code.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedCode)) return securedRedirect(unavailable);

  const partnerSecret = consultantPartnerSecret();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!partnerSecret || !convexUrl) {
    console.error("End-user redemption is not configured");
    return securedRedirect(unavailable);
  }

  try {
    const session = generateEndUserSession();
    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.mutation(api.compliance_end_user.redeemEndUserCode, {
      partnerSecret,
      codeHash: hashEndUserSecret(normalizedCode),
      tokenHash: session.tokenHash,
    });
    const response = securedRedirect(new URL("/r/end-user/review", origin));
    response.cookies.set(endUserCookie(session.token, result.expiresAt));
    return response;
  } catch {
    console.error("End-user redemption was rejected");
    return securedRedirect(unavailable);
  }
}
