import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../convex/_generated/api";
import {
  buildAmendFunctionalReferenceId,
  buildAmendmentXmlFromChange,
  type AmendmentChangeKind,
} from "../../../../lib/hmrc-amendment-xml";
import { deriveHeaderAmendment } from "../../../../lib/hmrc-amendment-pointers";
import { Id } from "../../../../../convex/_generated/dataModel";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { declarationsEndpointUrl } from "../../../../lib/hmrc-config";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForDeclaration } from "../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../lib/audit-log";
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
 * Curated header-level (DE) fields permitted for amendment. The pointer chain is
 * NOT defined here — it is derived from the HMRC WCO reference table at runtime.
 * This allowlist only bounds which header fields the route will act on.
 * Header amendments are structurally spec-derived; first HMRC DMSRES confirmation
 * is still pending (Phase 2 — add one feature, confirm before the next).
 */
const HEADER_AMENDMENT_FIELDS: Record<string, { de: string; label: string }> = {
  "Declaration/GoodsShipment/TransactionNatureCode": { de: "8/5", label: "Nature of transaction" },
  "Declaration/GoodsShipment/Destination/CountryCode": { de: "5/8", label: "Country of destination" },
};

/**
 * POST /api/hmrc/amend
 * HMRC: POST /customs/declarations/amend — TT_IM002b, FunctionCode 13, TypeCode COR.
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

    const { declarationId, mrn, changeKind, itemSequence, statementDescription, changeReasonCode, wcoPath, value } =
      await request.json();
    if (!declarationId || !mrn) {
      return NextResponse.json({ error: "Missing declarationId or mrn" }, { status: 400 });
    }

    const lane = (await convex.query(api.declarations.getLane, { id: declarationId })) as {
      userId?: string;
      status?: string;
      lrn?: string;
      invoiceCurrency?: string;
      eori?: string;
    } | null;
    if (!lane) {
      return NextResponse.json({ error: "Declaration not found" }, { status: 404 });
    }

    const status = String(lane.status || "");
    if (status.includes("Invalid") || status.includes("Cancel")) {
      return NextResponse.json(
        { error: "Declaration is cancelled or invalidated; submit a new declaration to amend." },
        { status: 400 },
      );
    }
    if (status !== "Accepted" && status !== "Amended") {
      return NextResponse.json(
        { error: `Declaration must be Accepted or Amended before amend (current: ${status || "unknown"}).` },
        { status: 400 },
      );
    }

    const items = await convex.query(api.goods_items.getItems, { declarationId });
    if (items.length === 0) {
      return NextResponse.json({ error: "No goods items on declaration; cannot build amendment XML." }, { status: 400 });
    }

    const eori = String(lane.eori || "").trim();
    if (!/^GB\d{12}$/.test(eori)) {
      return NextResponse.json(
        { error: "Declarant EORI on the declaration is missing or invalid (expected GB+12 digits)." },
        { status: 400 },
      );
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

    // Amendments follow the route the declaration was created on.
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

    const firstItem = items[0] as {
      valueAmount?: number | string;
      grossWeightKg?: number | string;
      sequence?: number;
    };
    const kind = (changeKind as AmendmentChangeKind) || "itemChargeAmount";
    const seq = parseInt(String(itemSequence ?? firstItem.sequence ?? "1"), 10) || 1;

    // CNS requires the ORIGINAL create LRN on an amendment; the direct HMRC path
    // keeps its existing minted AM- reference and correlates via X-Conversation-ID.
    let amendLrn: string;
    try {
      amendLrn = resolveFollowUpLrn(
        followUp,
        buildAmendFunctionalReferenceId(String(declarationId)),
        "amend",
      );
    } catch (lrnErr: unknown) {
      if (lrnErr instanceof FollowUpLrnUnavailableError) {
        return NextResponse.json({ error: lrnErr.message, code: "CNS_LRN_UNAVAILABLE" }, { status: 409 });
      }
      throw lrnErr;
    }

    let xmlPayload: string;
    if (kind === "headerField") {
      const path = String(wcoPath || "");
      const fieldValue = String(value ?? "").trim();
      if (!HEADER_AMENDMENT_FIELDS[path]) {
        return NextResponse.json(
          {
            error: "Unsupported header amendment field",
            supported: Object.keys(HEADER_AMENDMENT_FIELDS),
          },
          { status: 400 },
        );
      }
      if (!fieldValue) {
        return NextResponse.json(
          { error: `Provide a value for ${HEADER_AMENDMENT_FIELDS[path].label} (DE ${HEADER_AMENDMENT_FIELDS[path].de}).` },
          { status: 400 },
        );
      }
      const derived = deriveHeaderAmendment(path);
      if (!derived) {
        return NextResponse.json(
          { error: `No CDS WCO reference row for ${path}; cannot derive amendment pointers.` },
          { status: 400 },
        );
      }
      xmlPayload = buildAmendmentXmlFromChange({
        changeKind: "headerField",
        amendLrn,
        mrn: String(mrn).trim(),
        statementDescription:
          typeof statementDescription === "string" && statementDescription.trim()
            ? statementDescription.trim()
            : `Amending ${HEADER_AMENDMENT_FIELDS[path].label} (DE ${HEADER_AMENDMENT_FIELDS[path].de}) on the declaration.`,
        changeReasonCode: typeof changeReasonCode === "string" ? changeReasonCode : "21",
        itemSequence: 1,
        pointerSections: derived.pointerSections,
        leafTagId: derived.leafTagId,
        fragmentPath: derived.fragmentPath,
        value: fieldValue,
      });
    } else if (kind === "grossMass") {
      const rawMass = parseFloat(String(firstItem.grossWeightKg ?? ""));
      if (!Number.isFinite(rawMass) || rawMass <= 0) {
        return NextResponse.json(
          { error: "Set a positive gross weight on Goods Items before gross-mass amend." },
          { status: 400 },
        );
      }
      xmlPayload = buildAmendmentXmlFromChange({
        changeKind: "grossMass",
        amendLrn,
        mrn: String(mrn).trim(),
        statementDescription:
          typeof statementDescription === "string" && statementDescription.trim()
            ? statementDescription.trim()
            : "Correcting gross mass on the declaration.",
        changeReasonCode: typeof changeReasonCode === "string" ? changeReasonCode : "21",
        itemSequence: seq,
        grossMassKg: rawMass.toFixed(3).replace(/\.?0+$/, ""),
      });
    } else {
      const rawAmount = parseFloat(String(firstItem.valueAmount ?? ""));
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        return NextResponse.json(
          {
            error:
              "Set a positive item value on Goods Items before amend (amends DE 4/14 ItemChargeAmount per TT_IM002b).",
          },
          { status: 400 },
        );
      }
      xmlPayload = buildAmendmentXmlFromChange({
        changeKind: "itemChargeAmount",
        amendLrn,
        mrn: String(mrn).trim(),
        statementDescription:
          typeof statementDescription === "string" && statementDescription.trim()
            ? statementDescription.trim()
            : "Amending item price as a mistake was made on the declaration.",
        changeReasonCode: typeof changeReasonCode === "string" ? changeReasonCode : "21",
        itemSequence: seq,
        itemChargeAmount: rawAmount.toFixed(2),
        currencyId: String(lane.invoiceCurrency || "GBP"),
      });
    }

    const recordAmendEvidence = async (
      outcome: "accepted" | "rejected" | "error",
      hmrcStatus: number,
      convId: string | null,
    ) => {
      try {
        await convex.mutation(api.submissions.recordSubmission, {
          declarationId,
          environment: hmrcContext.environment,
          operation: "amend",
          outcome,
          conversationId: convId || undefined,
          lrn: amendLrn,
          eori,
          priorMrn: String(mrn).trim() || undefined,
          hmrcStatus,
          requestXml: xmlPayload,
          declarationSnapshot: lane,
        });
      } catch (evErr: unknown) {
        const m = evErr instanceof Error ? evErr.message : String(evErr);
        console.warn("[AMEND] Failed to record submission evidence (non-critical):", m);
      }
    };

    let followUpClaim: { prevStatus: string };
    try {
      followUpClaim = await convex.mutation(api.declarations.beginFollowUp, {
        id: declarationId as Id<"declarations">,
        operation: "amend",
      });
    } catch (claimErr: unknown) {
      const m = claimErr instanceof Error ? claimErr.message : String(claimErr);
      if (m.includes("SUBMIT_BLOCKED")) {
        return NextResponse.json(
          { error: m.replace(/^[\s\S]*SUBMIT_BLOCKED:\s*/, "").trim().split("\n")[0] },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Could not claim the declaration for amendment." }, { status: 500 });
    }

    const revertFollowUp = async () => {
      try {
        await convex.mutation(api.declarations.updateDeclarationStatus, {
          id: declarationId as Id<"declarations">,
          status: followUpClaim.prevStatus,
        });
      } catch (revertErr: unknown) {
        console.warn("[AMEND] Failed to revert claim after failure (non-critical):", revertErr);
      }
    };

    // CNS route — amendment through the CSP gateway.
    if (followUp.transport === "cns_inventory") {
      const cnsResult = await sendCnsDeclaration(followUp.config, {
        operation: "amend",
        xmlPayload,
        ucn: followUp.cnsUcn,
        forwardedGovHeaders: collectGovHeaders(request),
      });

      if (cnsResult.status === "failed") {
        const { error: cnsError } = cnsResult;
        const outcomeUnknown = cnsError.disposition === "outcome_unknown";
        // Only release the claim when CNS definitively refused. On an unknown
        // outcome the amendment may have landed, so the declaration stays in
        // "Amendment Processing" rather than becoming re-sendable.
        if (!outcomeUnknown) await revertFollowUp();
        await recordAmendEvidence(outcomeUnknown ? "error" : "rejected", cnsError.httpStatus, null);
        await logHmrcAudit(convex, userId, "declaration_amend_failed", {
          correlationId,
          declarationId,
          mrn: String(mrn).trim(),
          changeKind: kind,
          transport: "cns_inventory",
          reason: outcomeUnknown ? "cns_outcome_unknown" : "cns_rejected",
          cnsCode: cnsError.code,
          cnsStatus: cnsError.httpStatus,
          details: cnsError.message.slice(0, 2000),
        });
        return NextResponse.json(
          {
            error: outcomeUnknown
              ? "CNS did not return a definitive response to the amendment. Check notifications before retrying."
              : "CNS rejected the amendment",
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
        status: "Amendment Processing",
      });
      await recordAmendEvidence("accepted", cnsResult.httpStatus, null);

      try {
        await convex.mutation(api.cns.recordTransportOutcome, {
          declarationId,
          transportState: "cns_amend_pending",
          ...(cnsResult.cspId ? { cspId: cnsResult.cspId } : {}),
        });
      } catch (stateErr: unknown) {
        console.warn("[AMEND/CNS] Failed to persist transport state (non-critical):", stateErr);
      }

      await logHmrcAudit(convex, userId, "declaration_amended", {
        correlationId,
        declarationId,
        mrn: String(mrn).trim(),
        changeKind: kind,
        transport: "cns_inventory",
        cspId: cnsResult.cspId,
        amendLrn,
        hmrcStatus: cnsResult.httpStatus,
      });

      return NextResponse.json(
        {
          success: true,
          transport: "cns_inventory",
          status: "Amendment Processing",
          cspId: cnsResult.cspId,
          amendLrn,
          hmrcStatus: cnsResult.httpStatus,
        },
        { status: cnsResult.httpStatus === 202 ? 202 : 200 },
      );
    }

    const hmrcResponse = await fetchHmrc(
      declarationsEndpointUrl(hmrcContext.apiBaseUrl, "amend"),
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
      await recordAmendEvidence("error", 429, null);
      await logHmrcAudit(convex, userId, "declaration_amend_failed", {
        correlationId,
        declarationId,
        mrn: String(mrn).trim(),
        changeKind: kind,
        reason: "rate_limited",
        hmrcStatus: 429,
      });
      await revertFollowUp();
      return NextResponse.json({ error: "HMRC rate limit reached" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Amendment Error:", hmrcResponse.status, errorText);
      await recordAmendEvidence("rejected", hmrcResponse.status, hmrcResponse.headers.get("X-Conversation-ID"));
      await logHmrcAudit(convex, userId, "declaration_amend_failed", {
        correlationId,
        declarationId,
        mrn: String(mrn).trim(),
        changeKind: kind,
        reason: "hmrc_rejected",
        hmrcStatus: hmrcResponse.status,
        conversationId: hmrcResponse.headers.get("X-Conversation-ID") || null,
        details: errorText.slice(0, 2000),
      });
      await revertFollowUp();
      return NextResponse.json(
        { error: "HMRC rejected amendment", details: errorText },
        { status: hmrcResponse.status },
      );
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    if (!conversationId) {
      console.error("[AMEND] HMRC accepted but returned no X-Conversation-ID", {
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
        status: "Amendment Processing",
        conversationId: conversationId || undefined,
      });
    } catch (statusErr: unknown) {
      statusPersisted = false;
      logOperationFailure(
        { correlationId, operation: "declaration_amend", declarationId: String(declarationId) },
        statusErr,
        { note: "HMRC accepted but status persist failed" },
      );
    }

    await recordAmendEvidence("accepted", hmrcResponse.status, conversationId);

    if (conversationId) {
      try {
        await convex.mutation(api.hmrc.scheduleNotificationPulls, {
          declarationId,
          conversationId,
          environment: hmrcContext.environment,
        });
      } catch (schedErr: unknown) {
        const m = schedErr instanceof Error ? schedErr.message : String(schedErr);
        console.warn("[AMEND] Failed to schedule notification pulls (non-critical):", m);
      }
    }

    await logHmrcAudit(convex, userId, "declaration_amended", {
      correlationId,
      declarationId,
      mrn: String(mrn).trim(),
      changeKind: kind,
      conversationId,
      amendLrn,
      hmrcStatus: hmrcResponse.status,
    });

    const httpStatus = hmrcResponse.status === 202 ? 202 : 200;
    return NextResponse.json(
      {
        success: true,
        status: "Amendment Processing",
        statusPersisted,
        correlationId,
        conversationId,
        amendLrn,
        hmrcStatus: hmrcResponse.status,
      },
      { status: httpStatus },
    );
  } catch (error: unknown) {
    console.error("Amendment crash:", error);
    logOperationFailure({ correlationId, operation: "declaration_amend" }, error);
    const message = userMessageFromError(error, "Internal Server Error");
    return withCorrelation(
      NextResponse.json({ error: "Internal Server Error", message, correlationId }, { status: 500 }),
      correlationId,
    );
  }
}
