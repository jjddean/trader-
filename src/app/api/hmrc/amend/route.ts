import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../convex/_generated/api";
import {
  buildAmendFunctionalReferenceId,
  buildAmendmentXmlFromChange,
  type AmendmentChangeKind,
} from "../../../../lib/hmrc-amendment-xml";
import { deriveHeaderAmendment } from "../../../../lib/hmrc-amendment-pointers";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { declarationsEndpointUrl, HMRC_CONFIG } from "../../../../lib/hmrc-config";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveHmrcAccessToken } from "../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../lib/audit-log";

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

    if (lane.userId !== userId && process.env.HMRC_ENVIRONMENT !== "sandbox") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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

    const tokenResult = await resolveHmrcAccessToken(convex, userId);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const firstItem = items[0] as {
      valueAmount?: number | string;
      grossWeightKg?: number | string;
      sequence?: number;
    };
    const kind = (changeKind as AmendmentChangeKind) || "itemChargeAmount";
    const seq = parseInt(String(itemSequence ?? firstItem.sequence ?? "1"), 10) || 1;

    const amendLrn = buildAmendFunctionalReferenceId(String(declarationId));

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

    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? HMRC_CONFIG.sandboxBaseUrl
        : HMRC_CONFIG.productionBaseUrl;

    const hmrcResponse = await fetchHmrc(
      declarationsEndpointUrl(hmrcBase, "amend"),
      {
        method: "POST",
        headers: { "Content-Type": "application/xml; charset=UTF-8" },
        body: xmlPayload,
      },
      request,
      tokenResult.token,
      eori,
    );

    const recordAmendEvidence = async (
      outcome: "accepted" | "rejected" | "error",
      hmrcStatus: number,
      convId: string | null,
    ) => {
      try {
        await convex.mutation(api.submissions.recordSubmission, {
          declarationId,
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

    if (hmrcResponse.status === 429) {
      await recordAmendEvidence("error", 429, null);
      await logHmrcAudit(convex, userId, "declaration_amend_failed", {
        declarationId,
        mrn: String(mrn).trim(),
        changeKind: kind,
        reason: "rate_limited",
        hmrcStatus: 429,
      });
      return NextResponse.json({ error: "HMRC rate limit reached" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Amendment Error:", hmrcResponse.status, errorText);
      await recordAmendEvidence("rejected", hmrcResponse.status, hmrcResponse.headers.get("X-Conversation-ID"));
      await logHmrcAudit(convex, userId, "declaration_amend_failed", {
        declarationId,
        mrn: String(mrn).trim(),
        changeKind: kind,
        reason: "hmrc_rejected",
        hmrcStatus: hmrcResponse.status,
        conversationId: hmrcResponse.headers.get("X-Conversation-ID") || null,
        details: errorText.slice(0, 2000),
      });
      return NextResponse.json(
        { error: "HMRC rejected amendment", details: errorText },
        { status: hmrcResponse.status },
      );
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Amendment Processing",
      conversationId: conversationId || undefined,
    });

    await recordAmendEvidence("accepted", hmrcResponse.status, conversationId);

    if (conversationId) {
      try {
        await convex.mutation(api.hmrc.scheduleNotificationPulls, {
          declarationId,
          conversationId,
        });
      } catch (schedErr: unknown) {
        const m = schedErr instanceof Error ? schedErr.message : String(schedErr);
        console.warn("[AMEND] Failed to schedule notification pulls (non-critical):", m);
      }
    }

    await logHmrcAudit(convex, userId, "declaration_amended", {
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
        conversationId,
        amendLrn,
        hmrcStatus: hmrcResponse.status,
      },
      { status: httpStatus },
    );
  } catch (error: unknown) {
    console.error("Amendment crash:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
