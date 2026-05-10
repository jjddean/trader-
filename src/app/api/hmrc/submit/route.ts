import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { mapToCDS_H1, validateCdsFields, validateCdsCodeLists } from "../../../../lib/wco-mapper";
import { xmlEscape } from "../../../../lib/xml-utils";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { validateClientFraudHeaders } from "../../../../lib/hmrc/submit/fraud-header-preflight";
import { evaluateRules, activeEffects, summarizeFailures, type RuleDefinition, type ScenarioInput } from "../../../../../convex/lib/rule_engine";

function validateXmlPreflight(xmlPayload: string, eori: string, opts: { requireAdditionalDocument?: boolean } = {}) {
  const requireAdditionalDocument = opts.requireAdditionalDocument !== false;
  const checks: Record<string, boolean> = {
    has_metadata: xmlPayload.includes("<MetaData"),
    has_declaration: xmlPayload.includes("<Declaration"),
    has_function_code: xmlPayload.includes("<FunctionCode>9</FunctionCode>"),
    has_type_code: /<TypeCode>(IM[A-Z]|EX[A-Z])<\/TypeCode>/.test(xmlPayload),
    has_declarant_id: xmlPayload.includes(`<ID>${eori}</ID>`),
    has_goods_shipment: xmlPayload.includes("<GoodsShipment>"),
    has_previous_document: xmlPayload.includes("<PreviousDocument>"),
    no_y922: !xmlPayload.includes("<TypeCode>922</TypeCode>"),
  };
  if (requireAdditionalDocument) {
    checks.has_additional_document = xmlPayload.includes("<AdditionalDocument>");
  }
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return {
    valid: failed.length === 0,
    failed,
  };
}

function buildPayloadDebugSnapshot(payloadInfo: any) {
  const declaration = payloadInfo?.Declaration ?? {};
  const shipment = declaration?.GoodsShipment ?? {};
  const goodsItems = Array.isArray(shipment?.GovernmentAgencyGoodsItem)
    ? shipment.GovernmentAgencyGoodsItem
    : [];

  return {
    declaration: {
      functionCode: declaration?.FunctionCode || "",
      functionalReferenceId: declaration?.FunctionalReferenceID || "",
      typeCode: declaration?.TypeCode || "",
      declarationOfficeId: declaration?.DeclarationOfficeID || "",
      invoiceAmount: declaration?.InvoiceAmount || null,
      totalGrossMassMeasure: declaration?.TotalGrossMassMeasure || "",
      totalPackageQuantity: declaration?.TotalPackageQuantity || "",
      borderTransportMeans: declaration?.BorderTransportMeans || null,
      declarantId: declaration?.Declarant?.ID || "",
      exporterId: declaration?.Exporter?.ID || "",
      ucr: declaration?.UCR?.TraderAssignedReferenceID || "",
    },
    goodsShipment: {
      buyerCountryCode: shipment?.Buyer?.AddressCountryCode || "",
      sellerCountryCode: shipment?.Seller?.AddressCountryCode || "",
      destinationCountryCode: shipment?.Destination?.CountryCode || "",
      exportCountryId: shipment?.ExportCountry?.ID || "",
      importerId: shipment?.Importer?.ID || "",
      tradeTerms: shipment?.TradeTerms || null,
      previousDocuments: Array.isArray(shipment?.PreviousDocument) ? shipment.PreviousDocument : [],
      consignment: {
        containerCode: shipment?.Consignment?.ContainerCode || "",
        goodsLocationId: shipment?.Consignment?.GoodsLocation?.ID || "",
        arrivalTransportMeans: shipment?.Consignment?.ArrivalTransportMeans || null,
      },
    },
    items: goodsItems.map((item: any) => ({
      sequenceNumeric: item?.SequenceNumeric || "",
      statisticalValueAmount: item?.StatisticalValueAmount || null,
      commodity: {
        description: item?.Commodity?.Description || "",
        classification: Array.isArray(item?.Commodity?.Classification) ? item.Commodity.Classification : [],
        goodsMeasure: item?.Commodity?.GoodsMeasure || null,
      },
      customsValuation: item?.CustomsValuation || null,
      governmentProcedures: Array.isArray(item?.GovernmentProcedure) ? item.GovernmentProcedure : [],
      additionalDocuments: Array.isArray(item?.AdditionalDocument) ? item.AdditionalDocument : [],
      packaging: Array.isArray(item?.Packaging) ? item.Packaging : [],
      origin: item?.Origin || null,
    })),
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
      items: items.map((i: any) => ({
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
    } catch (ruleErr: any) {
      console.error("Rule engine evaluation failed:", ruleErr?.message || ruleErr);
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
    // GoodsShipment xs:sequence is ALPHABETICAL (WCO DEC-DMS 2):
    //   Consignment → Destination → ExportCountry → GovernmentAgencyGoodsItem[] →
    //   Importer → PreviousDocument[] → TradeTerms → UCR
    // Getting this order wrong => "Invalid content was found starting with element X.
    // One of Warehouse is expected" from the CDS schema validator.
    // Warehouse is NOT included — it is a dependent (D) field, only required for customs
    // warehouse procedures. CPC 4000 (release to free circulation) does not use a warehouse.
    const previousDocs = Array.isArray(gs.PreviousDocument) ? gs.PreviousDocument : [];
    const previousDocumentXml = previousDocs.map((pd: any) => `
      <PreviousDocument>
        <CategoryCode>${xmlEscape(pd.CategoryCode || "")}</CategoryCode>
        <ID>${xmlEscape(pd.ID || "")}</ID>
        <TypeCode>${xmlEscape(pd.TypeCode || "")}</TypeCode>${pd.LineNumeric ? `\n        <LineNumeric>${xmlEscape(pd.LineNumeric)}</LineNumeric>` : ""}
      </PreviousDocument>`).join("");

    // DE 7/14 + 7/15 — BorderTransportMeans at Declaration level. Full
    // triplet (ID + IdentificationTypeCode + ModeCode) — ModeCode-only fails
    // CDS12073. Pairs with Consignment.ArrivalTransportMeans (R123).
    const btm = d.BorderTransportMeans || {};
    const borderTransportMeansXml = btm.ID
      ? `
    <BorderTransportMeans>
      <ID>${xmlEscape(btm.ID)}</ID>
      <IdentificationTypeCode>${xmlEscape(btm.IdentificationTypeCode || "")}</IdentificationTypeCode>
      <ModeCode>${xmlEscape(btm.ModeCode || "")}</ModeCode>
    </BorderTransportMeans>`
      : "";

    // DE 7/9 — ArrivalTransportMeans inside Consignment. Mirrors BTM (R123
    // requires matching identity at both layers).
    const atm = gs.Consignment?.ArrivalTransportMeans || {};
    const arrivalTransportMeansXml = atm.ID
      ? `
        <ArrivalTransportMeans>
          <ID>${xmlEscape(atm.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(atm.IdentificationTypeCode || "")}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(atm.ModeCode || "")}</ModeCode>
        </ArrivalTransportMeans>`
      : "";

    // DE 3/24 / 3/1 — Buyer / Seller. Country code only (no fake names).
    // WCO Address complex type: CountryCode is the relevant child.
    const buyer = gs.Buyer || {};
    const buyerXml = buyer.AddressCountryCode
      ? `
      <Buyer>
        <Address>
          <CountryCode>${xmlEscape(buyer.AddressCountryCode)}</CountryCode>
        </Address>
      </Buyer>`
      : "";
    const seller = gs.Seller || {};
    const sellerXml = seller.AddressCountryCode
      ? `
      <Seller>
        <Address>
          <CountryCode>${xmlEscape(seller.AddressCountryCode)}</CountryCode>
        </Address>
      </Seller>`
      : "";
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
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>${borderTransportMeansXml}
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>${buyerXml}
      <Consignment>
        <ContainerCode>${xmlEscape(gs.Consignment.ContainerCode)}</ContainerCode>${arrivalTransportMeansXml}
        <GoodsLocation>
          <ID>${xmlEscape(gs.Consignment.GoodsLocation.ID)}</ID>
        </GoodsLocation>
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(gs.Destination.CountryCode)}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${xmlEscape(gs.ExportCountry.ID)}</ID>
      </ExportCountry>
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
        <CustomsValuation>
          <MethodCode>${xmlEscape(item?.CustomsValuation?.MethodCode || "1")}</MethodCode>
        </CustomsValuation>
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
      <Importer>
        <ID>${xmlEscape(gs.Importer.ID)}</ID>
      </Importer>${previousDocumentXml}${sellerXml}
      <TradeTerms>
        <ConditionCode>${xmlEscape(gs.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(gs.TradeTerms.LocationID)}</LocationID>
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(d.UCR.TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;

    const xmlPreflight = validateXmlPreflight(xmlPayload, lane.eori || "", {
      requireAdditionalDocument: !omitAdditionalDocuments,
    });
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
      } catch (persistErr: any) {
        console.warn("[VALIDATION] Failed to persist rule results (non-critical):", persistErr?.message || persistErr);
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
      const payloadDebug = buildPayloadDebugSnapshot(payloadInfo);
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
