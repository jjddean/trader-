const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mapToCDS_H1(declaration, items) {
  const totalGrossWeight = items.reduce((acc, item) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
  const invoiceTotal = items.reduce((acc, item) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;
  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: "IMA",
      FunctionalReferenceID: declaration.lrn || `FC-${declaration._id || "manual"}`,
      GoodsItemQuantity: items.length || 1,
      DeclarationOfficeID: declaration.presentationOffice || "GB000051",
      TotalGrossMassMeasure: declaration.totalGrossWeight || totalGrossWeight,
      TotalPackageQuantity: items.reduce((acc, item) => acc + (parseInt(item.packageCount) || 1), 0),
      InvoiceAmount: {
        currencyID: declaration.invoiceCurrency || "GBP",
        value: declaration.invoiceTotal || invoiceTotal,
      },
      CurrencyExchange: {
        CurrencyTypeCode: declaration.invoiceCurrency || "GBP",
      },
      Declarant: { ID: declaration.eori || "" },
      Exporter: { ID: declaration.exporterEori || "GB123456789000" },
      UCR: {
        TraderAssignedReferenceID:
          declaration.ducr || `9GB${declaration.eori || "123456789000"}-${String(declaration._id || "manual").substring(0, 6).toUpperCase()}`,
      },
      GoodsShipment: {
        Consignment: {
          ContainerCode: "0",
          BorderTransportMeans: {
            IdentificationTypeCode: "11",
            ID: declaration.transportId || "CSCL GLOBE",
            ModeCode: declaration.transportMode || "1",
          },
          GoodsLocation: {
            Name: declaration.locationName || "GBWLAFXTFXTGW",
            ID: declaration.locationId || "GBAUFXTFXTGW",
          },
        },
        Destination: { CountryCode: declaration.destinationCountry || "GB" },
        ExportCountry: { ID: declaration.dispatchCountry || "US" },
        Importer: { ID: declaration.importerEori || declaration.eori || "" },
        TradeTerms: {
          ConditionCode: declaration.incoterms || "FOB",
          LocationID: declaration.incotermLocation || "GBFXT",
        },
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => ({
          SequenceNumeric: item.sequenceNumber || index + 1,
          AdditionalDocument: [{ CategoryCode: "Y", ID: "922", TypeCode: "922" }],
          StatisticalValueAmount: {
            currencyID: item.valueCurrency || "GBP",
            value: item.valueAmount || 0,
          },
          Commodity: {
            Description: item.description || "",
            Classification: [{ ID: item.commodityCode || item.hsCode || "", IdentificationTypeCode: "TSP" }],
            GoodsMeasure: {
              GrossMassMeasure: item.grossWeightKg || 10,
              NetNetWeightMeasure: item.netWeightKg || 9,
            },
          },
          Packaging: [
            {
              SequenceNumeric: "1",
              MarksNumbersID: item.shippingMarks || "N/A",
              QuantityQuantity: item.packageCount || "1",
              TypeCode: item.packageType || "PK",
            },
          ],
          GovernmentProcedure: [
            {
              CurrentCode: (item.procedureCode?.replace(/\s+/g, "") || "4000000").substring(0, 4),
              PreviousCode: (item.procedureCode?.replace(/\s+/g, "") || "4000000").substring(4, 7) || "000",
            },
          ],
        })),
      },
    },
  };
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildXml(payloadInfo) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${xmlEscape(payloadInfo.Declaration.FunctionCode)}</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(payloadInfo.Declaration.FunctionalReferenceID)}</FunctionalReferenceID>
    <TypeCode>${xmlEscape(payloadInfo.Declaration.TypeCode)}</TypeCode>
    <GoodsItemQuantity>${xmlEscape(payloadInfo.Declaration.GoodsItemQuantity)}</GoodsItemQuantity>
    <DeclarationOfficeID>${xmlEscape(payloadInfo.Declaration.DeclarationOfficeID)}</DeclarationOfficeID>
    <InvoiceAmount currencyID="${xmlEscape(payloadInfo.Declaration.InvoiceAmount.currencyID)}">${xmlEscape(payloadInfo.Declaration.InvoiceAmount.value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(payloadInfo.Declaration.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(payloadInfo.Declaration.TotalPackageQuantity)}</TotalPackageQuantity>
    <CurrencyExchange>
      <CurrencyTypeCode>${xmlEscape(payloadInfo.Declaration.CurrencyExchange.CurrencyTypeCode)}</CurrencyTypeCode>
    </CurrencyExchange>
    <Declarant>
      <ID>${xmlEscape(payloadInfo.Declaration.Declarant.ID)}</ID>
    </Declarant>
    <Exporter>
      <ID>${xmlEscape(payloadInfo.Declaration.Exporter.ID)}</ID>
    </Exporter>
    <GoodsShipment>
      <Consignment>
        <ContainerCode>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Consignment.ContainerCode)}</ContainerCode>
        <ArrivalTransportMeans>
          <ID>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Consignment.BorderTransportMeans.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Consignment.BorderTransportMeans.IdentificationTypeCode)}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Consignment.BorderTransportMeans.ModeCode)}</ModeCode>
        </ArrivalTransportMeans>
        <GoodsLocation>
          <Name>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Consignment.GoodsLocation.Name)}</Name>
          <ID>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Consignment.GoodsLocation.ID)}</ID>
        </GoodsLocation>
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Destination.CountryCode)}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${xmlEscape(payloadInfo.Declaration.GoodsShipment.ExportCountry.ID)}</ID>
      </ExportCountry>
      ${(payloadInfo.Declaration.GoodsShipment.GovernmentAgencyGoodsItem || [])
        .map(
          (item) => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(item.StatisticalValueAmount.currencyID)}">${xmlEscape(item.StatisticalValueAmount.value)}</StatisticalValueAmount>
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(item.AdditionalDocument[0].CategoryCode)}</CategoryCode>
          <ID>${xmlEscape(item.AdditionalDocument[0].ID)}</ID>
          <TypeCode>${xmlEscape(item.AdditionalDocument[0].TypeCode)}</TypeCode>
        </AdditionalDocument>
        <Commodity>
          <Description>${xmlEscape(item.Commodity.Description || "")}</Description>
          <Classification>
            <ID>${xmlEscape(item.Commodity.Classification[0].ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(item.Commodity.Classification[0].IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.GrossMassMeasure)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.NetNetWeightMeasure)}</NetNetWeightMeasure>
          </GoodsMeasure>
        </Commodity>
        ${(item.GovernmentProcedure || [])
          .map(
            (proc) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(proc.CurrentCode)}</CurrentCode>
          ${proc.PreviousCode ? `<PreviousCode>${xmlEscape(proc.PreviousCode)}</PreviousCode>` : ""}
        </GovernmentProcedure>`,
          )
          .join("")}
        <Packaging>
          <SequenceNumeric>${xmlEscape(item.Packaging[0].SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(item.Packaging[0].MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(item.Packaging[0].QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(item.Packaging[0].TypeCode)}</TypeCode>
        </Packaging>
      </GovernmentAgencyGoodsItem>`,
        )
        .join("")}
      <Importer>
        <ID>${xmlEscape(payloadInfo.Declaration.GoodsShipment.Importer.ID)}</ID>
      </Importer>
      <TradeTerms>
        <ConditionCode>${xmlEscape(payloadInfo.Declaration.GoodsShipment.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(payloadInfo.Declaration.GoodsShipment.TradeTerms.LocationID)}</LocationID>
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(payloadInfo.Declaration.UCR.TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}

async function getToken(client, userId) {
  if (process.env.HMRC_CDS_BEARER_TOKEN) {
    return process.env.HMRC_CDS_BEARER_TOKEN;
  }
  const token = await client.query(api.hmrc.getToken, { userId });
  if (!token || !token.accessToken) throw new Error(`No HMRC token found for user ${userId}`);

  if (token.expiresAt && Date.now() + 300000 > token.expiresAt && token.refreshToken) {
    const refreshBody = new URLSearchParams({
      client_secret: process.env.HMRC_CLIENT_SECRET,
      client_id: process.env.HMRC_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });
    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk"
      : "https://api.service.hmrc.gov.uk";
    const refreshResponse = await fetch(`${hmrcBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: refreshBody.toString(),
    });
    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      await client.mutation(api.hmrc.saveToken, {
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || token.refreshToken,
        expiresIn: data.expires_in || 14400,
        eori: token.eori,
      });
      return data.access_token;
    }
  }
  return token.accessToken;
}

async function submitXml(xmlPayload, scenario, token) {
  const endpoint =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk/customs/declarations"
      : "https://api.service.hmrc.gov.uk/customs/declarations";
  const now = new Date().toISOString();
  const acceptHeader = process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml";
  const contentTypeHeader = process.env.HMRC_CONTENT_TYPE_HEADER || "application/xml; charset=UTF-8";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: acceptHeader,
      "Content-Type": contentTypeHeader,
      Authorization: `Bearer ${token}`,
      "X-Client-ID": process.env.HMRC_CLIENT_ID,
      "Gov-Test-Scenario": scenario,
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-Public-IP": "62.31.164.236",
      "Gov-Client-Public-Port": "443",
      "Gov-Client-Device-ID": "be360090-eb60-4927-a94f-cc8102d1359c",
      "Gov-Client-User-ID": "test-trader-jason",
      "Gov-Client-Timezone": "UTC+00:00",
      "Gov-Client-Local-IPs": "192.168.1.15",
      "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=1&colour-depth=24",
      "Gov-Client-Window-Size": "width=1920&height=1080",
      "Gov-Client-Browser-JS-User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Gov-Client-Browser-Do-Not-Track": "false",
      "Gov-Vendor-Version": "TradeDNA=1.0.0",
      "Gov-Vendor-Instance-ID": "i-0a2b3c4d5e6f7g8h9",
      "Gov-Vendor-Product-Name": "TradeDNA"
    },
    body: xmlPayload,
  });
  const body = await response.text();
  return {
    timestamp: now,
    status: response.status,
    conversationId: response.headers.get("X-Conversation-ID") || "",
    body,
    requestHeaders: {
      Accept: acceptHeader,
      "Content-Type": contentTypeHeader,
      Authorization: "Bearer [REDACTED]",
      "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
      "Gov-Test-Scenario": scenario,
    },
  };
}

async function submitWithRetry(xmlPayload, scenario, token) {
  const attempts = [];
  let response = await submitXml(xmlPayload, scenario, token);
  attempts.push(response);
  if (response.status === 429) {
    await sleep(2000);
    response = await submitXml(xmlPayload, scenario, token);
    attempts.push(response);
    if (response.status === 429) {
      await sleep(5000);
      response = await submitXml(xmlPayload, scenario, token);
      attempts.push(response);
    }
  }
  return { final: response, attempts };
}

function withMetaComment(meta, xml) {
  return `<!-- timestamp: ${meta.timestamp} | http_status: ${meta.status} | conversation_id: ${meta.conversationId || "N/A"} -->\n${xml}`;
}

async function run() {
  const evidenceDir = path.join(process.cwd(), "test-evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const decls = await client.query(api.declarations.getAllDecls, {});
  const baseDecl = decls.find((d) => d.userId) || decls[0];
  if (!baseDecl) throw new Error("No declaration found");
  const userId = baseDecl.userId;
  const token = await getToken(client, userId);
  const itemSeed = {
    sequenceNumber: 1,
    commodityCode: "6110201000",
    description: "Men knitted cotton jumper",
    originCountry: "DZ",
    procedureCode: "4000",
    valueAmount: 4200,
    valueCurrency: "GBP",
    grossWeightKg: 120,
    netWeightKg: 118,
    packageCount: 8,
    packageType: "PK",
  };

  const scenarioInputs = [
    {
      key: "scenario-1-happy-path",
      scenario: "HAPPY_PATH",
      declaration: { ...baseDecl, declarationType: "H1", eori: "GB553202734852" },
      item: { ...itemSeed, commodityCode: "6110201000" },
    },
    {
      key: "scenario-2-rejection",
      scenario: "REJECTION",
      declaration: { ...baseDecl, declarationType: "H1", eori: "GB553202734852" },
      item: { ...itemSeed, commodityCode: "9999999999" },
    },
    {
      key: "scenario-3-route-to-examine",
      scenario: "ROUTE_TO_EXAMINE",
      declaration: { ...baseDecl, declarationType: "H1", eori: "GB553202734852" },
      item: { ...itemSeed, commodityCode: "6110201000" },
    },
    {
      key: "scenario-4-invalid-declaration",
      scenario: "INVALID_DECLARATION",
      declaration: { ...baseDecl, declarationType: "H1", eori: "" },
      item: { ...itemSeed, commodityCode: "6110201000" },
    },
  ];

  const summary = [];
  const onlyScenario = process.env.ONLY_SCENARIO;
  const runSingleHappyPath = onlyScenario === "HAPPY_PATH";

  for (const input of scenarioInputs) {
    if (runSingleHappyPath && input.scenario !== "HAPPY_PATH") continue;
    const payloadInfo = mapToCDS_H1(input.declaration, [{ ...input.item }]);
    payloadInfo.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Commodity.Description = input.item.description;
    const xmlPayload = buildXml(payloadInfo);
    const response = await submitXml(xmlPayload, input.scenario, token);

    const singleRunRequestFile = process.env.SINGLE_RUN_REQUEST_FILE || "scenario-1-retry-request.xml";
    const singleRunResponseFile = process.env.SINGLE_RUN_RESPONSE_FILE || "scenario-1-retry-response.xml";
    const requestFileName = runSingleHappyPath && input.scenario === "HAPPY_PATH" ? singleRunRequestFile : `${input.key}-request.xml`;
    const responseFileName = runSingleHappyPath && input.scenario === "HAPPY_PATH" ? singleRunResponseFile : `${input.key}-response.xml`;
    const requestWithHeaderMeta = `<!-- request_accept: ${response.requestHeaders.Accept} | request_content_type: ${response.requestHeaders["Content-Type"]} | request_authorization: ${response.requestHeaders.Authorization} | request_x_client_id: ${response.requestHeaders["X-Client-ID"]} | request_gov_test_scenario: ${response.requestHeaders["Gov-Test-Scenario"]} -->\n${xmlPayload}`;
    fs.writeFileSync(path.join(evidenceDir, requestFileName), withMetaComment({
      timestamp: new Date().toISOString(),
      status: 0,
      conversationId: input.scenario,
    }, requestWithHeaderMeta));
    const responseWithHeaderMeta = `<!-- request_accept: ${response.requestHeaders.Accept} | request_content_type: ${response.requestHeaders["Content-Type"]} | request_authorization: ${response.requestHeaders.Authorization} | request_x_client_id: ${response.requestHeaders["X-Client-ID"]} | request_gov_test_scenario: ${response.requestHeaders["Gov-Test-Scenario"]} -->\n${response.body || "<empty/>"}`;
    fs.writeFileSync(path.join(evidenceDir, responseFileName), withMetaComment(response, responseWithHeaderMeta));

    summary.push({
      scenario: input.key,
      header: input.scenario,
      status: response.status,
      conversationId: response.conversationId,
      timestamp: response.timestamp,
    });
  }

  if (runSingleHappyPath) {
    fs.writeFileSync(path.join(evidenceDir, "scenario-summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const ratePayloadInfo = mapToCDS_H1(
    { ...baseDecl, declarationType: "H1", eori: "GB853432453900" },
    [{ ...itemSeed, commodityCode: "6110201000" }],
  );
  ratePayloadInfo.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Commodity.Description = itemSeed.description;
  const rateXml = buildXml(ratePayloadInfo);
  fs.writeFileSync(path.join(evidenceDir, "scenario-5-rate-limit-request.xml"), withMetaComment({
    timestamp: new Date().toISOString(),
    status: 0,
    conversationId: "RATE_LIMIT",
  }, rateXml));

  const rapidResults = await Promise.all(
    new Array(5).fill(0).map(() => submitXml(rateXml, "RATE_LIMIT", token)),
  );
  const retryResult = await submitWithRetry(rateXml, "RATE_LIMIT", token);
  const rateResponseXml = `<RateLimitResults>
${rapidResults
  .map(
    (res, idx) => `  <RapidRequest index="${idx + 1}">
    <Timestamp>${xmlEscape(res.timestamp)}</Timestamp>
    <HttpStatus>${res.status}</HttpStatus>
    <ConversationId>${xmlEscape(res.conversationId || "N/A")}</ConversationId>
    <Body><![CDATA[${res.body || ""}]]></Body>
  </RapidRequest>`,
  )
  .join("\n")}
  <RetryFlow>
${retryResult.attempts
  .map(
    (res, idx) => `    <Attempt index="${idx + 1}">
      <Timestamp>${xmlEscape(res.timestamp)}</Timestamp>
      <HttpStatus>${res.status}</HttpStatus>
      <ConversationId>${xmlEscape(res.conversationId || "N/A")}</ConversationId>
      <Body><![CDATA[${res.body || ""}]]></Body>
    </Attempt>`,
  )
  .join("\n")}
  </RetryFlow>
</RateLimitResults>`;
  fs.writeFileSync(path.join(evidenceDir, "scenario-5-rate-limit-response.xml"), rateResponseXml);

  summary.push({
    scenario: "scenario-5-rate-limit",
    header: "RATE_LIMIT",
    rapidStatuses: rapidResults.map((x) => x.status),
    retryStatuses: retryResult.attempts.map((x) => x.status),
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(path.join(evidenceDir, "scenario-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
