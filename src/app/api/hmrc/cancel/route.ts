import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { declarationsEndpointUrl, HMRC_CONFIG } from "../../../../lib/hmrc-config";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveHmrcAccessToken } from "../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../lib/audit-log";
import { buildInvalidationXml } from "../../../../lib/hmrc-invalidation-xml";

/**
 * POST /api/hmrc/cancel
 * Submit a cancellation (invalidation) request for an existing declaration.
 * HMRC: POST /customs/declarations/cancellation-requests — FunctionCode 13, TypeCode INV.
 */
export async function POST(request: Request) {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) {
      return session.error;
    }
    const { convex, userId } = session;

    const { declarationId, mrn, reason } = await request.json();
    if (!declarationId || !mrn) {
      return NextResponse.json({ error: "Missing declarationId or mrn" }, { status: 400 });
    }

    const lane = await convex.query(api.declarations.getLane, { id: declarationId });
    if (!lane) {
      return NextResponse.json({ error: "Declaration not found" }, { status: 404 });
    }

    if (lane.userId !== userId && process.env.HMRC_ENVIRONMENT !== "sandbox") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tokenResult = await resolveHmrcAccessToken(convex, userId);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const eori = String(lane.eori || "").trim();
    if (!/^GB\d{12}$/.test(eori)) {
      return NextResponse.json(
        { error: "Declarant EORI on the declaration is missing or invalid (expected GB+12 digits)." },
        { status: 400 },
      );
    }

    // DE 2/5 FunctionalReferenceID: an..35 — keep cancel LRN within limit.
    const rawId = String(declarationId);
    const cancelLrn =
      `CX-${rawId}`.length <= 35 ? `CX-${rawId}` : `CX-${rawId.slice(-32)}`;
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    const xmlPayload = buildInvalidationXml({
      cancelLrn,
      mrn,
      eori,
      reason: trimmedReason.length > 0 ? trimmedReason : undefined,
    });

    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? HMRC_CONFIG.sandboxBaseUrl
        : HMRC_CONFIG.productionBaseUrl;

    const hmrcResponse = await fetchHmrc(
      declarationsEndpointUrl(hmrcBase, "cancel"),
      {
        method: "POST",
        headers: { "Content-Type": "application/xml; charset=UTF-8" },
        body: xmlPayload,
      },
      request,
      tokenResult.token,
      eori,
    );

    const recordCancelEvidence = async (
      outcome: "accepted" | "rejected" | "error",
      hmrcStatus: number,
      convId: string | null,
    ) => {
      try {
        await convex.mutation(api.submissions.recordSubmission, {
          declarationId,
          operation: "cancel",
          outcome,
          conversationId: convId || undefined,
          lrn: cancelLrn,
          eori,
          priorMrn: String(mrn).trim() || undefined,
          hmrcStatus,
          requestXml: xmlPayload,
          declarationSnapshot: lane,
        });
      } catch (evErr: unknown) {
        const m = evErr instanceof Error ? evErr.message : String(evErr);
        console.warn("[CANCEL] Failed to record submission evidence (non-critical):", m);
      }
    };

    if (hmrcResponse.status === 429) {
      await recordCancelEvidence("error", 429, null);
      await logHmrcAudit(convex, userId, "declaration_cancel_failed", {
        declarationId,
        mrn,
        reason: "rate_limited",
        hmrcStatus: 429,
      });
      return NextResponse.json({ error: "HMRC rate limit reached" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Cancellation Error:", hmrcResponse.status, errorText);
      await recordCancelEvidence("rejected", hmrcResponse.status, hmrcResponse.headers.get("X-Conversation-ID"));
      await logHmrcAudit(convex, userId, "declaration_cancel_failed", {
        declarationId,
        mrn,
        reason: "hmrc_rejected",
        hmrcStatus: hmrcResponse.status,
        conversationId: hmrcResponse.headers.get("X-Conversation-ID") || null,
        details: errorText.slice(0, 2000),
      });
      return NextResponse.json(
        { error: "HMRC rejected cancellation", details: errorText },
        { status: hmrcResponse.status },
      );
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Cancellation Requested",
      conversationId: conversationId || undefined,
    });

    await recordCancelEvidence("accepted", hmrcResponse.status, conversationId);

    if (conversationId) {
      try {
        await convex.mutation(api.hmrc.scheduleNotificationPulls, {
          declarationId,
          conversationId,
        });
      } catch (schedErr: unknown) {
        const m = schedErr instanceof Error ? schedErr.message : String(schedErr);
        console.warn("[CANCEL] Failed to schedule notification pulls (non-critical):", m);
      }
    }

    await logHmrcAudit(convex, userId, "declaration_cancel_requested", {
      declarationId,
      mrn,
      conversationId,
      cancelLrn,
      hmrcStatus: hmrcResponse.status,
    });

    return NextResponse.json({
      success: true,
      status: "Cancellation Requested",
      conversationId,
      cancelLrn,
      requestXml: xmlPayload,
    });
  } catch (error: unknown) {
    console.error("Cancellation crash:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
