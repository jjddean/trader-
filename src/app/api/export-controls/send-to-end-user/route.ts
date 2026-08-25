import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";
import { GENERIC_ERROR_MESSAGE, userMessageFromError } from "@/lib/convex-errors";
import { sendEndUserStatementEmail } from "@/lib/export-controls/end-user-email";
import { secureCredentialPathUrl } from "@/lib/export-controls/email-link-base";
import {
  generateEndUserRedemptionCode,
  endUserRequestIsSameOrigin,
} from "@/lib/export-controls/end-user-session";
import { consultantReviewCredentialFromRequest } from "@/lib/export-controls/consultant-review-session";
import { consultantPartnerSecret } from "@/lib/export-controls/partner-registry";
import { readRequestBodyLimited } from "@/lib/export-controls/partner-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dispatchLimiter = new ApiRateLimiter(10, 60_000);
const MAX_BODY_BYTES = 4 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!endUserRequestIsSameOrigin(request)) {
    return json({ error: "Request not accepted" }, 403);
  }

  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") return json({ error: "Request not accepted" }, 415);
    const rawBody = await readRequestBodyLimited(request, MAX_BODY_BYTES);
    if (rawBody === null) return json({ error: "Request not accepted" }, 413);
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "Request not accepted" }, 400);
    }
    const body = parsed as Record<string, unknown>;
    if (Object.keys(body).some((key) => !["assessmentId", "recipientEmail", "senderNote"].includes(key))) {
      return json({ error: "Request not accepted" }, 400);
    }

    const assessmentId =
      typeof body.assessmentId === "string" && body.assessmentId.length <= 64
        ? (body.assessmentId as Id<"export_assessments">)
        : undefined;
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    const senderNote = typeof body.senderNote === "string" ? body.senderNote.trim() : undefined;
    if (
      !recipientEmail ||
      recipientEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) ||
      (senderNote !== undefined && senderNote.length > 2_000)
    ) {
      return json({ error: "Request not accepted" }, 400);
    }

    const reviewCredential = assessmentId ? null : consultantReviewCredentialFromRequest(request);
    if (!assessmentId && !reviewCredential) return json({ error: "Review unavailable" }, 401);

    let limiterKey: string;
    let clerkToken: string | null = null;
    let notifyEmail: string | undefined;
    if (assessmentId) {
      const { userId, getToken } = await auth();
      if (!userId) return json({ error: "Unauthenticated" }, 401);
      limiterKey = userId;
      if (!dispatchLimiter.tryConsume(limiterKey)) {
        return json({ error: "Request not accepted" }, 429);
      }
      clerkToken = await getToken({ template: "convex" });
      if (!clerkToken) return json({ error: "Unauthenticated" }, 401);
      const sender = await currentUser();
      notifyEmail = sender?.primaryEmailAddress?.emailAddress?.trim() || undefined;
    } else {
      limiterKey = reviewCredential!.tokenHash;
      if (!dispatchLimiter.tryConsume(limiterKey)) {
        return json({ error: "Request not accepted" }, 429);
      }
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const partnerSecret = consultantPartnerSecret();
    if (!convexUrl || !partnerSecret) {
      return json({ error: "Request could not be completed" }, 503);
    }

    const redemption = generateEndUserRedemptionCode();
    const formUrl = secureCredentialPathUrl(`/r/end-user/h/${redemption.code}`, request);
    const convex = new ConvexHttpClient(convexUrl);
    if (clerkToken) convex.setAuth(clerkToken);

    const dispatch = assessmentId
      ? await convex.mutation(api.compliance_end_user.createEndUserDispatchFromAssessment, {
          assessmentId,
          redemptionCodeHash: redemption.codeHash,
          recipientEmail,
          notifyEmail,
          senderNote,
        })
      : await convex.mutation(api.compliance_end_user.createEndUserDispatch, {
          ...reviewCredential!,
          redemptionCodeHash: redemption.codeHash,
          recipientEmail,
          senderNote,
        });

    const names = dispatch.emailContext.productNames;
    const productSummary = names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
    const email = await sendEndUserStatementEmail({
        to: dispatch.recipientEmail,
        assessmentReference: dispatch.emailContext.reference,
        destinationCountry: dispatch.emailContext.destinationCountry,
        productSummary: productSummary || undefined,
        senderNote,
        formUrl,
        expiresAt: dispatch.expiresAt,
      })
      .catch(() => ({ sent: false as const }));

    if (!email.sent) {
      await convex
        .mutation(api.compliance_end_user.revokeUndeliveredEndUserDispatch, {
          tokenId: dispatch.tokenId,
          partnerSecret,
        })
        .catch(() => console.error("Undelivered EUSU credential could not be revoked"));
      return json({ error: "The email could not be sent. No access link was issued." }, 502);
    }

    return json({
      ok: true,
      recipientEmail: dispatch.recipientEmail,
      emailSent: true,
    });
  } catch (error: unknown) {
    console.error("End-user dispatch request failed");
    return json({ error: userMessageFromError(error, GENERIC_ERROR_MESSAGE) }, 409);
  }
}
