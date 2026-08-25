import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { GENERIC_ERROR_MESSAGE, userMessageFromError } from "@/lib/convex-errors";
import {
  CONSULTANT_REVIEW_ACTION_MAX_BYTES,
  requestIsSameOrigin,
} from "@/lib/export-controls/consultant-review-session";
import { readRequestBodyLimited } from "@/lib/export-controls/partner-signature";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;
const consultantRevokeLimiter = new ApiRateLimiter(20, 60_000);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(message: string, status: number) {
  return json({ error: message }, status);
}

/**
 * Withdraw a review already with the consultant.
 *
 * The Convex mutation closes the review and durably queues the partner status
 * in one transaction. Network delivery is retried independently of this HTTP
 * request.
 */
export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return errorResponse("Request not accepted", 403);

  try {
    const { userId, getToken } = await auth();
    if (!userId) return errorResponse("Unauthenticated", 401);
    if (!consultantRevokeLimiter.tryConsume(userId)) {
      return errorResponse("Request not accepted", 429);
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return errorResponse("Unauthenticated", 401);
    }

    let body: Record<string, unknown>;
    try {
      const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "application/json") return errorResponse("Request not accepted", 415);
      const rawBody = await readRequestBodyLimited(request, CONSULTANT_REVIEW_ACTION_MAX_BYTES);
      if (rawBody === null) return errorResponse("Request not accepted", 413);
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return errorResponse("Invalid request", 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return errorResponse("Invalid request", 400);
    }

    const expertRequestId =
      typeof body.expertRequestId === "string" && body.expertRequestId.trim()
        ? (body.expertRequestId.trim() as Id<"expert_requests">)
        : undefined;
    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
    if (
      !expertRequestId ||
      expertRequestId.length > 64 ||
      Object.keys(body).some((key) => key !== "expertRequestId" && key !== "reason") ||
      (body.reason !== undefined && typeof body.reason !== "string") ||
      (reason !== undefined && reason.length > 500)
    ) {
      return errorResponse("Invalid request", 400);
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      console.error("revoke-consultant-review: NEXT_PUBLIC_CONVEX_URL is not configured");
      return errorResponse(GENERIC_ERROR_MESSAGE, 500);
    }

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const result = await convex.mutation(api.compliance_consultant.revokeConsultantDispatch, {
      expertRequestId,
      reason: reason || undefined,
    });

    return json({
      ok: true,
      partnerNotificationQueued: result.partnerNotificationQueued,
    });
  } catch (error: unknown) {
    console.error("revoke-consultant-review error:", error);
    return errorResponse(userMessageFromError(error, GENERIC_ERROR_MESSAGE), 500);
  }
}
