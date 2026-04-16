import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { mapToCDS_H1, validateCdsFields } from "../../../../lib/wco-mapper";
import { xmlEscape } from "../../../../lib/xml-utils";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";

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

function validateXmlPreflight(xmlPayload: string, eori: string) {
  const checks = {
    has_metadata: xmlPayload.includes("<MetaData"),
    has_declaration: xmlPayload.includes("<Declaration"),
    has_function_code: xmlPayload.includes("<FunctionCode>9</FunctionCode>"),
    has_type_code: /<TypeCode>(IM[A-Z]|EX[A-Z])<\/TypeCode>/.test(xmlPayload),
    has_declarant_id: xmlPayload.includes(`<ID>${eori}</ID>`),
    has_goods_shipment: xmlPayload.includes("<GoodsShipment>"),
    has_additional_document: xmlPayload.includes("<AdditionalDocument>"),
    no_y922: !xmlPayload.includes("<TypeCode>922</TypeCode>"),
  };
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return {
    valid: failed.length === 0,
    failed,
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
    const { declarationId, eori: providedEori, dryRunOnly } = body;
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

    let payloadInfo;
    try {
      payloadInfo = mapToCDS_H1(lane, items);
    } catch (mappingError: any) {
      return NextResponse.json(
        {
          error: "Failed to map declaration to CDS payload",
          message: mappingError?.message || "Unknown mapping error",
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

    // Convert the JSON payload into the required HMRC XML Envelope
    const d = payloadInfo.Declaration;
    const gs = d.GoodsShipment;

    // Exporter: only include if an explicit exporterEori is set AND it's a GB/XI EORI.
    // HMRC DE 3/2 guidance: "Do NOT enter if Exporter is not UK-based."
    // Falling back to the declarant's own EORI for an overseas exporter is wrong.
    const exporterEori = String(d.Exporter?.ID || "").trim();
    const exporterXml = /^(GB|XI)\d{12}$/i.test(exporterEori)
      ? `\n    <Exporter>\n      <ID>${xmlEscape(exporterEori)}</ID>\n    </Exporter>`
      : "";

    // WCO DEC-DMS 2 xs:sequence — Declaration element order:
    //   FunctionCode → FunctionalReferenceID → TypeCode → GoodsItemQuantity →
    //   DeclarationOfficeID → InvoiceAmount → TotalGrossMassMeasure → TotalPackageQuantity →
    //   Declarant → Exporter → GoodsShipment
    //
    // GoodsShipment xs:sequence order (WCO DEC-DMS 2 / HMRC CDS profile):
    //   UCR → Consignment → Destination → ExportCountry → Importer →
    //   TradeTerms → GovernmentAgencyGoodsItem[]
    // Source: documentation/HMRC/TDR_Integration_Reference.md §6
    // Warehouse is NOT included — it is a dependent (D) field, only required for customs
    // warehouse procedures. CPC 4000 (release to free circulation) does not use a warehouse.
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${xmlEscape(d.FunctionCode)}</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(d.FunctionalReferenceID)}</FunctionalReferenceID>
    <TypeCode>${xmlEscape(d.TypeCode)}</TypeCode>
    <GoodsItemQuantity>${xmlEscape(d.GoodsItemQuantity)}</GoodsItemQuantity>
    <DeclarationOfficeID>${xmlEscape(d.DeclarationOfficeID)}</DeclarationOfficeID>
    <InvoiceAmount currencyID="${xmlEscape(d.InvoiceAmount.currencyID)}">${xmlEscape(d.InvoiceAmount.value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(d.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(d.UCR.TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
      <Consignment>
        <ContainerCode>${xmlEscape(gs.Consignment.ContainerCode)}</ContainerCode>
        <ArrivalTransportMeans>
          <ID>${xmlEscape(gs.Consignment.BorderTransportMeans.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(gs.Consignment.BorderTransportMeans.IdentificationTypeCode)}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(gs.Consignment.BorderTransportMeans.ModeCode)}</ModeCode>
        </ArrivalTransportMeans>
        <GoodsLocation>
          <Name>${xmlEscape(gs.Consignment.GoodsLocation.Name)}</Name>
          <ID>${xmlEscape(gs.Consignment.GoodsLocation.ID)}</ID>
        </GoodsLocation>
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(gs.Destination.CountryCode)}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${xmlEscape(gs.ExportCountry.ID)}</ID>
      </ExportCountry>
      <Importer>
        <ID>${xmlEscape(gs.Importer.ID)}</ID>
      </Importer>
      <TradeTerms>
        <ConditionCode>${xmlEscape(gs.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(gs.TradeTerms.LocationID)}</LocationID>
      </TradeTerms>
      ${gs.GovernmentAgencyGoodsItem.map((item: any) => {
        const additionalDocuments = Array.isArray(item.AdditionalDocument) ? item.AdditionalDocument : [];
        const additionalDocumentsXml = additionalDocuments
          .map((doc: any) => `
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(doc?.CategoryCode || "")}</CategoryCode>
          <ID>${xmlEscape(doc?.ID || "")}</ID>
          <TypeCode>${xmlEscape(doc?.TypeCode || "")}</TypeCode>
          ${doc?.StatusCode ? `<LPCOExemptionCode>${xmlEscape(doc.StatusCode)}</LPCOExemptionCode>` : ""}
        </AdditionalDocument>`)
          .join("");
        const classification = Array.isArray(item?.Commodity?.Classification) && item.Commodity.Classification[0]
          ? item.Commodity.Classification[0]
          : { ID: "", IdentificationTypeCode: "TSP" };
        const procedures = Array.isArray(item.GovernmentProcedure) ? item.GovernmentProcedure : [];
        const packaging = Array.isArray(item.Packaging) && item.Packaging[0]
          ? item.Packaging[0]
          : { SequenceNumeric: "1", MarksNumbersID: "N/A", QuantityQuantity: "1", TypeCode: "PK" };
        const originXml = item.Origin?.CountryCode
          ? `\n        <Origin>\n          <CountryCode>${xmlEscape(item.Origin.CountryCode)}</CountryCode>\n          <TypeCode>${xmlEscape(item.Origin.TypeCode || "1")}</TypeCode>\n        </Origin>`
          : "";
        return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(item.StatisticalValueAmount.currencyID)}">${xmlEscape(item.StatisticalValueAmount.value)}</StatisticalValueAmount>
        ${additionalDocumentsXml}
        <Commodity>
          <Description>${xmlEscape(item?.Commodity?.Description || "General goods")}</Description>
          <Classification>
            <ID>${xmlEscape(classification.ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(classification.IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(item?.Commodity?.GoodsMeasure?.GrossMassMeasure || 0)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(item?.Commodity?.GoodsMeasure?.NetNetWeightMeasure || 0)}</NetNetWeightMeasure>
          </GoodsMeasure>
        </Commodity>
        ${procedures.map((proc: any) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(proc.CurrentCode)}</CurrentCode>
          ${proc.PreviousCode ? `<PreviousCode>${xmlEscape(proc.PreviousCode)}</PreviousCode>` : ''}
        </GovernmentProcedure>`).join('')}${originXml}
        <Packaging>
          <SequenceNumeric>${xmlEscape(packaging.SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(packaging.MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(packaging.QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(packaging.TypeCode)}</TypeCode>
        </Packaging>
      </GovernmentAgencyGoodsItem>`;
      }).join('')}
    </GoodsShipment>
  </Declaration>
</MetaData>`;

    const xmlPreflight = validateXmlPreflight(xmlPayload, lane.eori || "");
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
        localPreflight: {
          fraudHeaders: fraudHeaderValidation.valid ? "pass" : "fail",
          eoriConsistency: eoriConsistencyPass ? "pass" : "fail",
          xml: xmlPreflight.valid ? "pass" : "fail",
          xmlFailedChecks: xmlPreflight.failed.length > 0 ? xmlPreflight.failed : undefined,
          validationFields: validationErrors.length === 0 ? "pass" : "fail",
          token: token ? "pass" : "fail",
        },
        documentSummary,
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
      return NextResponse.json({ error: "HMRC Sandbox Rejected Payload", details: errorText }, { status: hmrcResponse.status });
    }

    // 4. Handle Synchronous Accepted Response (202)
    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    
    // Update declaration status to Processing
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Processing",
      conversationId: conversationId || undefined
    });

    // 5. Audit Log Entry (non-critical, don't crash submission on failure)
    try {
      await convex.mutation(api.audit.logAction, {
        userId,
        action: "declaration_submitted",
        metadata: {
          declarationId: declarationId as any,
          mrn: lane.mrn || "Draft",
          environment: process.env.HMRC_ENVIRONMENT || "sandbox",
          conversationId: conversationId || undefined
        }
      });
    } catch (auditErr) {
      console.warn("[AUDIT] Failed to log submission (non-critical):", auditErr);
    }

    return NextResponse.json({ 
      success: true, 
      status: "Processing",
      conversationId 
    });

  } catch (error: any) {
    console.error("Submission crash:", error);
    const errorMessage = error?.message || "Unknown error";
    const errorStack = typeof error?.stack === "string" ? error.stack : undefined;
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: errorMessage,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
    }, { status: 500 });
  }
}
