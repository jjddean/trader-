import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { declarationsEndpointUrl } from "../../../../lib/hmrc-config";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForDeclaration } from "../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../lib/audit-log";
import { buildInvalidationXml } from "../../../../lib/hmrc-invalidation-xml";
import {
  collectGovHeaders,
  FollowUpLrnUnavailableError,
  resolveFollowUpContext,
  resolveFollowUpLrn,
} from "../../../../lib/cns/follow-up";
import { sendCnsDeclaration } from "../../../../lib/cns/declarations";
import { userMessageFromError } from "@/lib/convex-errors";
import { correlationIdFrom, logOperationFailure, withCorrelation } from "@/lib/correlation";

/**
 * POST /api/hmrc/cancel
 * Submit a cancellation (invalidation) request for an existing declaration.
 * HMRC: POST /customs/declarations/cancellation-requests — FunctionCode 13, TypeCode INV.
 */
export async function POST(request: Request) {
  const correlationId = correlationIdFrom(request);
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

    const orgRouting = await resolveOrgHmrcRoutingForDeclaration(
      convex,
      declarationId as Id<"declarations">,
    );
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    try {
      await convex.mutation(api.declarations.assertAndStampEnvironment, {
        declarationId: declarationId as Id<"declarations">,
        environment: hmrcContext.environment,
      });
    } catch (envErr: unknown) {
      const m = envErr instanceof Error ? envErr.message : String(envErr);
      if (m.includes("ENVIRONMENT_MISMATCH")) {
        return NextResponse.json(
          { error: m.replace(/^.*ENVIRONMENT_MISMATCH:\s*/, "") },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to verify declaration environment" }, { status: 403 });
    }

    // Follow-up operations stay on the route the declaration was created on.
    const followUp = await resolveFollowUpContext(convex, declarationId as Id<"declarations">);

    // CNS authenticates with Basic credentials — no HMRC OAuth token needed.
    let hmrcToken = "";
    if (followUp.transport === "hmrc_direct") {
      const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
      if ("error" in tokenResult) {
        return tokenResult.error;
      }
      hmrcToken = tokenResult.token;
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
    const mintedCancelLrn =
      `CX-${rawId}`.length <= 35 ? `CX-${rawId}` : `CX-${rawId.slice(-32)}`;

    // CNS requires the ORIGINAL create LRN here; the direct HMRC path keeps its
    // existing minted CX- reference and correlates via X-Conversation-ID.
    let cancelLrn: string;
    try {
      cancelLrn = resolveFollowUpLrn(followUp, mintedCancelLrn, "cancel");
    } catch (lrnErr: unknown) {
      if (lrnErr instanceof FollowUpLrnUnavailableError) {
        return NextResponse.json({ error: lrnErr.message, code: "CNS_LRN_UNAVAILABLE" }, { status: 409 });
      }
      throw lrnErr;
    }
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    const xmlPayload = buildInvalidationXml({
      cancelLrn,
      mrn,
      eori,
      reason: trimmedReason.length > 0 ? trimmedReason : undefined,
    });

    const recordCancelEvidence = async (
      outcome: "accepted" | "rejected" | "error",
      hmrcStatus: number,
      convId: string | null,
    ) => {
      try {
        await convex.mutation(api.submissions.recordSubmission, {
          declarationId,
          environment: hmrcContext.environment,
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

    let followUpClaim: { prevStatus: string };
    try {
      followUpClaim = await convex.mutation(api.declarations.beginFollowUp, {
        id: declarationId as Id<"declarations">,
        operation: "cancel",
      });
    } catch (claimErr: unknown) {
      const m = claimErr instanceof Error ? claimErr.message : String(claimErr);
      if (m.includes("SUBMIT_BLOCKED")) {
        return NextResponse.json(
          { error: m.replace(/^[\s\S]*SUBMIT_BLOCKED:\s*/, "").trim().split("\n")[0] },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Could not claim the declaration for cancellation." }, { status: 500 });
    }

    const revertFollowUp = async () => {
      try {
        await convex.mutation(api.declarations.updateDeclarationStatus, {
          id: declarationId as Id<"declarations">,
          status: followUpClaim.prevStatus,
        });
      } catch (revertErr: unknown) {
        console.warn("[CANCEL] Failed to revert claim after failure (non-critical):", revertErr);
      }
    };

    // CNS route — cancellation through the CSP gateway.
    if (followUp.transport === "cns_inventory") {
      const cnsResult = await sendCnsDeclaration(followUp.config, {
        operation: "cancel",
        xmlPayload,
        forwardedGovHeaders: collectGovHeaders(request),
      });

      if (cnsResult.status === "failed") {
        const { error: cnsError } = cnsResult;
        const outcomeUnknown = cnsError.disposition === "outcome_unknown";
        // Unknown outcome: the cancellation may have landed, so keep the claim.
        if (!outcomeUnknown) await revertFollowUp();
        await recordCancelEvidence(outcomeUnknown ? "error" : "rejected", cnsError.httpStatus, null);
        await logHmrcAudit(convex, userId, "declaration_cancel_failed", {
          correlationId,
          declarationId,
          mrn,
          transport: "cns_inventory",
          reason: outcomeUnknown ? "cns_outcome_unknown" : "cns_rejected",
          cnsCode: cnsError.code,
          cnsStatus: cnsError.httpStatus,
          details: cnsError.message.slice(0, 2000),
        });
        return NextResponse.json(
          {
            error: outcomeUnknown
              ? "CNS did not return a definitive response to the cancellation. Check notifications before retrying."
              : "CNS rejected the cancellation",
            code: cnsError.code,
            message: cnsError.message,
            details: cnsError.details,
            outcomeUnknown,
          },
          { status: outcomeUnknown ? 504 : cnsError.httpStatus || 502 },
        );
      }

      await convex.mutation(api.declarations.updateDeclarationStatus, {
        id: declarationId,
        status: "Cancellation Requested",
      });
      await recordCancelEvidence("accepted", cnsResult.httpStatus, null);

      try {
        await convex.mutation(api.cns.recordTransportOutcome, {
          declarationId,
          transportState: "cns_cancel_pending",
          ...(cnsResult.cspId ? { cspId: cnsResult.cspId } : {}),
        });
      } catch (stateErr: unknown) {
        console.warn("[CANCEL/CNS] Failed to persist transport state (non-critical):", stateErr);
      }

      await logHmrcAudit(convex, userId, "declaration_cancel_requested", {
        correlationId,
        declarationId,
        mrn,
        transport: "cns_inventory",
        cspId: cnsResult.cspId,
        cancelLrn,
        hmrcStatus: cnsResult.httpStatus,
      });

      return NextResponse.json({
        success: true,
        transport: "cns_inventory",
        status: "Cancellation Requested",
        cspId: cnsResult.cspId,
        cancelLrn,
        hmrcStatus: cnsResult.httpStatus,
        requestXml: xmlPayload,
      });
    }

    const hmrcResponse = await fetchHmrc(
      declarationsEndpointUrl(hmrcContext.apiBaseUrl, "cancel"),
      {
        method: "POST",
        headers: { "Content-Type": "application/xml; charset=UTF-8" },
        body: xmlPayload,
      },
      request,
      hmrcToken,
      eori,
      hmrcContext,
    );

    if (hmrcResponse.status === 429) {
      await revertFollowUp();
      await recordCancelEvidence("error", 429, null);
      await logHmrcAudit(convex, userId, "declaration_cancel_failed", {
        correlationId,
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
      await revertFollowUp();
      await recordCancelEvidence("rejected", hmrcResponse.status, hmrcResponse.headers.get("X-Conversation-ID"));
      await logHmrcAudit(convex, userId, "declaration_cancel_failed", {
        correlationId,
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
    if (!conversationId) {
      console.error("[CANCEL] HMRC accepted but returned no X-Conversation-ID", {
        declarationId,
        hmrcStatus: hmrcResponse.status,
      });
    }

    // HMRC has accepted. A Convex failure from here — an expired token during a
    // slow HMRC call is the likely cause — must not surface as a 500, or the
    // caller believes the request failed. The claim already blocks a duplicate;
    // this stops us reporting failure on success.
    let statusPersisted = true;
    try {
      await convex.mutation(api.declarations.updateDeclarationStatus, {
        id: declarationId,
        status: "Cancellation Requested",
        conversationId: conversationId || undefined,
      });
    } catch (statusErr: unknown) {
      statusPersisted = false;
      logOperationFailure(
        { correlationId, operation: "declaration_cancel", declarationId: String(declarationId) },
        statusErr,
        { note: "HMRC accepted but status persist failed" },
      );
    }

    await recordCancelEvidence("accepted", hmrcResponse.status, conversationId);

    if (conversationId) {
      try {
        await convex.mutation(api.hmrc.scheduleNotificationPulls, {
          declarationId,
          conversationId,
          environment: hmrcContext.environment,
        });
      } catch (schedErr: unknown) {
        const m = schedErr instanceof Error ? schedErr.message : String(schedErr);
        console.warn("[CANCEL] Failed to schedule notification pulls (non-critical):", m);
      }
    }

    await logHmrcAudit(convex, userId, "declaration_cancel_requested", {
      correlationId,
      declarationId,
      mrn,
      conversationId,
      cancelLrn,
      hmrcStatus: hmrcResponse.status,
    });

    return NextResponse.json({
      success: true,
      status: "Cancellation Requested",
      statusPersisted,
      correlationId,
      conversationId,
      cancelLrn,
      requestXml: xmlPayload,
    });
  } catch (error: unknown) {
    console.error("Cancellation crash:", error);
    logOperationFailure({ correlationId, operation: "declaration_cancel" }, error);
    const message = userMessageFromError(error, "Internal Server Error");
    return withCorrelation(
      NextResponse.json({ error: "Internal Server Error", message, correlationId }, { status: 500 }),
      correlationId,
    );
  }
}
