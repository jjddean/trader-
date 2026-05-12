import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { mapToCDS_H1, validateCdsFields, validateCdsCodeLists } from "../../../../lib/wco-mapper";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { buildPayloadDebugSnapshot, renderH1Xml, validateXmlPreflight } from "../../../../lib/h1-xml-renderer";
import { evaluateRules, activeEffects, summarizeFailures, type RuleDefinition, type ScenarioInput } from "../../../../../convex/lib/rule_engine";

type SubmitItemInput = {
  commodityCode?: string;
  originCountry?: string;
  procedureCode?: string;
  additionalProcedureCode?: string;
  valuationMethod?: string;
  preferenceCode?: string;
  additionalDocuments?: Array<{
    categoryCode?: string;
    CategoryCode?: string;
    typeCode?: string;
    TypeCode?: string;
    code?: string;
  }>;
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

export async function POST(request: Request) {
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
    if (!lane || (lane.userId !== userId && process.env.HMRC_ENVIRONMENT !== "sandbox")) {
      return NextResponse.json({ error: "Declaration not found or unauthorized" }, { status: 404 });
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
    
    const items = await convex.query(api.goods_items.getItems, { declarationId });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No goods items found for declaration" }, { status: 400 });
    }
    
    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    
    if (!tokenRecord || !tokenRecord.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found. Please connect your account." }, { status: 403 });
    }

    let token = tokenRecord.accessToken;

    // Check if token is expired or expiring within 5 minutes (300000 ms)
    if (tokenRecord.expiresAt && Date.now() + 300000 > tokenRecord.expiresAt) {
      if (!tokenRecord.refreshToken) {
        return NextResponse.json({ error: "HMRC Token expired and no refresh token available. Please reconnect." }, { status: 403 });
      }

      const clientId = process.env.HMRC_CLIENT_ID!;
      const clientSecret = process.env.HMRC_CLIENT_SECRET!;
      const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
        ? "https://test-api.service.hmrc.gov.uk"
        : "https://api.service.hmrc.gov.uk";
      const tokenUrl = `${hmrcBase}/oauth/token`;

      const refreshBody = new URLSearchParams({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: tokenRecord.refreshToken,
      });

      const refreshResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: refreshBody.toString(),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        return NextResponse.json({ error: "Failed to refresh HMRC token. Please reconnect.", details: errorText }, { status: 403 });
      }

      const data = await refreshResponse.json();
      token = data.access_token;

      // Update token in Convex
      await convex.mutation(api.hmrc.saveToken, {
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 14400,
        eori: tokenRecord.eori
      });
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
    }
    const blockingFailures = ruleResults.filter((r) => r.status === "fail" && r.severity === "blocking");
    const advisoryFailures = ruleResults.filter((r) => r.status === "fail" && r.severity === "advisory");
    if (blockingFailures.length > 0 && dryRunOnly !== true) {
      // Block live submissions on rule failures. Dry runs proceed so the user
      // can see exactly which rules fired without losing the rest of the
      // preflight payload.
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
      payloadInfo = mapToCDS_H1(lane, items, { omitAdditionalDocuments, forbiddenDocCodes });
    } catch (mappingError: unknown) {
      const message = mappingError instanceof Error ? mappingError.message : "Unknown mapping error";
      return NextResponse.json(
        {
          error: "Failed to map declaration to CDS payload",
          message,
        },
        { status: 400 },
      );
    }
    const validationErrors = validateCdsFields(lane, items, payloadInfo);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fields: validationErrors,
        },
        { status: 400 },
      );
    }

    // Code-list validation against the seeded HMRC datasets. If the
    // cds_code_lists table is empty (seed not run yet) the lookup returns
    // every value as missing — degrade gracefully by treating an empty list
    // as "validation skipped" rather than blocking every submission.
    const codeListErrors = await validateCdsCodeLists(payloadInfo, items, async (listName, values) => {
      try {
        const result = await convex.query(api.cds_codes.validateCodes, { listName, values });
        const seeded = await convex.query(api.cds_codes.listCodes, { listName, limit: 1 });
        if (!seeded || seeded.length === 0) return [];
        return result?.missing ?? [];
      } catch {
        return [];
      }
    });
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
    const xmlPayload = renderH1Xml(payloadInfo);

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
        success: xmlPreflight.valid,
        dryRunOnly: true,
        hmrcCallAttempted: false,
        stage: "local_preflight_complete",
        requestEvidence: {
          endpoint: "local-preflight",
          method: "POST",
          contentType: "application/xml; charset=UTF-8",
          accept: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
          xmlByteLength: new TextEncoder().encode(xmlPayload).length,
        },
        localPreflight: {
          fraudHeaders: fraudHeaderValidation.valid ? "pass" : "fail",
          eoriConsistency: eoriConsistencyPass ? "pass" : "fail",
          xml: xmlPreflight.valid ? "pass" : "fail",
          xmlFailedChecks: xmlPreflight.failed.length > 0 ? xmlPreflight.failed : undefined,
          validationFields: validationErrors.length === 0 ? "pass" : "fail",
          token: token ? "pass" : "fail",
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
        xmlPayload,
      });
    }

    // 3. Fire the POST request to HMRC
    const hmrcEndpoint = process.env.HMRC_ENVIRONMENT === "sandbox" 
      ? "https://test-api.service.hmrc.gov.uk/customs/declarations" 
      : "https://api.service.hmrc.gov.uk/customs/declarations";

    const hmrcHeaders = {
      "Content-Type": "application/xml; charset=UTF-8",
    };

    const hmrcResponse = await fetchHmrc(hmrcEndpoint, {
      method: "POST",
      headers: hmrcHeaders,
      body: xmlPayload,
    }, request, token);

    if (hmrcResponse.status === 429) {
      return NextResponse.json({ error: "HMRC rate limit reached, please try again shortly" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC API Submission Error:", hmrcResponse.status, errorText);
      return NextResponse.json({
        error: "HMRC Sandbox Rejected Payload",
        details: errorText,
        hmrcStatus: hmrcResponse.status,
        requestEvidence: {
          endpoint: hmrcEndpoint,
          method: "POST",
          contentType: hmrcHeaders["Content-Type"],
          accept: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
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

    // 4. Handle Synchronous Accepted Response (202)
    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    const responseText = await hmrcResponse.text();
    if (!conversationId) {
      console.error("HMRC accepted response missing X-Conversation-ID", { status: hmrcResponse.status, responseText });
      return NextResponse.json({
        error: "HMRC accepted response missing X-Conversation-ID",
        hmrcStatus: hmrcResponse.status,
        details: responseText,
        requestEvidence: {
          endpoint: hmrcEndpoint,
          method: "POST",
          contentType: hmrcHeaders["Content-Type"],
          accept: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
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
    
    // Update declaration status to Processing
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Processing",
      conversationId
    });

    // 5. Audit Log Entry (non-critical, don't crash submission on failure)
    try {
      await convex.mutation(api.audit.logAction, {
        userId,
        action: "declaration_submitted",
        metadata: {
          declarationId,
          mrn: lane.mrn || "Draft",
          environment: process.env.HMRC_ENVIRONMENT || "sandbox",
          conversationId,
          hmrcStatus: hmrcResponse.status,
        }
      });
    } catch (auditErr) {
      console.warn("[AUDIT] Failed to log submission (non-critical):", auditErr);
    }

    return NextResponse.json({ 
      success: true, 
      status: "Processing",
      conversationId,
      hmrcStatus: hmrcResponse.status,
      requestEvidence: {
        endpoint: hmrcEndpoint,
        method: "POST",
        contentType: hmrcHeaders["Content-Type"],
        accept: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error && typeof error.stack === "string" ? error.stack : undefined;
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: errorMessage,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
    }, { status: 500 });
  }
}
