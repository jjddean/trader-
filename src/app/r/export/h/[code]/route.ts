import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { consultantPartnerSecret } from "@/lib/export-controls/partner-registry";
import {
  consultantReviewCookie,
  generateConsultantReviewSession,
} from "@/lib/export-controls/consultant-review-session";

export const runtime = "nodejs";

function securedRedirect(url: URL, status: 303 | 307 = 303) {
  const response = NextResponse.redirect(url, status);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  return response;
}

/**
 * Redeem a handoff code.
 *
 * The consultant's browser arrives here from the partner. The code is consumed
 * in the same transaction that mints the review token, so a replay — a shared
 * link, a back button, a second tab — finds it already spent and gets nothing.
 *
 * On success we redirect to the existing review page. The consultant works the
 * same form they always have; only the way they were let in has changed.
 */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const origin = new URL(request.url).origin;
  const normalizedCode = code.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedCode)) {
    return securedRedirect(new URL("/r/export/unavailable", origin));
  }

  const secret = consultantPartnerSecret();
  if (!secret) {
    console.error("CONSULTANT_PARTNER_SECRET is not configured");
    return securedRedirect(new URL("/r/export/unavailable", origin));
  }

  try {
    const session = generateConsultantReviewSession();
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const result = await convex.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: secret,
      codeHash: createHash("sha256").update(normalizedCode, "utf8").digest("hex"),
      tokenHash: session.tokenHash,
    });
    const response = securedRedirect(new URL("/r/export/review", origin));
    response.cookies.set(consultantReviewCookie(session.token, result.expiresAt));
    return response;
  } catch {
    console.error("Consultant handoff redemption was rejected");
    return securedRedirect(new URL("/r/export/unavailable", origin));
  }
}
