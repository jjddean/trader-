import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { commodityRequiresSupplementaryUnit, mapToCDS_H1, validateCdsCodeLists, validateOverseasExporter, validateTradeTerms, validateTransactionNatureCode } from "../../../../lib/wco-mapper";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { declarationsEndpointUrl } from "../../../../lib/hmrc-config";
import { resolveOrgHmrcRoutingForDeclaration } from "../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../lib/hmrc-token";
import { buildPayloadDebugSnapshot, renderH1Xml, validateXmlPreflight } from "../../../../lib/h1-xml-renderer";
import { mapToCDS_B1 } from "../../../../lib/b1-mapper";
import { mapToCDS_C1 } from "../../../../lib/c1-mapper";
import { renderC1Xml } from "../../../../lib/c1-xml-renderer";
import { mapToCDS_I1 } from "../../../../lib/i1-mapper";
import { renderI1Xml } from "../../../../lib/i1-xml-renderer";
import { resolveDeclarationCategory, validateB1SubmitGate, validateC1SubmitGate, validateI1SubmitGate } from "../../../../lib/submit-category";
import { renderB1Xml } from "../../../../lib/b1-xml-renderer";
import { validateGoodsLocationForSubmit } from "../../../../lib/goods-location";
import { validateGoodsItemSequences } from "../../../../lib/submit-goods-items";
import { logHmrcAudit } from "../../../../lib/audit-log";
import { readCnsConfig } from "../../../../lib/cns/config";
import { CnsRoutingError, selectDeclarationTransport } from "../../../../lib/cns/routing";
import { sendCnsDeclaration } from "../../../../lib/cns/declarations";
import { INVENTORY_REFERENCE_TYPE_CODE } from "../../../../lib/cns/inventory-xml";
import { evaluateRules, activeEffects, summarizeFailures, type RuleDefinition, type ScenarioInput } from "../../../../../convex/lib/rule_engine";
import { userMessageFromError } from "@/lib/convex-errors";
import { correlationIdFrom, logOperationFailure, withCorrelation } from "@/lib/correlation";

type SubmitItemInput = {
  commodityCode?: string;
  description?: string;
  originCountry?: string;
  procedureCode?: string;
  additionalProcedureCode?: string;
  valuationMethod?: string;
  valueAmount?: number | string;
  grossWeightKg?: number | string;
  supplementaryUnitQty?: number | string;
  supplementaryUnitCode?: string;
  packageType?: string;
  packageCount?: number | string;
  preferenceCode?: string;
  additionalDocuments?: Array<{
    categoryCode?: string;
    CategoryCode?: string;
    typeCode?: string;
    TypeCode?: string;
    code?: string;
  }>;
};

type SubmitDeclarationInput = {
  /** Export data set (B1/C1). Absent means the import family — see submit-category.ts. */
  declarationCategory?: string;
  eori?: string;
  dispatchCountry?: string;
  destinationCountry?: string;
  locationId?: string;
  goodsLocationKind?: string;
  goodsLocationTypeCode?: string;
  goodsLocationQualifier?: string;
  transportMode?: string;
  transportId?: string;
  transportIdType?: string;
  invoiceCurrency?: string;
  exporterName?: string;
  exporterCity?: string;
  exporterLine?: string;
  exporterPostcode?: string;
  exporterEori?: string;
};

// Confirmed required set for WEB_APP_VIA_SERVER (HMRC Fraud Prevention v3.3, Jan 2025)
// Gov-Client-Local-IPs is NOT in this list — it is not required for WEB_APP_VIA_SERVER
// and sending 127.0.0.1/private IPs triggers HMRC WAF PAYLOAD_FORBIDDEN.
const REQUIRED_CLIENT_FRAUD_HEADERS = [
  "gov-client-timezone",
  "gov-client-window-size",
  "gov-client-screens",
  "gov-client-browser-js-user-agent",
  "gov-client-browser-do-not-track",
  "gov-client-device-id",
  "gov-client-user-ids",
] as const;

function validateClientFraudHeaders(headers: Headers) {
  const missing = REQUIRED_CLIENT_FRAUD_HEADERS.filter((name) => !headers.get(name));
  return {
    valid: missing.length === 0,
    missing,
  };
}

// Hard fail-fast on missing required declaration data. Runs before XML build
// so a 400 returns the exact list of gaps rather than emitting empty tags
// that would later trip the XML preflight or get rejected by CDS. Each check
// here corresponds to a field the mapper/route would otherwise emit blank.
function validateDeclaration(lane: SubmitDeclarationInput, items: SubmitItemInput[]) {
  const errors: string[] = [];
  if (!lane?.eori) errors.push("Missing declarant EORI");
  if (!lane?.dispatchCountry) errors.push("Missing dispatch country (DE 5/14)");
  if (!lane?.destinationCountry) errors.push("Missing destination country (DE 5/8)");
  errors.push(...validateGoodsLocationForSubmit(lane || {}));
  if (!lane?.transportMode) errors.push("Missing transport mode (DE 7/4)");
  if (!lane?.transportId) errors.push("Missing transport identity (DE 7/9)");
  if (!lane?.transportIdType) errors.push("Missing transport identity type (DE 7/7)");
  if (!lane?.invoiceCurrency) errors.push("Missing invoice currency");
  errors.push(...validateOverseasExporter(lane as Record<string, unknown>));
  errors.push(...validateTransactionNatureCode(lane as Record<string, unknown>));
  errors.push(...validateTradeTerms(lane as Record<string, unknown>));
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("No goods items");
    return errors;
  }
  errors.push(...validateGoodsItemSequences(items));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it?.commodityCode) errors.push(`Item ${i}: missing commodity code (DE 6/14)`);
    if (!it?.description) errors.push(`Item ${i}: missing description`);
    if (!it?.originCountry) errors.push(`Item ${i}: missing origin (DE 5/15)`);
    if (!it?.procedureCode) errors.push(`Item ${i}: missing CPC (DE 1/10)`);
    if (!it?.additionalProcedureCode) errors.push(`Item ${i}: missing additional procedure (DE 1/11)`);
    const v = parseFloat(String(it?.valueAmount ?? ""));
    if (!Number.isFinite(v) || v <= 0) errors.push(`Item ${i}: value must be > 0`);
    const g = parseFloat(String(it?.grossWeightKg ?? ""));
    if (!Number.isFinite(g) || g <= 0) errors.push(`Item ${i}: gross weight must be > 0`);
    if (!it?.packageType) errors.push(`Item ${i}: missing package type (DE 6/9)`);
    const pc = parseInt(String(it?.packageCount ?? ""));
    if (!Number.isFinite(pc) || pc < 1) errors.push(`Item ${i}: package count must be >= 1`);
    if (commodityRequiresSupplementaryUnit(it?.commodityCode)) {
      const su = parseFloat(String(it?.supplementaryUnitQty ?? ""));
      if (!Number.isFinite(su) || su <= 0) {
        errors.push(`Item ${i}: supplementary units (DE 6/2, p/st) required for commodity ${it.commodityCode}`);
      }
    }
  }
  return errors;
}

export async function POST(request: Request) {
  const correlationId = correlationIdFrom(request);
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json(
        { error: "Convex auth token missing for current Clerk session. Please re-authenticate." },
        { status: 401 },
      );
    }
    convex.setAuth(convexToken);

    const body = await request.json();
    const { declarationId, eori: providedEori, dryRunOnly, omitAdditionalDocuments } = body;
    if (!declarationId) {
      return NextResponse.json({ error: "Missing declarationId" }, { status: 400 });
    }

    const fraudHeaderValidation = validateClientFraudHeaders(request.headers);
    if (!fraudHeaderValidation.valid) {
      return NextResponse.json(
        {
          error: "Missing required HMRC fraud prevention headers",
          missingHeaders: fraudHeaderValidation.missing,
        },
        { status: 400 },
      );
    }

    // 1. Fetch the Declaration, Items, and Auth Token from Convex
    const lane = await convex.query(api.declarations.getLane, { id: declarationId });
    if (!lane) {
      return NextResponse.json({ error: "Declaration not found or unauthorized" }, { status: 404 });
    }

    const orgRouting = await resolveOrgHmrcRoutingForDeclaration(convex, declarationId);
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    // Lock the declaration to this HMRC environment (or reject if it was
    // already bound to a different one). Prevents sandbox↔production crossover.
    try {
      await convex.mutation(api.declarations.assertAndStampEnvironment, {
        declarationId,
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

    if (providedEori && lane.eori && providedEori !== lane.eori) {
      return NextResponse.json(
        {
          error: "EORI mismatch between request and declaration",
          details: { providedEori, declarationEori: lane.eori },
        },
        { status: 400 },
      );
    }

    // Declarant EORI format gate. The route uses lane.eori as the
    // X-Submitter-Identifier header, so reject malformed values before HMRC.
    if (!/^GB\d{12}$/.test(String(lane.eori || ""))) {
      return NextResponse.json(
        { error: "Declarant EORI on the declaration is missing or invalid (expected GB+12 digits)." },
        { status: 400 },
      );
    }

    const items = await convex.query(api.goods_items.getItems, { declarationId });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No goods items found for declaration" }, { status: 400 });
    }

    // Category decides both the pre-mapper gate and the mapper/renderer pair.
    // The H1 gate asserts the full import obligation set and must not run on
    // another category — see src/lib/submit-category.ts.
    const declarationCategory = resolveDeclarationCategory(lane);
    const isB1Export = declarationCategory === "B1";
    const isC1Export = declarationCategory === "C1";
    const isI1Import = declarationCategory === "I1";
    const laneRecord = lane as Record<string, unknown>;
    const itemRecords = items as Record<string, unknown>[];
    const baselineErrors = isB1Export
      ? validateB1SubmitGate(laneRecord, itemRecords)
      : isC1Export
        ? validateC1SubmitGate(laneRecord, itemRecords)
        : isI1Import
          ? validateI1SubmitGate(laneRecord, itemRecords)
          : validateDeclaration(lane, items);
    if (baselineErrors.length > 0) {
      return NextResponse.json(
        { error: "Declaration incomplete", missing: baselineErrors },
        { status: 400 },
      );
    }

    // Transport routing (docs/cns/plan/part-1-repo-map.md §5). Decided here,
    // before mapping, because the CNS route injects the inventory reference into
    // the XML. A declaration already submitted keeps its original route.
    const cnsConfig = readCnsConfig();
    let routingContext: {
      cnsClearanceEnabled: boolean;
      cnsBadgeHolder: boolean;
      storedTransport?: "hmrc_direct" | "cns_inventory";
      cnsUcn?: string;
    };
    try {
      routingContext = await convex.query(api.cns.getRoutingContext, { declarationId });
    } catch (routingErr: unknown) {
      const m = routingErr instanceof Error ? routingErr.message : String(routingErr);
      console.error("[SUBMIT] Failed to resolve CNS routing context:", m);
      return NextResponse.json({ error: "Failed to resolve submission routing" }, { status: 500 });
    }

    let transport: "hmrc_direct" | "cns_inventory";
    try {
      transport = selectDeclarationTransport(
        { route: lane.route, locationId: lane.locationId, cnsUcn: routingContext.cnsUcn },
        { cnsClearanceEnabled: routingContext.cnsClearanceEnabled },
        { cnsBadgeHolder: routingContext.cnsBadgeHolder },
        cnsConfig,
      ).transport;
    } catch (err: unknown) {
      if (err instanceof CnsRoutingError) {
        // A declaration at an inventory-linked location that cannot go via CNS
        // must stop here. Falling through to the direct HMRC route would file a
        // frontier declaration the port cannot release against.
        return NextResponse.json({ error: err.message, code: "CNS_ROUTE_BLOCKED" }, { status: 400 });
      }
      throw err;
    }

    // Bind the declaration to this transport (or reject a route change).
    try {
      await convex.mutation(api.cns.assertAndStampTransport, {
        declarationId,
        transport,
        ...(transport === "cns_inventory"
          ? {
              environment: cnsConfig.environment,
              badgeId: cnsConfig.badgeId,
              topic: cnsConfig.topic,
              goodsLocationCode: cnsConfig.goodsLocationCode,
              inventoryReferenceType: INVENTORY_REFERENCE_TYPE_CODE,
            }
          : {}),
      });
    } catch (transportErr: unknown) {
      const m = transportErr instanceof Error ? transportErr.message : String(transportErr);
      if (m.includes("TRANSPORT_MISMATCH")) {
        return NextResponse.json(
          { error: m.replace(/^[\s\S]*TRANSPORT_MISMATCH:\s*/, "").trim().split("\n")[0] },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to bind submission transport" }, { status: 500 });
    }

    // CNS authenticates with Basic credentials, not HMRC OAuth — resolving an
    // HMRC token on that route would block submission on an unrelated consent.
    let token = "";
    if (transport === "hmrc_direct") {
      const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
      if ("error" in tokenResult) {
        return tokenResult.error;
      }
      token = tokenResult.token;
    }

    // Rule engine runs BEFORE mapping so its forbidden-document list can
    // shape the emitted XML. Pure JS — safe to run before the auth/network
    // sections complete.
    let ruleResults: ReturnType<typeof evaluateRules> = [];
    let forbiddenDocCodes: string[] = [];
    const scenarioInput: ScenarioInput = {
      declaration: {
        declarationType: lane.declarationType,
        route: lane.route,
        dispatchCountry: lane.dispatchCountry,
        transportMode: (lane as Record<string, unknown>).transportMode as string | undefined,
        transportId: (lane as Record<string, unknown>).transportId as string | undefined,
        transportIdType: (lane as Record<string, unknown>).transportIdType as string | undefined,
        valuationMethod: (lane as Record<string, unknown>).valuationMethod as string | undefined,
        mode: (lane as Record<string, unknown>).mode as string | undefined,
        invoiceTotal: (lane as Record<string, unknown>).invoiceTotal as number | string | undefined,
        exporterEori: (lane as Record<string, unknown>).exporterEori as string | undefined,
        exporterName: (lane as Record<string, unknown>).exporterName as string | undefined,
        exporterCity: (lane as Record<string, unknown>).exporterCity as string | undefined,
        exporterLine: (lane as Record<string, unknown>).exporterLine as string | undefined,
        exporterPostcode: (lane as Record<string, unknown>).exporterPostcode as string | undefined,
        transactionNatureCode: (lane as Record<string, unknown>).transactionNatureCode as string | undefined,
      },
      items: (items as SubmitItemInput[]).map((i) => ({
        commodityCode: i.commodityCode,
        originCountry: i.originCountry,
        procedureCode: i.procedureCode,
        additionalProcedureCode: i.additionalProcedureCode,
        valuationMethod: i.valuationMethod,
        preferenceCode: i.preferenceCode,
        additionalDocuments: Array.isArray(i.additionalDocuments) ? i.additionalDocuments : [],
      })),
    };
    try {
      const enabledRules = (await convex.query(api.rule_definitions.listEnabled, {})) as unknown as RuleDefinition[];
      ruleResults = evaluateRules(enabledRules, scenarioInput);
      const merged = activeEffects(enabledRules, scenarioInput);
      forbiddenDocCodes = (merged.forbiddenDocuments || []).map((d) => d.code);
    } catch (ruleErr: unknown) {
      const message = ruleErr instanceof Error ? ruleErr.message : String(ruleErr);
      console.error("Rule engine evaluation failed:", message);
      return NextResponse.json(
        {
          error: "Rule engine evaluation failed",
          message,
        },
        { status: 500 },
      );
    }
    const blockingFailures = ruleResults.filter((r) => r.status === "fail" && r.severity === "blocking");
    const advisoryFailures = ruleResults.filter((r) => r.status === "fail" && r.severity === "advisory");
    if (blockingFailures.length > 0) {
      return NextResponse.json(
        {
          error: "Rule engine blocked submission",
          blockingFailures: blockingFailures.map((r) => ({
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            field: r.field,
            reason: r.reason,
          })),
          advisoryFailures: advisoryFailures.map((r) => ({
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            field: r.field,
            reason: r.reason,
          })),
        },
        { status: 400 },
      );
    }

    let payloadInfo;
    try {
      // Category dispatch. B1/C1 are the export data sets and I1 the simplified
      // import set; anything else stays on H1. The mappers do not share a
      // payload shape — see docs/hmrc/specs/cds-api/.
      //
      // The CNS inventory reference (DE 2/1 Z/MCR) is an inventory-linked
      // import concern and is passed on the H1 path only.
      payloadInfo = isB1Export
        ? mapToCDS_B1(lane, items, { omitAdditionalDocuments, forbiddenDocCodes })
        : isC1Export
          ? mapToCDS_C1(lane, items, { omitAdditionalDocuments, forbiddenDocCodes })
          : isI1Import
            ? mapToCDS_I1(lane, items, { omitAdditionalDocuments, forbiddenDocCodes })
            : mapToCDS_H1(lane, items, {
                omitAdditionalDocuments,
                forbiddenDocCodes,
                ...(transport === "cns_inventory" ? { cnsUcn: routingContext.cnsUcn } : {}),
              });
    } catch (mappingError: unknown) {
      const message = userMessageFromError(mappingError, "Unknown mapping error");
      return NextResponse.json(
        {
          error: "Failed to map declaration to CDS payload",
          message,
        },
        { status: 400 },
      );
    }
    const validationErrors: string[] = [];

    // Code-list validation against the seeded HMRC datasets. If the
    // cds_code_lists table is empty (seed not run yet) the lookup returns
    // every value as missing — degrade gracefully by treating an empty list
    // as "validation skipped" rather than blocking every submission.
    // NOTE: this degradation is fail-OPEN. Both "list not seeded" and "lookup
    // errored" let codes through unvalidated — but they are now logged loudly
    // instead of swallowed silently, so a missing seed can't hide unnoticed.
    const codeListErrors = await validateCdsCodeLists(payloadInfo, items, async (listName, values) => {
      try {
        const seeded = await convex.query(api.cds_codes.listCodes, { listName, limit: 1 });
        if (!seeded || seeded.length === 0) {
          console.warn(`[SUBMIT] Code list '${listName}' is not seeded — skipping validation for ${values.length} value(s) (fail-open).`);
          return [];
        }
        const result = await convex.query(api.cds_codes.validateCodes, { listName, values });
        return result?.missing ?? [];
      } catch (lookupErr) {
        console.error(`[SUBMIT] Code-list lookup for '${listName}' failed — codes left unvalidated (fail-open):`, lookupErr);
        return [];
      }
    }, { category: declarationCategory });
    if (codeListErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Code-list validation failed",
          fields: codeListErrors,
        },
        { status: 400 },
      );
    }

    // Convert the JSON payload into the required HMRC XML Envelope
    const xmlPayload = isB1Export
      ? renderB1Xml(payloadInfo)
      : isC1Export
        ? renderC1Xml(payloadInfo)
        : isI1Import
          ? renderI1Xml(payloadInfo)
          : renderH1Xml(payloadInfo);

    const xmlPreflight = validateXmlPreflight(xmlPayload, lane.eori || "", {
      requireAdditionalDocument: !omitAdditionalDocuments,
    });
    const payloadDebug = buildPayloadDebugSnapshot(payloadInfo);
    if (!xmlPreflight.valid) {
      return NextResponse.json(
        {
          error: "Generated XML failed preflight checks",
          failedChecks: xmlPreflight.failed,
        },
        { status: 400 },
      );
    }

    if (dryRunOnly === true) {
      // Persist the rule results so the dashboard can surface "ready / blocked"
      // state without re-running the engine. Fire-and-forget — a persistence
      // failure must not break the dry-run response.
      try {
        await convex.mutation(api.validation_results.recompute, { declarationId });
      } catch (persistErr: unknown) {
        const message = persistErr instanceof Error ? persistErr.message : String(persistErr);
        console.warn("[VALIDATION] Failed to persist rule results (non-critical):", message);
      }
      const eoriConsistencyPass = !providedEori || !lane.eori || providedEori === lane.eori;
      // Extract document summary from XML for visual verification — no HMRC call made
      const docMatches = [...xmlPayload.matchAll(/<AdditionalDocument>[\s\S]*?<\/AdditionalDocument>/g)];
      const documentSummary = docMatches.map((m) => {
        const cat = m[0].match(/<CategoryCode>(.*?)<\/CategoryCode>/)?.[1] ?? "";
        const type = m[0].match(/<TypeCode>(.*?)<\/TypeCode>/)?.[1] ?? "";
        const id = m[0].match(/<ID>(.*?)<\/ID>/)?.[1] ?? "";
        const status = m[0].match(/<LPCOExemptionCode>(.*?)<\/LPCOExemptionCode>/)?.[1] ?? "";
        return { code: `${cat}${type}`, id, lpcoExemptionCode: status };
      });
      return NextResponse.json({
        success: true,
        dryRunOnly: true,
        hmrcCallAttempted: false,
        stage: "local_preflight_complete",
        transport,
        ...(transport === "cns_inventory"
          ? { cnsUcn: routingContext.cnsUcn, cnsBadge: cnsConfig.badgeId }
          : {}),
        requestEvidence: {
          endpoint: "local-preflight",
          method: "POST",
          contentType: "application/xml; charset=UTF-8",
          accept:
            transport === "cns_inventory"
              ? cnsConfig.declarationAccept
              : hmrcContext.declarationsAccept,
          xmlByteLength: new TextEncoder().encode(xmlPayload).length,
        },
        localPreflight: {
          fraudHeaders: fraudHeaderValidation.valid ? "pass" : "fail",
          eoriConsistency: eoriConsistencyPass ? "pass" : "fail",
          xml: xmlPreflight.valid ? "pass" : "fail",
          xmlFailedChecks: xmlPreflight.failed.length > 0 ? xmlPreflight.failed : undefined,
          validationFields: validationErrors.length === 0 ? "pass" : "fail",
          // CNS uses Basic auth, so there is no HMRC token to check on that route.
          token: transport === "cns_inventory" ? "n/a" : token ? "pass" : "fail",
          ruleEngine: ruleResults.length === 0
            ? "skipped"
            : ruleResults.some((r) => r.status === "fail" && r.severity === "blocking")
              ? "blocked"
              : ruleResults.some((r) => r.status === "fail")
                ? "advisory"
                : "pass",
        },
        ruleResults: ruleResults.map((r) => ({
          ruleId: r.ruleId,
          ruleName: r.ruleName,
          severity: r.severity,
          status: r.status,
          source: r.source,
          measureId: r.measureId,
          field: r.field,
          reason: r.reason,
          evidence: r.evidence,
        })),
        actionableFailures: summarizeFailures(ruleResults),
        documentSummary,
        payloadDebug,
        payloadInfo,
        xmlPayload,
      });
    }

    // 3. Atomically claim the declaration so a double-click / concurrent POST
    //    cannot create two live declarations (each submit mints a fresh LRN, so
    //    HMRC would NOT dedupe them). beginSubmission flips status to Processing
    //    in one transaction and rejects if already in-flight or live.
    let claim: { prevStatus: string; prevMrn: string };
    try {
      claim = await convex.mutation(api.declarations.beginSubmission, { id: declarationId });
    } catch (claimErr: unknown) {
      const msg = claimErr instanceof Error ? claimErr.message : String(claimErr);
      if (msg.includes("SUBMIT_BLOCKED")) {
        // Convex wraps mutation errors across lines — use [\s\S] not . so the
        // prefix "[Request ID: …] Server Error\nUncaught Error:" is stripped.
        const clean = msg.replace(/^[\s\S]*SUBMIT_BLOCKED:\s*/, "").trim().split("\n")[0].trim();
        return NextResponse.json(
          {
            error: clean || "Declaration cannot be submitted in its current state.",
            code: "SUBMIT_BLOCKED",
          },
          { status: 409 },
        );
      }
      throw claimErr;
    }

    // Revert the claim so the user can retry after a failed HMRC call.
    const revertClaim = async () => {
      try {
        await convex.mutation(api.declarations.updateDeclarationStatus, {
          id: declarationId,
          status: claim.prevStatus,
          mrn: claim.prevMrn,
        });
      } catch (revertErr: unknown) {
        const m = revertErr instanceof Error ? revertErr.message : String(revertErr);
        console.warn("[SUBMIT] Failed to revert claim after HMRC failure (non-critical):", m);
      }
    };

    // Append-only audit evidence: the exact XML sent, the LRN used, and an
    // as-submitted snapshot of the declaration + items. Written for every
    // attempt that reached HMRC (accepted or rejected) so a submission can be
    // reconstructed later even after the editable rows change. Best-effort:
    // never let an evidence-write failure change the HMRC outcome the caller sees.
    const submittedLrn = (payloadInfo as { Declaration?: { FunctionalReferenceID?: string } })
      ?.Declaration?.FunctionalReferenceID;
    const recordSubmissionEvidence = async (
      outcome: "accepted" | "rejected" | "error",
      hmrcStatus: number,
      convId: string | null,
    ) => {
      try {
        await convex.mutation(api.submissions.recordSubmission, {
          declarationId,
          environment: hmrcContext.environment,
          operation: "submit",
          outcome,
          conversationId: convId || undefined,
          lrn: submittedLrn,
          eori: String(lane.eori || ""),
          priorMrn: claim.prevMrn || undefined,
          hmrcStatus,
          requestXml: xmlPayload,
          declarationSnapshot: lane,
          itemsSnapshot: items,
        });
      } catch (evErr: unknown) {
        const m = evErr instanceof Error ? evErr.message : String(evErr);
        console.warn("[SUBMIT] Failed to record submission evidence (non-critical):", m);
      }
    };

    // 4a. CNS inventory-linked route.
    //
    // Diverges from the HMRC branch below in one critical respect: CNS returns
    // X-CSP-ID on the 202 and never X-Conversation-ID. The HMRC branch treats a
    // missing X-Conversation-ID as a hard failure, which would reject every
    // successful CNS submission. A 202 here means only that CNS received and
    // basic-validated the request — not inventory linking, not CDS acceptance,
    // not clearance. Everything downstream arrives on topic notifications.
    if (transport === "cns_inventory") {
      const forwardedGovHeaders: Record<string, string> = {};
      request.headers.forEach((value, name) => {
        if (name.toLowerCase().startsWith("gov-")) forwardedGovHeaders[name] = value;
      });

      const attemptKey = crypto.randomUUID();
      const hashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(xmlPayload),
      );
      const requestHash = Array.from(new Uint8Array(hashBytes), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      let cnsAttemptId: Id<"submissions">;
      try {
        cnsAttemptId = await convex.mutation(api.submissions.beginCnsAttempt, {
          declarationId,
          environment: hmrcContext.environment,
          operation: "submit",
          attemptKey,
          requestHash,
          endpoint: "/cds/customs/declarations/",
          lrn: submittedLrn,
          eori: String(lane.eori || ""),
          priorMrn: claim.prevMrn || undefined,
          requestXml: xmlPayload,
          declarationSnapshot: lane,
          itemsSnapshot: items,
        });
      } catch (attemptErr: unknown) {
        await revertClaim();
        console.error("[SUBMIT/CNS] Refusing outbound request: attempt persistence failed", attemptErr);
        return NextResponse.json(
          { error: "CNS submission was not sent because its audit attempt could not be saved." },
          { status: 500 },
        );
      }

      const cnsResult = await sendCnsDeclaration(cnsConfig, {
        operation: "create",
        xmlPayload,
        ucn: routingContext.cnsUcn,
        forwardedGovHeaders,
      });

      if (cnsResult.status === "failed") {
        const { error: cnsError } = cnsResult;
        // An unknown outcome must NOT revert the claim: CNS may still have
        // forwarded the declaration, and releasing the claim would let a retry
        // create a second live declaration under a fresh LRN.
        const outcomeUnknown = cnsError.disposition === "outcome_unknown";
        if (!outcomeUnknown) {
          await revertClaim();
        }
        await convex.mutation(api.submissions.completeCnsAttempt, {
          submissionId: cnsAttemptId,
          outcome: outcomeUnknown ? "error" : "rejected",
          hmrcStatus: cnsError.httpStatus || undefined,
          outcomeCertainty: outcomeUnknown ? "unknown" : "certain",
          cnsErrorCode: cnsError.code,
          cnsErrorMessage: cnsError.message,
        });
        try {
          await convex.mutation(api.cns.recordTransportOutcome, {
            declarationId,
            transportState: outcomeUnknown ? "cns_outcome_unknown" : "cns_request_failed",
          });
        } catch (stateErr: unknown) {
          console.warn("[SUBMIT/CNS] Failed to persist transport state (non-critical):", stateErr);
        }
        await logHmrcAudit(convex, userId, "declaration_submit_failed", {
          correlationId,
          declarationId,
          reason: outcomeUnknown ? "cns_outcome_unknown" : "cns_rejected",
          transport: "cns_inventory",
          cnsCode: cnsError.code,
          cnsStatus: cnsError.httpStatus,
          details: cnsError.message.slice(0, 2000),
          environment: hmrcContext.environment,
        });

        return NextResponse.json(
          {
            error: outcomeUnknown
              ? "CNS did not return a definitive response. The submission may still be in progress — do not resubmit until notifications have been checked."
              : "CNS rejected the declaration",
            code: cnsError.code,
            message: cnsError.message,
            details: cnsError.details,
            outcomeUnknown,
            requestEvidence: {
              endpoint: "cns:/cds/customs/declarations/",
              method: "POST",
              contentType: "application/xml; charset=utf-8",
              accept: cnsConfig.declarationAccept,
              badge: cnsConfig.badgeId,
              xmlByteLength: new TextEncoder().encode(xmlPayload).length,
            },
            payloadDebug,
            xmlPayload,
          },
          { status: outcomeUnknown ? 504 : cnsError.httpStatus || 502 },
        );
      }

      await convex.mutation(api.submissions.completeCnsAttempt, {
        submissionId: cnsAttemptId,
        outcome: "accepted",
        hmrcStatus: cnsResult.httpStatus,
        cspId: cnsResult.cspId || undefined,
        outcomeCertainty: "certain",
      });

      let cnsStatePersisted = true;
      try {
        await convex.mutation(api.cns.recordTransportOutcome, {
          declarationId,
          transportState: "cns_received_pending_processing",
          ...(cnsResult.cspId ? { cspId: cnsResult.cspId } : {}),
        });
      } catch (stateErr: unknown) {
        cnsStatePersisted = false;
        console.error("[SUBMIT/CNS] CNS accepted (202) but state persist failed:", stateErr);
      }

      await logHmrcAudit(convex, userId, "declaration_submitted", {
        correlationId,
        declarationId,
        transport: "cns_inventory",
        cspId: cnsResult.cspId,
        badge: cnsConfig.badgeId,
        topic: cnsConfig.topic,
        ucn: routingContext.cnsUcn,
        hmrcStatus: cnsResult.httpStatus,
        statePersisted: cnsStatePersisted,
        environment: hmrcContext.environment,
      });

      return NextResponse.json({
        success: true,
        transport: "cns_inventory",
        // Deliberately not "Accepted": a 202 is receipt by the CSP only.
        status: "Processing",
        transportState: "cns_received_pending_processing",
        statePersisted: cnsStatePersisted,
        cspId: cnsResult.cspId,
        hmrcStatus: cnsResult.httpStatus,
        requestEvidence: {
          endpoint: "cns:/cds/customs/declarations/",
          method: "POST",
          contentType: "application/xml; charset=utf-8",
          accept: cnsConfig.declarationAccept,
          badge: cnsConfig.badgeId,
          topic: cnsConfig.topic,
          xmlByteLength: new TextEncoder().encode(xmlPayload).length,
        },
      });
    }

    // 4b. Direct HMRC route (org mode selects sandbox vs production host)
    const hmrcEndpoint = declarationsEndpointUrl(hmrcContext.apiBaseUrl, "submit");

    const hmrcHeaders = {
      "Content-Type": "application/xml; charset=UTF-8",
    };

    const hmrcResponse = await fetchHmrc(hmrcEndpoint, {
      method: "POST",
      headers: hmrcHeaders,
      body: xmlPayload,
    }, request, token, lane.eori, hmrcContext);

    if (hmrcResponse.status === 429) {
      await revertClaim();
      await recordSubmissionEvidence("error", 429, null);
      await logHmrcAudit(convex, userId, "declaration_submit_failed", {
        correlationId,
        declarationId,
        reason: "rate_limited",
        hmrcStatus: 429,
        environment: hmrcContext.environment,
      });
      return NextResponse.json({ error: "HMRC rate limit reached, please try again shortly" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC API Submission Error:", hmrcResponse.status, errorText);
      await revertClaim();
      await recordSubmissionEvidence("rejected", hmrcResponse.status, hmrcResponse.headers.get("X-Conversation-ID"));
      await logHmrcAudit(convex, userId, "declaration_submit_failed", {
        correlationId,
        declarationId,
        reason: "hmrc_rejected",
        hmrcStatus: hmrcResponse.status,
        conversationId: hmrcResponse.headers.get("X-Conversation-ID") || null,
        details: errorText.slice(0, 2000),
        environment: hmrcContext.environment,
      });
      return NextResponse.json({
        error: "HMRC Sandbox Rejected Payload",
        details: errorText,
        hmrcStatus: hmrcResponse.status,
        requestEvidence: {
          endpoint: hmrcEndpoint,
          method: "POST",
          contentType: hmrcHeaders["Content-Type"],
          accept: hmrcContext.declarationsAccept,
          xmlByteLength: new TextEncoder().encode(xmlPayload).length,
        },
        responseEvidence: {
          status: hmrcResponse.status,
          conversationId: hmrcResponse.headers.get("X-Conversation-ID") || null,
        },
        payloadDebug,
        xmlPayload,
      }, { status: hmrcResponse.status });
    }

    // 5. Handle Synchronous Accepted Response (202)
    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    const responseText = await hmrcResponse.text();
    if (!conversationId) {
      // HMRC returned a success status, so the declaration may well have been
      // accepted — only the correlation header is missing. Reverting the claim
      // here would re-open the declaration for submission and risk a duplicate
      // live entry at CDS. Stay in "Processing" and let the stuck-declaration
      // recovery job reconcile it, matching the CNS unknown-outcome rule above.
      console.error("HMRC accepted response missing X-Conversation-ID", { status: hmrcResponse.status, responseText });
      await recordSubmissionEvidence("error", hmrcResponse.status, null);
      await logHmrcAudit(convex, userId, "declaration_submit_ambiguous", {
        correlationId,
        declarationId,
        reason: "missing_conversation_id",
        hmrcStatus: hmrcResponse.status,
        environment: hmrcContext.environment,
        claimRetained: true,
      });
      return NextResponse.json({
        error:
          "HMRC accepted the submission but did not return a Conversation ID. The declaration is left in Processing — check its status before resubmitting, or it may be filed twice.",
        hmrcStatus: hmrcResponse.status,
        details: responseText,
        requestEvidence: {
          endpoint: hmrcEndpoint,
          method: "POST",
          contentType: hmrcHeaders["Content-Type"],
          accept: hmrcContext.declarationsAccept,
          xmlByteLength: new TextEncoder().encode(xmlPayload).length,
        },
        responseEvidence: {
          status: hmrcResponse.status,
          conversationId: null,
        },
        payloadDebug,
        xmlPayload,
      }, { status: 502 });
    }

    // HMRC has accepted (202). From here a Convex error must NOT surface as a
    // 500 — that would make the caller believe the submit failed and retry,
    // creating a duplicate live declaration. Persist best-effort and report
    // success regardless, flagging if the status write didn't land.
    let statusPersisted = true;
    try {
      await convex.mutation(api.declarations.updateDeclarationStatus, {
        id: declarationId,
        status: "Processing",
        conversationId,
        mrn: "", // clear old MRN — HMRC assigns a fresh one via DMSACC
      });
    } catch (statusErr: unknown) {
      statusPersisted = false;
      const m = statusErr instanceof Error ? statusErr.message : String(statusErr);
      console.error("[SUBMIT] HMRC accepted (202) but status persist failed:", m);
    }

    await recordSubmissionEvidence("accepted", hmrcResponse.status, conversationId);

    // Convex-scheduled pulls survive serverless (Vercel kills in-process setTimeout).
    try {
      await convex.mutation(api.hmrc.scheduleNotificationPulls, {
        declarationId,
        conversationId,
        environment: hmrcContext.environment,
      });
    } catch (schedErr: unknown) {
      const m = schedErr instanceof Error ? schedErr.message : String(schedErr);
      console.warn("[SUBMIT] Failed to schedule notification pulls (non-critical):", m);
    }

    // Audit Log Entry (logHmrcAudit is internally non-fatal)
    await logHmrcAudit(convex, userId, "declaration_submitted", {
      correlationId,
      declarationId,
      environment: hmrcContext.environment,
      conversationId,
      hmrcStatus: hmrcResponse.status,
      statusPersisted,
    });

    return NextResponse.json({
      success: true,
      status: "Processing",
      statusPersisted,
      conversationId,
      hmrcStatus: hmrcResponse.status,
      requestEvidence: {
        endpoint: hmrcEndpoint,
        method: "POST",
        contentType: hmrcHeaders["Content-Type"],
        accept: hmrcContext.declarationsAccept,
        xmlByteLength: new TextEncoder().encode(xmlPayload).length,
      },
      responseEvidence: {
        status: hmrcResponse.status,
        conversationId,
        body: responseText,
      },
    });

  } catch (error: unknown) {
    console.error("Submission crash:", error);
    logOperationFailure({ correlationId, operation: "declaration_submit" }, error);
    const errorMessage = userMessageFromError(error, "Unknown error");
    const errorStack = error instanceof Error && typeof error.stack === "string" ? error.stack : undefined;
    return withCorrelation(NextResponse.json({
      error: "Internal Server Error",
      correlationId,
      message: errorMessage,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
    }, { status: 500 }), correlationId);
  }
}
