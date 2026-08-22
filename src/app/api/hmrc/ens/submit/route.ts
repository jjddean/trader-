import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { userMessageFromError } from "@/lib/convex-errors";
import { amendEns, correlationIdOf, submitEns } from "../../../../../lib/ens/ens-client";
import { ENS_MESSAGE_TYPES } from "../../../../../lib/ens/cc315-builder";
import type { EnsDeclaration } from "../../../../../lib/ens/types";
import { resolveOrgHmrcRoutingForOrg } from "../../../../../lib/hmrc-org-routing";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";

/**
 * POST /api/hmrc/ens/submit
 *
 * Submits a new ENS (IE315) or, when `mrn` is supplied, an amendment (IE313).
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md` §3–4
 *
 * Two properties of this endpoint drive its shape:
 *
 * 1. **A 200 is not an acceptance.** HMRC returns a correlation ID meaning the
 *    message was accepted. The declaration's fate arrives later on the Outcomes
 *    API. The record therefore moves to `submitted`, never `accepted`.
 * 2. **The correlation ID is the only handle** until an MRN exists. It is
 *    written through `recordEnsSubmission` before this route returns, so a
 *    crash cannot leave a live submission with nothing pointing at it.
 *
 * Sandbox simulation headers are accepted from the caller but ignored in
 * production — `ensSimulationHeaders` gates on environment, not trust.
 */
export async function POST(request: Request) {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) return session.error;
    const { convex, userId } = session;

    const body = (await request.json().catch(() => null)) as {
      ensDeclarationId?: string;
      mrn?: string;
      simulation?: Record<string, unknown>;
    } | null;

    if (!body?.ensDeclarationId) {
      return NextResponse.json({ error: "ensDeclarationId is required" }, { status: 400 });
    }

    const record = await convex.query(api.ens_declarations.getEnsDeclaration, {
      id: body.ensDeclarationId as Id<"ens_declarations">,
    });
    if (!record) {
      return NextResponse.json({ error: "ENS declaration not found" }, { status: 404 });
    }

    const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, clerkAuth.orgId);
    if ("error" in orgRouting) return orgRouting.error;
    const { hmrcContext } = orgRouting;

    // The declaration's stamped environment wins over the org's current mode:
    // a sandbox ENS must never be replayed at production because the org has
    // since gone live. Same lock the CDS path applies to `declarations`.
    const environment = (record.environment ?? "sandbox") as "sandbox" | "production";
    if (hmrcContext.environment && hmrcContext.environment !== environment) {
      return NextResponse.json(
        {
          error: "Environment mismatch",
          message: `This ENS is bound to ${environment} but the organisation is configured for ${hmrcContext.environment}.`,
        },
        { status: 409 },
      );
    }

    const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
    if ("error" in tokenResult) return tokenResult.error;

    const eori = String(record.personLodgingSummaryDeclaration?.eori ?? "").trim();
    if (!eori) {
      return NextResponse.json(
        { error: "The person lodging the summary declaration must have an EORI before submission." },
        { status: 400 },
      );
    }
    // MesSenMES3 is EORI/branch. HMRC rejects a bare EORI with error 4065.
    const branch = process.env.HMRC_ENS_BRANCH_ID || "0000000000";
    const messageSender = `${eori}/${branch}`;

    const declaration = record as unknown as EnsDeclaration;
    const isAmendment = Boolean(body.mrn);

    const result = isAmendment
      ? await amendEns(declaration, String(body.mrn), {
          environment,
          accessToken: tokenResult.token,
          messageSender,
          simulation: body.simulation as never,
        })
      : await submitEns(declaration, {
          environment,
          accessToken: tokenResult.token,
          messageSender,
          simulation: body.simulation as never,
        });

    // Local rule failures never reached HMRC, so there is nothing to record
    // against the declaration beyond telling the operator what to fix.
    if (result.localViolations && result.localViolations.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed before submission",
          violations: result.localViolations.map((v) => ({
            errorCode: v.errorCode,
            contextElement: v.contextElement,
            message: v.message,
          })),
        },
        { status: 400 },
      );
    }

    if (result.transportError) {
      // Deliberately not recorded as failed: HMRC may still have stored the
      // declaration, so the operator must resolve it rather than blind-retry.
      return NextResponse.json(
        {
          error: "HMRC did not respond",
          message: result.transportError,
          outcome: "unknown",
        },
        { status: 504 },
      );
    }

    const correlationId = correlationIdOf(result) ?? undefined;
    const errors =
      result.response?.kind === "error" ? result.response.errors : undefined;

    await convex.mutation(api.ens_declarations.recordEnsSubmission, {
      id: body.ensDeclarationId as Id<"ens_declarations">,
      operation: isAmendment ? "amend" : "submit",
      messageType: isAmendment ? ENS_MESSAGE_TYPES.IE313 : ENS_MESSAGE_TYPES.IE315,
      httpStatus: result.httpStatus,
      correlationId,
      requestXml: result.requestXml,
      responseXml: result.responseXml,
      errors,
      outcome: correlationId ? "submitted" : "rejected",
    });

    if (!correlationId) {
      return NextResponse.json(
        { error: "HMRC rejected the submission", httpStatus: result.httpStatus, errors },
        { status: 400 },
      );
    }

    return NextResponse.json({
      correlationId,
      httpStatus: result.httpStatus,
      // Said plainly so no caller mistakes this for acceptance.
      status: "submitted",
      message:
        "HMRC accepted the message and returned a correlation ID. The outcome, including any MRN, arrives separately via the Outcomes API.",
    });
  } catch (error) {
    console.error("[ENS SUBMIT] failed", error);
    return NextResponse.json({ error: userMessageFromError(error) }, { status: 500 });
  }
}
