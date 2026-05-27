/**
 * Trade Test Scenario Runner — Freightcode
 *
 * Active lane (2026-05-26):
 *   Lane: HS 8471300000 / CPC 4000 000 / Origin DE / Type IMA
 *   EORI: GB243617410764
 *   Description: Portable automatic data processing machine, weight ≤ 10kg (laptops)
 *   Documents: N935 (Commercial invoice), N271 (Packing list)
 *   Source: UK Trade Tariff / declaration form fields
 *
 * Usage:
 *   node test-evidence/run-hmrc-scenarios.js           # dry-run only
 *   DRY_RUN_ONLY=false HMRC_SUBMIT_ONCE=true node ...  # live Trade Test submit gate required first
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const HMRC_CONFIG = {
  sandboxBaseUrl: process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk",
  productionBaseUrl: process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk",
  accept: {
    declarations: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
    v2Xml: process.env.HMRC_ACCEPT_V2_XML || "application/vnd.hmrc.2.0+xml",
  },
  vendor: {
    publicIp: process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6",
    productName: process.env.HMRC_VENDOR_PRODUCT_NAME || "Freightcode",
    version: process.env.HMRC_VENDOR_VERSION || "1.0.0",
  },
  timing: {
    tokenExpiryBufferMs: Number(process.env.HMRC_TOKEN_EXPIRY_BUFFER_MS) || 300000,
    defaultTokenExpiryMs: Number(process.env.HMRC_DEFAULT_TOKEN_EXPIRY_MS) || 14400,
  },
};

// ---------------------------------------------------------------------------
// Signed document matrix — HS 8471300000 / CPC 4000 000 / Origin DE (laptops)
// Source: UK Trade Tariff / declaration form DE 2/3 entries
// N935: Commercial invoice — mandatory for all standard imports (Method 1 valuation)
// N271: Packing list — required supporting document for CDS H1
// ---------------------------------------------------------------------------
const SIGNED_ADDITIONAL_DOCUMENTS = [
  { CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "INV-2026-LAPTOPS-001" },
  { CategoryCode: "N", TypeCode: "271", StatusCode: "AC", ID: "PL-2026-LAPTOPS-001" },
];

function mapToCDS_H1(declaration, items) {
  const totalGrossWeight =
    items.reduce((acc, item) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
  const invoiceTotal =
    items.reduce((acc, item) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;

  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: "IMA",
      FunctionalReferenceID: declaration.lrn || `FC-${declaration._id || "manual"}`,
      GoodsItemQuantity: items.length || 1,
      DeclarationOfficeID: declaration.presentationOffice || "",
      TotalGrossMassMeasure: declaration.totalGrossWeight || totalGrossWeight,
      TotalPackageQuantity: items.reduce(
        (acc, item) => acc + (parseInt(item.packageCount) || 1),
        0,
      ),
      InvoiceAmount: {
        currencyID: declaration.invoiceCurrency || "GBP",
        value: declaration.invoiceTotal || invoiceTotal,
      },
      CurrencyExchange: {
        CurrencyTypeCode: declaration.invoiceCurrency || "GBP",
      },
      Declarant: { ID: declaration.eori || "" },
      // DE 3/1 Exporter: GB/XI EORI only for intra-UK flows. For overseas imports use Name+Address.
      // CDS12073/57A fires when ExportCountry.ID references a foreign country with no Exporter anchor.
      Exporter: (() => {
        const dispatch = String(declaration.dispatchCountry || "").trim().toUpperCase();
        const eori = String(declaration.exporterEori || "").trim();
        if (/^(GB|XI)\d{12}$/i.test(eori) && (dispatch === "GB" || dispatch === "XI")) return { ID: eori };
        if (dispatch && dispatch !== "GB" && dispatch !== "XI") {
          return {
            Name: String(declaration.exporterName || "").trim() || "German Exporter GmbH",
            Address: {
              CityName: String(declaration.exporterCity || "").trim() || "Hamburg",
              CountryCode: dispatch,
              Line: String(declaration.exporterLine || "").trim() || "1 Exportstrasse",
              PostcodeID: String(declaration.exporterPostcode || "").trim() || "20095",
            },
          };
        }
        return null;
      })(),
      UCR: {
        TraderAssignedReferenceID:
          declaration.ducr ||
          `${new Date().getFullYear() % 10}GB${(declaration.eori || "GB449181054677").replace(/^GB/i, "")}-${String(declaration._id || "manual")
            .substring(0, 6)
            .toUpperCase()}`,
      },
      GoodsShipment: {
        Consignment: {
          ContainerCode: "0",
          BorderTransportMeans: {
            IdentificationTypeCode: "11",
            ID: declaration.transportId || "CSCL GLOBE",
            ModeCode: declaration.transportMode || "1",
          },
          GoodsLocation: (() => {
            const id = String(declaration.locationId || "").trim().toUpperCase() || "GBAUFXTFXTGW";
            const nameById = { GBAUFXTFXTGW: "GBWLAFXTFXTGW" };
            if ((declaration.goodsLocationKind === "port" || declaration.goodsLocationKind === "port_unlocode") && nameById[id]) {
              return { Name: nameById[id], ID: id };
            }
            return { Name: id, ID: id };
          })(),
        },
        Destination: { CountryCode: declaration.destinationCountry || "GB" },
        ExportCountry: { ID: declaration.dispatchCountry || "BR" },
        Importer: { ID: declaration.importerEori || declaration.eori || "" },
        TradeTerms: {
          // LocationID omitted — CDS10020/22B/L002 fires when plain text is sent.
          ConditionCode: declaration.incoterms || "CIF",
        },
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => {
          // Use item's own additionalDocuments if provided, otherwise use the signed matrix
          const docs =
            Array.isArray(item.additionalDocuments) && item.additionalDocuments.length > 0
              ? item.additionalDocuments
              : SIGNED_ADDITIONAL_DOCUMENTS;

          return {
            SequenceNumeric: item.sequenceNumber || index + 1,
            AdditionalDocument: docs,
            StatisticalValueAmount: {
              currencyID: item.valueCurrency || "GBP",
              value: item.valueAmount || 0,
            },
            Commodity: {
              Description: item.description || "",
              Classification: [
                {
                  ID: item.commodityCode || item.hsCode || "",
                  IdentificationTypeCode: "TSP",
                },
              ],
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
            // DE 1/10 = two separate 2-digit codes (always present).
            // DE 1/11 = required explicitly. "000" = nil additional procedure for CPC 4000.
            // Omitting DE 1/11 entirely triggers CDS11004 (incomplete procedure declaration).
            GovernmentProcedure: [
              {
                CurrentCode: (item.procedureCode?.replace(/\s+/g, "") || "4000").substring(0, 2),
                PreviousCode: (item.procedureCode?.replace(/\s+/g, "") || "4000").substring(2, 4) || "00",
              },
              {
                CurrentCode: item.additionalProcedureCode || "000",
              },
            ],
          };
        }),
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
  const d = payloadInfo.Declaration;
  const gs = d.GoodsShipment;

  return `<?xml version="1.0" encoding="UTF-8"?>
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
    <CurrencyExchange>
      <CurrencyTypeCode>${xmlEscape(d.CurrencyExchange.CurrencyTypeCode)}</CurrencyTypeCode>
    </CurrencyExchange>
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>
    ${d.Exporter ? (d.Exporter.ID
      ? `\n    <Exporter>\n      <ID>${xmlEscape(d.Exporter.ID)}</ID>\n    </Exporter>`
      : `\n    <Exporter>\n      <Name>${xmlEscape(d.Exporter.Name || "Exporter")}</Name>\n      <Address>\n        <CityName>${xmlEscape(d.Exporter.Address?.CityName || "")}</CityName>\n        <CountryCode>${xmlEscape(d.Exporter.Address?.CountryCode || "")}</CountryCode>\n        <Line>${xmlEscape(d.Exporter.Address?.Line || "")}</Line>\n        <PostcodeID>${xmlEscape(d.Exporter.Address?.PostcodeID || "")}</PostcodeID>\n      </Address>\n    </Exporter>`) : ""}
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
          ${gs.Consignment.GoodsLocation.ID ? `<ID>${xmlEscape(gs.Consignment.GoodsLocation.ID)}</ID>` : ""}
          ${gs.Consignment.GoodsLocation.TypeCode ? `<TypeCode>${xmlEscape(gs.Consignment.GoodsLocation.TypeCode)}</TypeCode>` : ""}
          ${gs.Consignment.GoodsLocation.Address ? `<Address>${gs.Consignment.GoodsLocation.Address.TypeCode ? `<TypeCode>${xmlEscape(gs.Consignment.GoodsLocation.Address.TypeCode)}</TypeCode>` : ""}${gs.Consignment.GoodsLocation.Address.CountryCode ? `<CountryCode>${xmlEscape(gs.Consignment.GoodsLocation.Address.CountryCode)}</CountryCode>` : ""}</Address>` : ""}
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
      </TradeTerms>
      ${(gs.GovernmentAgencyGoodsItem || [])
        .map((item) => {
          const docs = Array.isArray(item.AdditionalDocument) ? item.AdditionalDocument : [];
          const additionalDocsXml = docs
            .map(
              (doc) => `
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(doc.CategoryCode || "")}</CategoryCode>
          <ID>${xmlEscape(doc.ID || "")}</ID>
          <TypeCode>${xmlEscape(doc.TypeCode || "")}</TypeCode>
          ${doc.StatusCode ? `<LPCOExemptionCode>${xmlEscape(doc.StatusCode)}</LPCOExemptionCode>` : ""}
        </AdditionalDocument>`,
            )
            .join("");

          const procedures = Array.isArray(item.GovernmentProcedure)
            ? item.GovernmentProcedure
            : [];
          const proceduresXml = procedures
            .map(
              (proc) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(proc.CurrentCode)}</CurrentCode>
          ${proc.PreviousCode ? `<PreviousCode>${xmlEscape(proc.PreviousCode)}</PreviousCode>` : ""}
        </GovernmentProcedure>`,
            )
            .join("");

          const pkg = Array.isArray(item.Packaging) && item.Packaging[0]
            ? item.Packaging[0]
            : { SequenceNumeric: "1", MarksNumbersID: "N/A", QuantityQuantity: "1", TypeCode: "PK" };

          return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(item.StatisticalValueAmount.currencyID)}">${xmlEscape(item.StatisticalValueAmount.value)}</StatisticalValueAmount>
        ${additionalDocsXml}
          <Commodity>
          <Description>${xmlEscape(item.Commodity.Description || "")}</Description>
          ${(Array.isArray(item.Commodity.Classification) ? item.Commodity.Classification : [item.Commodity.Classification]).map(cls => `<Classification>
            <ID>${xmlEscape(cls.ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(cls.IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>`).join("\n          ")}
          <DutyTaxFee>
            <DutyRegimeCode>${xmlEscape(item.Commodity.DutyTaxFee?.DutyRegimeCode || "100")}</DutyRegimeCode>
            <TypeCode>A00</TypeCode>
          </DutyTaxFee>
          <DutyTaxFee>
            <TypeCode>B00</TypeCode>
          </DutyTaxFee>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.GrossMassMeasure)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.NetNetWeightMeasure)}</NetNetWeightMeasure>
          </GoodsMeasure>
          <InvoiceLine>
            <ItemChargeAmount currencyID="${xmlEscape(item.Commodity.InvoiceLine?.ItemChargeAmount?.currencyID || item.StatisticalValueAmount.currencyID || "GBP")}">${xmlEscape(item.Commodity.InvoiceLine?.ItemChargeAmount?.value || item.StatisticalValueAmount.value)}</ItemChargeAmount>
          </InvoiceLine>
        </Commodity>
        <CustomsValuation>
          <MethodCode>${xmlEscape(item.CustomsValuation?.MethodCode || "1")}</MethodCode>
        </CustomsValuation>
        ${proceduresXml}
        ${item.Origin ? `<Origin>\n          <CountryCode>${xmlEscape(item.Origin.CountryCode)}</CountryCode>\n          <TypeCode>${xmlEscape(item.Origin.TypeCode || "1")}</TypeCode>\n        </Origin>` : ""}
        <Packaging>
          <SequenceNumeric>${xmlEscape(pkg.SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(pkg.MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(pkg.QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(pkg.TypeCode)}</TypeCode>
        </Packaging>
        <ValuationAdjustment>
          <AdditionCode>0000</AdditionCode>
        </ValuationAdjustment>
      </GovernmentAgencyGoodsItem>`;
        })
        .join("")}
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}

async function getToken(client, userId) {
  const tokenRecord = await client.query(api.hmrc.getToken, { userId });
  if (!tokenRecord?.accessToken) {
    throw new Error(`No HMRC token found in Convex for user ${userId}`);
  }

  if (tokenRecord.expiresAt && Date.now() + HMRC_CONFIG.timing.tokenExpiryBufferMs > tokenRecord.expiresAt) {
    if (!tokenRecord.refreshToken) {
      throw new Error("HMRC token expiring and no refresh token available in Convex");
    }
    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? HMRC_CONFIG.sandboxBaseUrl
        : HMRC_CONFIG.productionBaseUrl;
    const refreshResponse = await fetch(`${hmrcBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_secret: process.env.HMRC_CLIENT_SECRET,
        client_id: process.env.HMRC_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: tokenRecord.refreshToken,
      }).toString(),
    });
    if (!refreshResponse.ok) {
      throw new Error(`Failed to refresh HMRC token: ${await refreshResponse.text()}`);
    }
    const data = await refreshResponse.json();
    await client.mutation(api.hmrc.saveToken, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenRecord.refreshToken,
      expiresIn: data.expires_in || HMRC_CONFIG.timing.defaultTokenExpiryMs,
      eori: tokenRecord.eori,
    });
    return data.access_token;
  }

  return tokenRecord.accessToken;
}

async function submitXml(xmlPayload, token) {
  const endpoint =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? `${HMRC_CONFIG.sandboxBaseUrl}/customs/declarations`
      : `${HMRC_CONFIG.productionBaseUrl}/customs/declarations`;
  const now = new Date().toISOString();
  const acceptHeader = HMRC_CONFIG.accept.declarations;
  const contentTypeHeader =
    process.env.HMRC_CONTENT_TYPE_HEADER || "application/xml; charset=UTF-8";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: acceptHeader,
      "Content-Type": contentTypeHeader,
      Authorization: `Bearer ${token}`,
      "X-Client-ID": process.env.HMRC_CLIENT_ID,
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-Public-IP": "62.31.164.236",
      "Gov-Client-Public-Port": "443",
      "Gov-Client-Device-ID": "be360090-eb60-4927-a94f-cc8102d1359c",
      "Gov-Client-User-IDs": "appUser=test-trader-jason",
      "Gov-Client-Timezone": "UTC+00:00",
      // Gov-Client-Local-IPs omitted — not required for WEB_APP_VIA_SERVER; private IPs trip HMRC WAF
      "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=1&colour-depth=24",
      "Gov-Client-Window-Size": "width=1920&height=1080",
      "Gov-Client-Browser-JS-User-Agent":
        "Mozilla%2F5.0+(Windows+NT+10.0%3B+Win64%3B+x64)+AppleWebKit%2F537.36",
      "Gov-Client-Browser-Do-Not-Track": "false",
      "Gov-Client-Multi-Factor": "type=OTHER&timestamp=2024-01-01T00%3A00%3A00Z&unique-reference=session-test",
      "Gov-Vendor-Version": `${HMRC_CONFIG.vendor.productName}=${HMRC_CONFIG.vendor.version}`,
      "Gov-Vendor-Product-Name": HMRC_CONFIG.vendor.productName,
      "Gov-Vendor-Public-IP": HMRC_CONFIG.vendor.publicIp,
      "Gov-Vendor-Forwarded": `by=${HMRC_CONFIG.vendor.publicIp}&for=62.31.164.236`,
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
    },
  };
}

function withMetaComment(meta, xml) {
  return `<!-- timestamp: ${meta.timestamp} | http_status: ${meta.status} | conversation_id: ${
    meta.conversationId || "N/A"
  } -->\n${xml}`;
}

function preflightGates(xmlPayload, eori) {
  const acceptHeader = HMRC_CONFIG.accept.declarations;
  const contentTypeHeader =
    process.env.HMRC_CONTENT_TYPE_HEADER || "application/xml; charset=UTF-8";
  const endpoint =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? `${HMRC_CONFIG.sandboxBaseUrl}/customs/declarations`
      : `${HMRC_CONFIG.productionBaseUrl}/customs/declarations`;

  const checks = {
    token_present: false, // set after token fetch
    client_id_present: Boolean(process.env.HMRC_CLIENT_ID),
    environment_is_sandbox: process.env.HMRC_ENVIRONMENT === "sandbox",
    endpoint_is_test_api: endpoint.startsWith(HMRC_CONFIG.sandboxBaseUrl),
    accept_is_v2: acceptHeader === HMRC_CONFIG.accept.v2Xml,
    content_type_is_xml: contentTypeHeader.toLowerCase().includes("application/xml"),
    xml_has_metadata_root: xmlPayload.includes("<MetaData"),
    xml_has_declaration: xmlPayload.includes("<Declaration"),
    xml_has_function_code: xmlPayload.includes("<FunctionCode>9</FunctionCode>"),
    xml_has_type_code: xmlPayload.includes("<TypeCode>IMA</TypeCode>"),
    xml_has_declarant_id: xmlPayload.includes(`<Declarant>\n      <ID>${eori}</ID>`),
    xml_has_importer_id: xmlPayload.includes(`<Importer>\n        <ID>${eori}</ID>`),
    xml_has_hs_code: xmlPayload.includes("<ID>8471300000</ID>"),
    xml_has_dispatch_de: xmlPayload.includes("<ID>DE</ID>"),
    xml_no_y922: !xmlPayload.includes("<TypeCode>922</TypeCode>"),
    xml_has_n935: xmlPayload.includes("<TypeCode>935</TypeCode>"),
    xml_has_n271: xmlPayload.includes("<TypeCode>271</TypeCode>"),
    eori_format_valid: /^GB\d{12}$/.test(eori),
  };

  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  return {
    checks,
    failed,
    readyToSubmit: failed.length === 0,
    endpoint,
    acceptHeader,
    contentTypeHeader,
  };
}

async function run() {
  const evidenceDir = path.join(process.cwd(), "test-evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const dryRunOnly = process.env.DRY_RUN_ONLY !== "false";
  const submitEnabled = process.env.HMRC_SUBMIT_ONCE === "true";

  const userId = process.env.HMRC_TEST_USER_ID || process.env.HMRC_USER_ID;
  // Only hard-fail on missing userId when we actually need to submit
  if (!userId && !dryRunOnly) {
    throw new Error("Missing HMRC_TEST_USER_ID (or HMRC_USER_ID) for Convex token lookup — required for live submit");
  }

  const client = userId ? new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL) : null;
  const eori = process.env.HMRC_EORI || "GB243617410764";

  const baseDecl = {
    _id: "trade-test-fixed",
    declarationType: "H1",
    eori,
    importerEori: eori,
    lrn: `TT-${Date.now()}`,
    ducr: `6GB${eori.replace(/^GB/i, "")}-${Date.now()}`,
    presentationOffice: "",
    totalGrossWeight: 120,
    invoiceCurrency: "GBP",
    invoiceTotal: 5000,
    locationId: "GBAUFXTFXTGW",
    goodsLocationKind: "port",
    destinationCountry: "GB",
    dispatchCountry: "DE",
    incoterms: "CIF",
    incotermLocation: "Felixstowe",
    transportId: "CSCL GLOBE",
    transportMode: "1",
  };

  // Active lane: HS 8471300000 — laptops from Germany (DE)
  const itemSeed = {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine, weight not exceeding 10kg",
    originCountry: "DE",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    valueAmount: 5000,
    valueCurrency: "GBP",
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 1,
    packageType: "PK",
    shippingMarks: "TEST-MARK-LAPTOPS-001",
    // Documents come from SIGNED_ADDITIONAL_DOCUMENTS via mapToCDS_H1 fallback
  };

  const input = {
    key: "trade-test-h1-dry-run",
    declaration: { ...baseDecl, eori },
    item: { ...itemSeed },
  };

  const payloadInfo = mapToCDS_H1(input.declaration, [{ ...input.item }]);
  const xmlPayload = buildXml(payloadInfo);

  let tokenRecord = null;
  if (client && userId && !dryRunOnly) {
    tokenRecord = await client.query(api.hmrc.getToken, { userId });
  } else if (client && userId) {
    try {
      tokenRecord = await client.query(api.hmrc.getToken, { userId });
    } catch {
      // Convex unreachable in dry-run — token_present will show false, non-blocking
    }
  }
  const preflight = preflightGates(xmlPayload, eori);
  preflight.checks.token_present = Boolean(tokenRecord?.accessToken);
  const dryRunMode = process.env.DRY_RUN_ONLY !== "false";
  preflight.failed = Object.entries(preflight.checks)
    .filter(([key, ok]) => {
      // token_present is non-blocking in dry-run — Convex may not be running locally
      if (key === "token_present" && dryRunMode) return false;
      return !ok;
    })
    .map(([key]) => key);
  preflight.readyToSubmit = preflight.failed.length === 0;

  const singleRunRequestFile = process.env.SINGLE_RUN_REQUEST_FILE || "trade-test-cds-v2-request.xml";
  const singleRunResponseFile = process.env.SINGLE_RUN_RESPONSE_FILE || "trade-test-cds-v2-response.xml";
  const dryRunReportFile = process.env.DRY_RUN_REPORT_FILE || "trade-test-cds-v2-dry-run.json";

  const requestMeta = `<!-- request_accept: ${preflight.acceptHeader} | request_content_type: ${preflight.contentTypeHeader} | request_authorization: Bearer [REDACTED] | request_x_client_id: ${process.env.HMRC_CLIENT_ID || ""} | request_gov_test_scenario: ABSENT -->`;
  fs.writeFileSync(
    path.join(evidenceDir, singleRunRequestFile),
    withMetaComment(
      { timestamp: new Date().toISOString(), status: 0, conversationId: "DRY_RUN" },
      `${requestMeta}\n${xmlPayload}`,
    ),
  );

  fs.writeFileSync(
    path.join(evidenceDir, dryRunReportFile),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: dryRunOnly ? "DRY_RUN_ONLY" : "SUBMIT_ALLOWED",
        submitEnabled,
        endpoint: preflight.endpoint,
        checks: preflight.checks,
        failed: preflight.failed,
        readyToSubmit: preflight.readyToSubmit,
        lane: {
          hs: "8471300000",
          cpc: "4000 000",
          origin: "DE",
          type: "IMA",
          description: "Portable automatic data processing machine (laptops)",
          documents: SIGNED_ADDITIONAL_DOCUMENTS.map((d) => `${d.CategoryCode}${d.TypeCode}`),
        },
      },
      null,
      2,
    ),
  );

  if (dryRunOnly || !submitEnabled || !preflight.readyToSubmit) {
    fs.writeFileSync(
      path.join(evidenceDir, singleRunResponseFile),
      withMetaComment(
        { timestamp: new Date().toISOString(), status: 0, conversationId: "N/A" },
        "<dryRunOnly>true</dryRunOnly>",
      ),
    );
    console.log(
      JSON.stringify(
        {
          dryRunOnly,
          submitEnabled,
          readyToSubmit: preflight.readyToSubmit,
          failed: preflight.failed,
          reportFile: dryRunReportFile,
        },
        null,
        2,
      ),
    );
    if (!preflight.readyToSubmit) {
      console.error("\n[GATE BLOCKED] Preflight failed. Fix the above before enabling submit.\n");
      process.exit(1);
    }
    return;
  }

  // Live submit — only reached when DRY_RUN_ONLY=false AND HMRC_SUBMIT_ONCE=true
  const token = await getToken(client, userId);
  const response = await submitXml(xmlPayload, token);

  const responseWithMeta = `<!-- request_accept: ${response.requestHeaders.Accept} | request_content_type: ${response.requestHeaders["Content-Type"]} | request_authorization: ${response.requestHeaders.Authorization} | request_x_client_id: ${response.requestHeaders["X-Client-ID"]} | request_gov_test_scenario: ABSENT -->\n${response.body || "<empty/>"}`;

  fs.writeFileSync(
    path.join(evidenceDir, singleRunResponseFile),
    withMetaComment(response, responseWithMeta),
  );

  const summary = [
    {
      scenario: input.key,
      header: "ABSENT",
      status: response.status,
      conversationId: response.conversationId,
      timestamp: response.timestamp,
      lane: {
        hs: itemSeed.commodityCode,
        origin: itemSeed.originCountry,
        cpc: itemSeed.procedureCode,
      },
    },
  ];

  fs.writeFileSync(
    path.join(evidenceDir, "scenario-summary.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log(JSON.stringify(summary, null, 2));

  if (response.status !== 202) {
    console.error(
      `\n[GATE BLOCKED] Expected HTTP 202, got ${response.status}. Do NOT retry without passing P1-P3 gates again.\n`,
    );
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
