import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  CONSULTANT_REVIEW_ACTION_MAX_BYTES,
  consultantReviewCredentialFromRequest,
  expiredConsultantReviewCookie,
  requestIsSameOrigin,
} from "@/lib/export-controls/consultant-review-session";
import { readRequestBodyLimited } from "@/lib/export-controls/partner-signature";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewActionLimiter = new ApiRateLimiter(120, 10 * 60 * 1000);

function json(body: unknown, status = 200) {
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

function stripCredentialFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCredentialFields);
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "token" || key === "tokenHash" || key === "activeToken") continue;
    sanitized[key] = stripCredentialFields(child);
  }
  return sanitized;
}

export async function GET(request: Request) {
  const credential = consultantReviewCredentialFromRequest(request);
  if (!credential) return json({ error: "Review unavailable" }, 401);
  if (!reviewActionLimiter.tryConsume(`read:${credential.tokenHash}`)) {
    return json({ error: "Request not accepted" }, 429);
  }

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const [review, endUserToken] = await Promise.all([
      convex.query(api.compliance_consultant.getReviewByToken, credential),
      convex.query(api.compliance_end_user.getLatestEndUserTokenForReview, {
        ...credential,
      }),
    ]);
    if (!review) return json({ error: "Review unavailable" }, 401);

    const evidence = (review.evidence ?? []).map((item) => ({
      ...item,
      downloadUrl: item.downloadUrl
        ? `/api/export-controls/review-evidence/session/${item._id}`
        : undefined,
    }));

    return json(stripCredentialFields({ ...review, evidence, endUserToken }));
  } catch {
    return json({ error: "Review unavailable" }, 401);
  }
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return json({ error: "Request not accepted" }, 403);

  const credential = consultantReviewCredentialFromRequest(request);
  if (!credential) return json({ error: "Review unavailable" }, 401);
  if (!reviewActionLimiter.tryConsume(credential.tokenHash)) {
    return json({ error: "Request not accepted" }, 429);
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "Request not accepted" }, 415);

  let rawBody: string | null;
  try {
    rawBody = await readRequestBodyLimited(request, CONSULTANT_REVIEW_ACTION_MAX_BYTES);
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }
  if (rawBody === null) return json({ error: "Request not accepted" }, 413);

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }

  const action = body.action;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  try {
    if (action === "opened" && Object.keys(body).length === 1) {
      await convex.mutation(api.compliance_consultant.markReviewTokenOpened, credential);
      return json({ ok: true });
    }

    const allowed = new Set([
      "action",
      "advisoryNotes",
      "outcome",
      "applicationRef",
      "licenceRef",
      "acknowledgedEndUserTokenId",
    ]);
    if (action !== "complete" || Object.keys(body).some((key) => !allowed.has(key))) {
      return json({ error: "Request not accepted" }, 400);
    }

    const advisoryNotes = typeof body.advisoryNotes === "string" ? body.advisoryNotes.trim() : "";
    const outcome = body.outcome;
    const applicationRef = typeof body.applicationRef === "string" ? body.applicationRef.trim() : undefined;
    const licenceRef = typeof body.licenceRef === "string" ? body.licenceRef.trim() : undefined;
    const acknowledgedEndUserTokenId =
      typeof body.acknowledgedEndUserTokenId === "string"
        ? body.acknowledgedEndUserTokenId.trim()
        : undefined;
    if (
      body.acknowledgedEndUserTokenId !== undefined &&
      (typeof body.acknowledgedEndUserTokenId !== "string" ||
        !acknowledgedEndUserTokenId ||
        acknowledgedEndUserTokenId.length > 64)
    ) {
      return json({ error: "Request not accepted" }, 400);
    }
    if (
      !advisoryNotes ||
      advisoryNotes.length > 5_000 ||
      (outcome !== "cleared" && outcome !== "blocked") ||
      (applicationRef !== undefined && applicationRef.length > 160) ||
      (licenceRef !== undefined && licenceRef.length > 160)
    ) {
      return json({ error: "Request not accepted" }, 400);
    }

    await convex.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential,
      advisoryNotes,
      outcome,
      applicationRef: applicationRef || undefined,
      licenceRef: licenceRef || undefined,
      acknowledgedEndUserTokenId: acknowledgedEndUserTokenId as
        | Id<"export_end_user_tokens">
        | undefined,
    });
    const response = json({ ok: true });
    response.cookies.set(expiredConsultantReviewCookie());
    return response;
  } catch {
    return json({ error: "Review unavailable" }, 409);
  }
}
