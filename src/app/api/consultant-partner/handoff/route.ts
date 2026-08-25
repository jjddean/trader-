import { createHash, randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { secureCredentialPathUrl } from "@/lib/export-controls/email-link-base";
import {
  authenticatePartner,
  consultantPartnerSecret,
} from "@/lib/export-controls/partner-registry";
import {
  readRequestBodyLimited,
  verifyPartnerSignature,
} from "@/lib/export-controls/partner-signature";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

export const runtime = "nodejs";

/** How long a launch code is valid. Long enough to follow a redirect, no more. */
const configuredHandoffTtl = Number(process.env.CONSULTANT_HANDOFF_TTL_MS);
const HANDOFF_TTL_MS = Number.isFinite(configuredHandoffTtl)
  ? Math.min(Math.max(configuredHandoffTtl, 30_000), 300_000)
  : 120_000;
const handoffLimiter = new ApiRateLimiter(60, 60_000);

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

/**
 * Issue a one-time launch URL for a consultant.
 *
 * Called by a partner's server, never a browser. The partner authenticates
 * with its own credential and asserts which of its consultants is opening the
 * case; we bind that identity to the review so the eventual sign-off carries a
 * verified reviewer rather than an address somebody typed.
 *
 * The code is returned once and stored only as a hash, so it cannot be
 * replayed from our database inside its (short) window.
 */
export async function POST(request: Request) {
  const partner = authenticatePartner(request);
  if (!partner) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!handoffLimiter.tryConsume(partner.slug)) {
    return json({ error: "Request not accepted" }, 429);
  }

  const secret = consultantPartnerSecret();
  if (!secret) {
    console.error("CONSULTANT_PARTNER_SECRET is not configured");
    return json({ error: "Handoff is not configured" }, 503);
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return json({ error: "Request not accepted" }, 415);
  }

  let rawBody: string | null;
  try {
    rawBody = await readRequestBodyLimited(request);
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }
  if (rawBody === null) {
    return json({ error: "Request not accepted" }, 413);
  }

  let requestId: string;
  let requestTimestamp: number;
  let bodyDigest: string;
  if (partner.inboundSigningKey && partner.keyId) {
    const verified = verifyPartnerSignature({
      request,
      rawBody,
      signingKey: partner.inboundSigningKey,
      keyId: partner.keyId,
    });
    if (!verified.ok) {
      return json({ error: "Unauthorized" }, 401);
    }
    requestId = verified.requestId;
    requestTimestamp = verified.timestamp;
    bodyDigest = verified.bodyDigest;
  } else {
    console.error("Consultant partner request signing is not configured");
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!hasOnlyKeys(body, ["externalCaseId", "consultant"])) {
    return json({ error: "Invalid request" }, 400);
  }

  const externalCaseId =
    typeof body.externalCaseId === "string" ? body.externalCaseId.trim() : "";
  if (!externalCaseId || externalCaseId.length > 128) {
    return json({ error: "Invalid request" }, 400);
  }

  if (!body.consultant || typeof body.consultant !== "object" || Array.isArray(body.consultant)) {
    return json({ error: "Invalid request" }, 400);
  }
  const consultant = body.consultant as Record<string, unknown>;
  if (!hasOnlyKeys(consultant, ["id", "email", "name"])) {
    return json({ error: "Invalid request" }, 400);
  }
  const consultantId = typeof consultant.id === "string" ? consultant.id.trim() : "";
  const consultantEmail = typeof consultant.email === "string" ? consultant.email.trim() : undefined;
  const consultantName = typeof consultant.name === "string" ? consultant.name.trim() : undefined;
  if (
    !consultantId ||
    consultantId.length > 128 ||
    (consultantEmail !== undefined &&
      (consultantEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(consultantEmail))) ||
    (consultantName !== undefined && (!consultantName || consultantName.length > 160))
  ) {
    return json({ error: "Invalid request" }, 400);
  }

  const code = randomBytes(32).toString("hex");
  const codeHash = createHash("sha256").update(code, "utf8").digest("hex");
  const expiresAt = Date.now() + HANDOFF_TTL_MS;
  let launchUrl: string;
  try {
    launchUrl = secureCredentialPathUrl(`/r/export/h/${code}`, request);
  } catch {
    console.error("NEXT_PUBLIC_APP_URL is not configured for consultant handoff links");
    return json({ error: "Handoff is not configured" }, 503);
  }

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    await convex.mutation(api.consultant_handoff.claimPartnerRequest, {
      partnerSecret: secret,
      partnerSlug: partner.slug,
      requestId,
      digest: bodyDigest,
      timestamp: requestTimestamp,
    });
    await convex.mutation(api.consultant_handoff.issueHandoff, {
      partnerSecret: secret,
      partnerSlug: partner.slug,
      expertRequestId: externalCaseId as Id<"expert_requests">,
      codeHash,
      expiresAt,
      consultantExternalId: consultantId,
      consultantEmail,
      consultantName,
    });
  } catch {
    console.error("Consultant handoff request was rejected");
    // Deliberately flat: a partner must not be able to distinguish "no such
    // case" from "case belongs to someone else" from "already completed".
    return json({ error: "This review is not available" }, 409);
  }

  return json({
    url: launchUrl,
    expiresAt: new Date(expiresAt).toISOString(),
  }, 200);
}
