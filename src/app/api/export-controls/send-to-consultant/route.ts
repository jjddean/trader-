import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  defaultConsultantPartner,
  getConsultantPartner,
} from "@/lib/export-controls/partner-registry";
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
const consultantDispatchLimiter = new ApiRateLimiter(20, 60_000);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(message: string, status: number) {
  return json({ error: message }, status);
}

/**
 * Request sign-off.
 *
 * Freezes the review, then hands the case to the consultant partner's inbox by
 * authenticated API. Only metadata travels: the assessment, evidence and
 * undertaking stay here, and the consultant comes back through a one-time
 * handoff to work the review in FreightCode.
 *
 * A delivery failure is recorded against the dispatch rather than thrown away,
 * so the frozen snapshot survives and the send can be retried without
 * re-freezing a changed assessment.
 */
export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return errorResponse("Request not accepted", 403);

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return errorResponse("Unauthenticated", 401);
    }
    if (!consultantDispatchLimiter.tryConsume(userId)) {
      return errorResponse("Request not accepted", 429);
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return errorResponse("Unauthenticated", 401);
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      console.error("send-to-consultant: NEXT_PUBLIC_CONVEX_URL is not configured");
      return errorResponse(GENERIC_ERROR_MESSAGE, 500);
    }

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

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

    if (
      body.retryExpertRequestId !== undefined &&
      (typeof body.retryExpertRequestId !== "string" || !body.retryExpertRequestId.trim())
    ) {
      return errorResponse("Invalid request", 400);
    }
    const retryExpertRequestId =
      typeof body.retryExpertRequestId === "string"
        ? (body.retryExpertRequestId.trim() as Id<"expert_requests">)
        : undefined;
    const assessmentId =
      typeof body.assessmentId === "string" && body.assessmentId.trim()
        ? (body.assessmentId.trim() as Id<"export_assessments">)
        : undefined;
    const consultantRole =
      body.consultantRole === "adviser" ||
      body.consultantRole === "applies_on_behalf" ||
      body.consultantRole === "eor"
        ? body.consultantRole
        : undefined;

    const allowed = retryExpertRequestId
      ? new Set(["retryExpertRequestId"])
      : new Set(["assessmentId", "consultantRole", "senderNote"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      return errorResponse("Invalid request", 400);
    }
    if (
      (retryExpertRequestId && retryExpertRequestId.length > 64) ||
      (assessmentId && assessmentId.length > 64) ||
      (typeof body.senderNote === "string" && body.senderNote.length > 2_000) ||
      (body.senderNote !== undefined && typeof body.senderNote !== "string")
    ) {
      return errorResponse("Invalid request", 400);
    }

    if (!retryExpertRequestId && !assessmentId) {
      return errorResponse("assessmentId required", 400);
    }
    if (!retryExpertRequestId && !consultantRole) {
      return errorResponse("consultantRole required", 400);
    }

    const prepared = await (async () => {
      if (retryExpertRequestId) {
        const dispatch = await convex.mutation(
          api.compliance_consultant.retryConsultantDispatch,
          { expertRequestId: retryExpertRequestId },
        );
        return {
          dispatch,
          partner: getConsultantPartner(dispatch.externalSystem),
        };
      }

      if (!assessmentId || !consultantRole) return null;

      const partner = defaultConsultantPartner();
      if (!partner) return { dispatch: null, partner: null };

      const dispatch = await convex.mutation(
        api.compliance_consultant.createConsultantDispatch,
        {
          assessmentId,
          partnerSlug: partner.slug,
          consultantRole,
          senderNote: typeof body.senderNote === "string" ? body.senderNote : undefined,
        },
      );
      return { dispatch, partner };
    })();

    if (!prepared) return errorResponse("assessmentId required", 400);
    if (!prepared.partner || !prepared.dispatch) {
      return errorResponse("No consultant partner is configured. Contact support.", 503);
    }

    const { dispatch, partner } = prepared;

    return json({
      ok: true,
      partner: partner.name,
      expertRequestId: dispatch.expertRequestId,
      externalCaseId: null,
      deliveryStatus: "pending",
      expiresAt: dispatch.expiresAt,
    }, 202);
  } catch (error: unknown) {
    console.error("send-to-consultant error:", error);
    const message = userMessageFromError(error, GENERIC_ERROR_MESSAGE);
    return errorResponse(message, 500);
  }
}
