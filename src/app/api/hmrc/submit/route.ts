import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { mapToCDS_H1, validateCdsCodeLists } from "../../../../lib/wco-mapper";
import { xmlEscape } from "../../../../lib/xml-utils";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { evaluateRules, activeEffects, summarizeFailures, type RuleDefinition, type ScenarioInput } from "../../../../../convex/lib/rule_engine";

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
function validateDeclaration(lane: any, items: any[]) {
  const errors: string[] = [];
  if (!lane?.eori) errors.push("Missing declarant EORI");
  if (!lane?.dispatchCountry) errors.push("Missing dispatch country (DE 5/14)");
  if (!lane?.destinationCountry) errors.push("Missing destination country (DE 5/8)");
  if (!lane?.locationId) errors.push("Missing goods location (DE 5/23)");
  if (!lane?.transportMode) errors.push("Missing transport mode (DE 7/4)");
  if (!lane?.transportId) errors.push("Missing transport identity (DE 7/9)");
  if (!lane?.transportIdType) errors.push("Missing transport identity type (DE 7/7)");
  if (!lane?.invoiceCurrency) errors.push("Missing invoice currency");
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("No goods items");
    return errors;
  }
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
  }
  return errors;
}

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
    // Empty same-tag pairs (<X></X>) almost always cause CDS12070
    // ("forbidden in context") — the schema accepts the element but the
    // business rule rejects an empty body. Reject before submission.
    no_empty_tags: !/<([A-Za-z][\w]*)\s*>\s*<\/\1>/.test(xmlPayload),
    // Placeholder strings that should never reach CDS. The hardcoded code
    // defaults (GBLON004, FOB, etc.) ARE valid CDS values when chosen
    // intentionally — only catch true placeholders here.
    no_placeholders: !/(>\s*N\/A\s*<|>\s*TBD\s*<|>\s*PENDING-|>\s*General goods\s*<)/i.test(xmlPayload),
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
        goodsLocationId: shipment?.Consignment?.GoodsLocation?.Name || shipment?.Consignment?.GoodsLocation?.ID || "",
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

    // Declarant EORI format gate. Previously lived inside validateCdsFields
    // (now deleted). Lifted here because the route uses lane.eori as the
    // X-Submitter-Identifier header — sending a malformed value to HMRC is a
    // guaranteed 400/403 not worth attempting.
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

    // Single-item lock: laptop baseline submission must contain exactly one
    // goods item. Catches phantom/duplicate items before XML build.
    if (items.length !== 1) {
      return NextResponse.json(
        { error: `Single-item lock: expected 1 goods item, got ${items.length}` },
        { status: 400 },
      );
    }

    // Fail-fast on missing required declaration data. Returns the exact gap
    // list so the caller knows what to fill in. No XML built, no HMRC call.
    const baselineErrors = validateDeclaration(lane, items);
    if (baselineErrors.length > 0) {
      return NextResponse.json(
        { error: "Declaration incomplete", missing: baselineErrors },
        { status: 400 },
      );
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
    // Field/scenario validation lives entirely in the rule engine above
    // (evaluateRules at line ~255). validateCdsFields was removed because it
    // ran a parallel set of inferred checks. Adding a new completeness rule
    // = adding a row to rule_definitions, not editing this route.

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

    // Defence in depth: the mapper iterates items exactly once, but if
    // anything upstream ever duplicates the array we want to fail loud
    // rather than emit a phantom <GovernmentAgencyGoodsItem> that CDS will
    // reject under SequenceNumeric=2 pointers.
    const emittedItemCount = Array.isArray(gs.GovernmentAgencyGoodsItem) ? gs.GovernmentAgencyGoodsItem.length : 0;
    if (emittedItemCount !== items.length) {
      return NextResponse.json(
        {
          error: "Goods item count mismatch between source and payload",
          expected: items.length,
          emitted: emittedItemCount,
        },
        { status: 500 },
      );
    }

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

    // Buyer/Seller/Consignee/Consignor are dependent groups. Do not emit
    // partial country-only party records: CDS treats the group as present and
    // then requires the dependent name/address fields.
    const buyerXml = "";
    const sellerXml = "";
    // ExportCountry must NEVER be emitted with an empty <ID> body — that's
    // exactly the CDS12100 22B 090 reject. Omit the element when no real
    // dispatch country has been set (validateCdsFields will already have
    // rejected, but defence in depth).
    const exportCountryXml = gs.ExportCountry?.ID
      ? `\n      <ExportCountry>\n        <ID>${xmlEscape(gs.ExportCountry.ID)}</ID>\n      </ExportCountry>`
      : "";
    // DE 5/26 — Customs Office of Presentation. Conditional per Appendix 21A
    // (only required when goods aren't at the location declared in 5/23).
    // Omit the element entirely when blank rather than emitting an empty body
    // (which trips no_empty_tags preflight + would be CDS12100 anyway).
    const declarationOfficeXml = d.DeclarationOfficeID
      ? `\n    <DeclarationOfficeID>${xmlEscape(d.DeclarationOfficeID)}</DeclarationOfficeID>`
      : "";
    // Same for Destination — wrap conditional, never emit empty.
    const destinationXml = gs.Destination?.CountryCode
      ? `\n      <Destination>\n        <CountryCode>${xmlEscape(gs.Destination.CountryCode)}</CountryCode>\n      </Destination>`
      : "";
    const consigneeXml = "";
    const consignorXml = "";
    // Per HMRC CDS Imports TCM v3.92 (rows 63-70):
    //   DE 3/19-3/21 Representative => <Agent> at Declaration level
    //   Children: <ID> (DE 3/20), <FunctionCode> (DE 3/21, PartyRoleStatusTypes)
    // Element name is NOT <Representative>, child is NOT <RoleCode>.
    // FunctionCode "3" = direct representative per PartyRoleStatusTypes.
    const agentEori = String((lane as Record<string, unknown>).agentEori || "").trim();
    const agentXml = agentEori ? `
    <Agent>
      <ID>${xmlEscape(agentEori)}</ID>
      <FunctionCode>3</FunctionCode>
    </Agent>` : "";
    // Per HMRC CDS Imports TCM v3.92 (rows 90-91):
    //   DE 3/39 Holder of authorisation => Declaration/AuthorisationHolder
    //   Header level (H), NOT item level. C521 = direct representative auth.
    // Schema sequence position established empirically: between
    // TotalPackageQuantity and BorderTransportMeans (matches HMRC sample
    // TT4_2_TC015 ordering).
    const authorisationCategory = String((lane as Record<string, unknown>).authorisationCategory || "").trim();
    const authorisationHolderXml = authorisationCategory ? `
    <AuthorisationHolder>
      <ID>${xmlEscape(String(lane.eori))}</ID>
      <CategoryCode>${xmlEscape(authorisationCategory)}</CategoryCode>
    </AuthorisationHolder>` : "";
    // TradeTerms is optional in the schema. Emit only when both fields are
    // populated — half-filled TradeTerms triggers CDS12070.
    const tradeTermsXml = (gs.TradeTerms?.ConditionCode && gs.TradeTerms?.LocationID)
      ? `
      <TradeTerms>
        <ConditionCode>${xmlEscape(gs.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(gs.TradeTerms.LocationID)}</LocationID>
      </TradeTerms>`
      : "";
    const transactionNatureXml = gs.TransactionNatureCode
      ? `\n      <TransactionNatureCode>${xmlEscape(gs.TransactionNatureCode)}</TransactionNatureCode>`
      : "";
    const goodsLocationAddress = gs.Consignment.GoodsLocation.Address || {};
    const goodsLocationAddressXml = goodsLocationAddress.CountryCode
      ? `
          <Address>
            <CountryCode>${xmlEscape(goodsLocationAddress.CountryCode)}</CountryCode>${
              goodsLocationAddress.Line ? `\n            <Line>${xmlEscape(goodsLocationAddress.Line)}</Line>` : ""
            }${
              goodsLocationAddress.PostcodeID ? `\n            <PostcodeID>${xmlEscape(goodsLocationAddress.PostcodeID)}</PostcodeID>` : ""
            }${
              goodsLocationAddress.TypeCode ? `\n            <TypeCode>${xmlEscape(goodsLocationAddress.TypeCode)}</TypeCode>` : ""
            }
          </Address>`
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
    <GoodsItemQuantity>${xmlEscape(d.GoodsItemQuantity)}</GoodsItemQuantity>${declarationOfficeXml}
    <InvoiceAmount currencyID="${xmlEscape(d.InvoiceAmount.currencyID)}">${xmlEscape(d.InvoiceAmount.value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(d.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>${agentXml}${authorisationHolderXml}${borderTransportMeansXml}
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>${transactionNatureXml}${buyerXml}${consigneeXml}
      <Consignment>
        <ContainerCode>${xmlEscape(gs.Consignment.ContainerCode)}</ContainerCode>${arrivalTransportMeansXml}
        <GoodsLocation>
          <ID>${xmlEscape(gs.Consignment.GoodsLocation.ID || "")}</ID>
          <Name>${xmlEscape(gs.Consignment.GoodsLocation.Name || "")}</Name>
          <TypeCode>${xmlEscape(gs.Consignment.GoodsLocation.TypeCode || "")}</TypeCode>
${goodsLocationAddressXml}
        </GoodsLocation>
      </Consignment>${consignorXml}${destinationXml}${exportCountryXml}
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
        // No fallback shapes — validateCdsFields must have rejected the
        // declaration before we get here. If Classification or Packaging is
        // missing at this point, that's a bug, not a recoverable state.
        const classifications = Array.isArray(item?.Commodity?.Classification) ? item.Commodity.Classification : [];
        const classificationXml = classifications.map((classification: any) => `
          <Classification>
            <ID>${xmlEscape(classification?.ID || "")}</ID>
            <IdentificationTypeCode>${xmlEscape(classification?.IdentificationTypeCode || "")}</IdentificationTypeCode>
          </Classification>`).join("");
        const procedures = Array.isArray(item.GovernmentProcedure) ? item.GovernmentProcedure : [];
        const packaging = item?.Packaging?.[0];
        const originXml = item.Origin?.CountryCode
          ? `\n        <Origin>\n          <CountryCode>${xmlEscape(item.Origin.CountryCode)}</CountryCode>\n          <TypeCode>${xmlEscape(item.Origin.TypeCode || "1")}</TypeCode>\n        </Origin>`
          : "";
        const packagingXml = packaging
          ? `
        <Packaging>
          <SequenceNumeric>${xmlEscape(packaging.SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(packaging.MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(packaging.QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(packaging.TypeCode)}</TypeCode>
        </Packaging>`
          : "";
        // GoodsMeasure only emitted when grossMass is a real positive number.
        // NetNet only added when net is a real positive number. Empty values
        // would otherwise produce `<GrossMassMeasure unitCode="KGM"></...>`
        // which is exactly the no_empty_tags pattern we forbid.
        const grossMass = parseFloat(String(item?.Commodity?.GoodsMeasure?.GrossMassMeasure || ""));
        const netMass = parseFloat(String(item?.Commodity?.GoodsMeasure?.NetNetWeightMeasure || ""));
        const goodsMeasureXml = (Number.isFinite(grossMass) && grossMass > 0)
          ? `
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(grossMass.toFixed(3))}</GrossMassMeasure>${
              Number.isFinite(netMass) && netMass > 0
                ? `\n            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(netMass.toFixed(3))}</NetNetWeightMeasure>`
                : ""
            }
          </GoodsMeasure>`
          : "";
        const dutyTaxFeeXml = item?.Commodity?.DutyTaxFee?.DutyRegimeCode
          ? `
          <DutyTaxFee>
            <DutyRegimeCode>${xmlEscape(item.Commodity.DutyTaxFee.DutyRegimeCode)}</DutyRegimeCode>
          </DutyTaxFee>`
          : "";
        const invoiceLineAmount = item?.Commodity?.InvoiceLine?.ItemChargeAmount;
        const invoiceLineXml = invoiceLineAmount?.value
          ? `
          <InvoiceLine>
            <ItemChargeAmount currencyID="${xmlEscape(invoiceLineAmount.currencyID || "")}">${xmlEscape(invoiceLineAmount.value)}</ItemChargeAmount>
          </InvoiceLine>`
          : "";
        const itemDestinationXml = "";
        const procedureXml = procedures.map((procedure: any) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(procedure.CurrentCode)}</CurrentCode>${
            procedure.PreviousCode
              ? `\n          <PreviousCode>${xmlEscape(procedure.PreviousCode)}</PreviousCode>`
              : ""
          }
        </GovernmentProcedure>`).join("");
        return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(item.StatisticalValueAmount.currencyID)}">${xmlEscape(item.StatisticalValueAmount.value)}</StatisticalValueAmount>
        ${additionalDocumentsXml}
        <Commodity>
          <Description>${xmlEscape(item?.Commodity?.Description || "")}</Description>
          ${classificationXml}${dutyTaxFeeXml}${goodsMeasureXml}${invoiceLineXml}
        </Commodity>
        <CustomsValuation>
          <MethodCode>${xmlEscape(item?.CustomsValuation?.MethodCode || "")}</MethodCode>
        </CustomsValuation>${itemDestinationXml}${procedureXml}${originXml}${packagingXml}
      </GovernmentAgencyGoodsItem>`;
      }).join('')}
      <Importer>
        <ID>${xmlEscape(gs.Importer.ID)}</ID>
      </Importer>${previousDocumentXml}${sellerXml}${tradeTermsXml}
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

    console.log("[HMRC SUBMIT] FINAL XML:\n" + xmlPayload);

    const hmrcResponse = await fetchHmrc(hmrcEndpoint, {
      method: "POST",
      headers: hmrcHeaders,
      body: xmlPayload,
    }, request, token, lane.eori);

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
