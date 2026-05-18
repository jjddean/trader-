/**
 * Trade Test Scenario Runner — TradeDNA
 *
 * Signed decision matrix applied (2026-04-11):
 *   Lane: HS 0207129000 / CPC 4000 000 / Origin BR / Type IMA
 *   Documents: N853 (CHED-P), Y930 (Decision 2007/275 exclusion), Y929 (non-organic)
 *   Source: trade-tariff.service.gov.uk/commodities/0207129000?country=BR
 *
 * FIXED (2026-04-11):
 *   - GovernmentProcedure: DE 1/10 = two 2-digit codes; DE 1/11 = separate 3-digit element
 *   - Accept header: application/vnd.hmrc.2.0+xml for Trade Test
 *   - dispatchCountry: BR (not GB)
 *   - Documents: N853 + Y930 + Y929 replacing invalid Y922
 *   - XML builder: iterates AdditionalDocument array (not hardcoded single element)
 *   - HS code updated to 0207129000 to match signed lane
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

// ---------------------------------------------------------------------------
// Signed document matrix — HS 0207129000 / CPC 4000 000 / Origin BR
// Source: UK Trade Tariff veterinary control measure 20234422 + organic measure
// ---------------------------------------------------------------------------
const SIGNED_ADDITIONAL_DOCUMENTS = [
  // N853: CHED-P — mandatory for all 3rd-country animal product imports
  // StatusCode XW required from 23 Oct 2025 (HMRC changed CHED document status codes; AE/XX removed)
  // ID year must match current year (2026)
  { CategoryCode: "N", TypeCode: "853", StatusCode: "XW", ID: "GBCHD2026.1234567" },
  // Y930: Commission Decision 2007/275/EC exclusion — non-research commercial goods
  { CategoryCode: "Y", TypeCode: "930", StatusCode: "XB", ID: "Excluded" },
  // Y929: Non-organic goods declaration — exemption from organic certification requirement
  { CategoryCode: "Y", TypeCode: "929", StatusCode: "XB", ID: "Excluded" },
];

function mapToCDS_H1(declaration, items) {
  const totalGrossWeight =
    items.reduce((acc, item) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
  const invoiceTotal =
    items.reduce((acc, item) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;
  const ducr = declaration.ducr ||
    `${new Date().getFullYear() % 10}GB${(declaration.eori || "GB449181054677").replace(/^GB/i, "")}-${String(declaration._id || "manual")
      .substring(0, 6)
      .toUpperCase()}`;

  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: "IMA",
      FunctionalReferenceID: declaration.lrn || `FC-${declaration._id || "manual"}`,
      GoodsItemQuantity: items.length || 1,
      DeclarationOfficeID: declaration.presentationOffice || "GB000051",
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
      // DE 7/14 — BorderTransportMeans at Declaration level (required by CDS alongside
      // ArrivalTransportMeans inside Consignment — R123 enforces matching identity).
      BorderTransportMeans: {
        ID: (declaration.transportId || "CSCL GLOBE").replace(/\s+/g, ""),
        IdentificationTypeCode: declaration.transportIdType || "11",
        ModeCode: declaration.transportMode || "1",
      },
      Declarant: { ID: declaration.eori || "" },
      // Only include Exporter when a valid GB/XI EORI is present — HMRC DE 3/2: "Do NOT enter if exporter is not UK-based"
      Exporter: /^(GB|XI)\d{12}$/i.test(declaration.exporterEori || "") ? { ID: declaration.exporterEori } : null,
      UCR: {
        TraderAssignedReferenceID: ducr,
      },
      // DE 3/39 — Authorisation holders at Declaration level.
      AuthorisationHolder: Array.isArray(declaration.authorisationHolders)
        ? declaration.authorisationHolders
        : [],
      GoodsShipment: {
        // DE 8/5 — Nature of transaction code. "11" = sale.
        TransactionNatureCode: declaration.transactionNatureCode || "11",
        // DE 3/24 — Buyer (UK importer).
        Buyer: {
          AddressCountryCode: declaration.destinationCountry || "GB",
        },
        Consignment: {
          ContainerCode: "0",
          // DE 7/9 — ArrivalTransportMeans (mirrors BorderTransportMeans).
          ArrivalTransportMeans: {
            ID: (declaration.transportId || "CSCL GLOBE").replace(/\s+/g, ""),
            IdentificationTypeCode: declaration.transportIdType || "11",
            ModeCode: declaration.transportMode || "1",
          },
          GoodsLocation: {
            Name: declaration.locationName || "GBWLAFXTFXTGW",
            ID: declaration.locationId || "GBAUFXTFXTGW",
            TypeCode: "A",
            Address: {
              TypeCode: "U",
              CountryCode: declaration.destinationCountry || "GB",
            },
          },
        },
        Destination: { CountryCode: declaration.destinationCountry || "GB" },
        ExportCountry: { ID: declaration.dispatchCountry || "BR" },
        Importer: { ID: declaration.importerEori || declaration.eori || "" },
        // DE 3/1 — Seller.
        Seller: {
          AddressCountryCode: declaration.dispatchCountry || "BR",
        },
        // DE 2/1 — Previous document (DUCR).
        PreviousDocument: [
          {
            CategoryCode: "Z",
            TypeCode: "DCR",
            ID: ducr,
            LineNumeric: "1",
          },
        ],
        TradeTerms: {
          ConditionCode: declaration.incoterms || "FOB",
          LocationID: declaration.incotermLocation || "GBFXT",
        },
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => {
          // Use item's own additionalDocuments if provided, otherwise use the signed matrix
          const docs =
            Array.isArray(item.additionalDocuments) && item.additionalDocuments.length > 0
              ? item.additionalDocuments
              : SIGNED_ADDITIONAL_DOCUMENTS;

          // Ensure N935 (commercial invoice) is present for valuation method 1
          const hasN935 = docs.some((d) => d.CategoryCode === "N" && d.TypeCode === "935");
          const allDocs = hasN935
            ? docs
            : [
                ...docs,
                { CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: `INV-${Date.now()}` },
              ];

          return {
            SequenceNumeric: item.sequenceNumber || index + 1,
            AdditionalDocument: allDocs,
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
              // DE 8/6 — Preference code / duty regime.
              DutyTaxFee: {
                DutyRegimeCode: item.preferenceCode || "100",
              },
            },
            // DE 4/16 + 4/13 — Customs valuation method and adjustment indicators.
            CustomsValuation: {
              MethodCode: item.valuationMethod || "1",
              ValuationAdjustment: {
                AdditionCode: item.valuationAdjustment || "0000",
              },
            },
            Packaging: [
              {
                SequenceNumeric: "1",
                MarksNumbersID: item.shippingMarks || "MARKS",
                QuantityQuantity: item.packageCount || "1",
                TypeCode: item.packageType || "PK",
              },
            ],
            // DE 5/15/5/16 — Country of origin (mandatory for H1 imports).
            Origin: {
              CountryCode: item.originCountry || "",
              TypeCode: "1",
            },
            // FIX: DE 1/10 = two separate 2-digit codes; DE 1/11 = separate 3-digit element
            GovernmentProcedure: [
              {
                // DE 1/10 requested procedure (chars 0-1) + previous procedure (chars 2-3)
                CurrentCode: (item.procedureCode?.replace(/\s+/g, "") || "4000").substring(0, 2),
                PreviousCode: (item.procedureCode?.replace(/\s+/g, "") || "4000").substring(2, 4) || "00",
              },
              {
                // DE 1/11 additional procedure code (3 digits, no PreviousCode)
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
    </CurrencyExchange>${d.BorderTransportMeans ? `\n    <BorderTransportMeans>\n      <ID>${xmlEscape(d.BorderTransportMeans.ID)}</ID>\n      <IdentificationTypeCode>${xmlEscape(d.BorderTransportMeans.IdentificationTypeCode)}</IdentificationTypeCode>\n      <ModeCode>${xmlEscape(d.BorderTransportMeans.ModeCode)}</ModeCode>\n    </BorderTransportMeans>` : ""}
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>
    ${d.Exporter ? `<Exporter>\n      <ID>${xmlEscape(d.Exporter.ID)}</ID>\n    </Exporter>` : ""}
    ${(d.AuthorisationHolder || []).filter((ah) => ah.ID && ah.CategoryCode).map((ah) => `<AuthorisationHolder>\n      <ID>${xmlEscape(ah.ID)}</ID>\n      <CategoryCode>${xmlEscape(ah.CategoryCode)}</CategoryCode>\n    </AuthorisationHolder>`).join("\n    ")}
    <GoodsShipment>${gs.TransactionNatureCode ? `\n      <TransactionNatureCode>${xmlEscape(gs.TransactionNatureCode)}</TransactionNatureCode>` : ""}
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(d.UCR.TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
      ${gs.Buyer && gs.Buyer.AddressCountryCode ? `<Buyer>\n        <Address>\n          <CountryCode>${xmlEscape(gs.Buyer.AddressCountryCode)}</CountryCode>\n        </Address>\n      </Buyer>` : ""}
      <Consignment>
        <ContainerCode>${xmlEscape(gs.Consignment.ContainerCode)}</ContainerCode>
        <ArrivalTransportMeans>
          <ID>${xmlEscape(gs.Consignment.ArrivalTransportMeans.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(gs.Consignment.ArrivalTransportMeans.IdentificationTypeCode)}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(gs.Consignment.ArrivalTransportMeans.ModeCode)}</ModeCode>
        </ArrivalTransportMeans>
        <GoodsLocation>
          <Name>${xmlEscape(gs.Consignment.GoodsLocation.Name)}</Name>
          <ID>${xmlEscape(gs.Consignment.GoodsLocation.ID)}</ID>
          <TypeCode>${xmlEscape(gs.Consignment.GoodsLocation.TypeCode || "A")}</TypeCode>
          <Address>
            <TypeCode>${xmlEscape((gs.Consignment.GoodsLocation.Address || {}).TypeCode || "U")}</TypeCode>
            <CountryCode>${xmlEscape((gs.Consignment.GoodsLocation.Address || {}).CountryCode || "")}</CountryCode>
          </Address>
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
      </Importer>${(gs.PreviousDocument || []).map((pd) => `\n      <PreviousDocument>\n        <CategoryCode>${xmlEscape(pd.CategoryCode)}</CategoryCode>\n        <ID>${xmlEscape(pd.ID)}</ID>\n        <TypeCode>${xmlEscape(pd.TypeCode)}</TypeCode>${pd.LineNumeric ? `\n        <LineNumeric>${xmlEscape(pd.LineNumeric)}</LineNumeric>` : ""}\n      </PreviousDocument>`).join("")}
      ${gs.Seller && gs.Seller.AddressCountryCode ? `<Seller>\n        <Address>\n          <CountryCode>${xmlEscape(gs.Seller.AddressCountryCode)}</CountryCode>\n        </Address>\n      </Seller>` : ""}
      <TradeTerms>
        <ConditionCode>${xmlEscape(gs.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(gs.TradeTerms.LocationID)}</LocationID>
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
          <Classification>
            <ID>${xmlEscape(item.Commodity.Classification[0].ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(item.Commodity.Classification[0].IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.GrossMassMeasure)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.NetNetWeightMeasure)}</NetNetWeightMeasure>
          </GoodsMeasure>${item.Commodity.DutyTaxFee ? `\n          <DutyTaxFee>\n            <DutyRegimeCode>${xmlEscape(item.Commodity.DutyTaxFee.DutyRegimeCode)}</DutyRegimeCode>\n          </DutyTaxFee>` : ""}
        </Commodity>
        <CustomsValuation>
          <MethodCode>${xmlEscape((item.CustomsValuation || {}).MethodCode || "1")}</MethodCode>${(() => {
            const va = (item.CustomsValuation || {}).ValuationAdjustment;
            return va && va.AdditionCode
              ? `\n          <ValuationAdjustment>\n            <AdditionCode>${xmlEscape(va.AdditionCode)}</AdditionCode>\n          </ValuationAdjustment>`
              : "";
          })()}
        </CustomsValuation>
        ${proceduresXml}${item.Origin && item.Origin.CountryCode ? `\n        <Origin>\n          <CountryCode>${xmlEscape(item.Origin.CountryCode)}</CountryCode>\n          <TypeCode>${xmlEscape(item.Origin.TypeCode || "1")}</TypeCode>\n        </Origin>` : ""}
        <Packaging>
          <SequenceNumeric>${xmlEscape(pkg.SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(pkg.MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(pkg.QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(pkg.TypeCode)}</TypeCode>
        </Packaging>
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

  if (tokenRecord.expiresAt && Date.now() + 300000 > tokenRecord.expiresAt) {
    if (!tokenRecord.refreshToken) {
      throw new Error("HMRC token expiring and no refresh token available in Convex");
    }
    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? "https://test-api.service.hmrc.gov.uk"
        : "https://api.service.hmrc.gov.uk";
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
      expiresIn: data.expires_in || 14400,
      eori: tokenRecord.eori,
    });
    return data.access_token;
  }

  return tokenRecord.accessToken;
}

async function submitXml(xmlPayload, token) {
  const endpoint =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk/customs/declarations"
      : "https://api.service.hmrc.gov.uk/customs/declarations";
  const now = new Date().toISOString();
  const acceptHeader =
    process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml";
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
      "Gov-Vendor-Version": "TradeDNA=1.0.0",
      "Gov-Vendor-Product-Name": "TradeDNA",
      "Gov-Vendor-Public-IP": process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6",
      "Gov-Vendor-Forwarded": `by=${process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6"}&for=62.31.164.236`,
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
  const acceptHeader =
    process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml";
  const contentTypeHeader =
    process.env.HMRC_CONTENT_TYPE_HEADER || "application/xml; charset=UTF-8";
  const endpoint =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk/customs/declarations"
      : "https://api.service.hmrc.gov.uk/customs/declarations";

  const checks = {
    token_present: false, // set after token fetch
    client_id_present: Boolean(process.env.HMRC_CLIENT_ID),
    environment_is_sandbox: process.env.HMRC_ENVIRONMENT === "sandbox",
    endpoint_is_test_api: endpoint.startsWith("https://test-api.service.hmrc.gov.uk"),
    accept_is_v2: acceptHeader === "application/vnd.hmrc.2.0+xml",
    content_type_is_xml: contentTypeHeader.toLowerCase().includes("application/xml"),
    xml_has_metadata_root: xmlPayload.includes("<MetaData"),
    xml_has_declaration: xmlPayload.includes("<Declaration"),
    xml_has_function_code: xmlPayload.includes("<FunctionCode>9</FunctionCode>"),
    xml_has_type_code: xmlPayload.includes("<TypeCode>IMA</TypeCode>"),
    xml_has_declarant_id: xmlPayload.includes(`<Declarant>\n      <ID>${eori}</ID>`),
    xml_has_importer_id: xmlPayload.includes(`<Importer>\n        <ID>${eori}</ID>`),
    // FIX: check for signed lane HS code 0207129000, not previous 6110201000
    xml_has_hs_code: xmlPayload.includes("<ID>0207129000</ID>"),
    xml_no_y922: !xmlPayload.includes("<TypeCode>922</TypeCode>"),
    xml_has_n853: xmlPayload.includes("<TypeCode>853</TypeCode>"),
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
  const eori = process.env.HMRC_EORI || "GB449181054677";

  const baseDecl = {
    _id: "trade-test-fixed",
    declarationType: "H1",
    eori,
    exporterEori: "BR12345678901234",  // Brazilian exporter — must not be a UK GB EORI
    importerEori: eori,
    lrn: `TT-${Date.now()}`,
    ducr: `6GB${eori.replace(/^GB/i, "")}-${Date.now()}`,  // year digit = last digit of calendar year (6 for 2026); format: {digit}GB{12-digit-eori}-{ref}
    presentationOffice: "GB000051",
    totalGrossWeight: 120,
    invoiceCurrency: "GBP",
    invoiceTotal: 4200,
    locationName: "GBWLAFXTFXTGW",
    locationId: "GBAUFXTFXTGW",
    destinationCountry: "GB",
    dispatchCountry: "BR",   // FIX: was "GB" — must be the actual country of dispatch
    incoterms: "FOB",
    incotermLocation: "GBFXT",
    transportId: "CSCL GLOBE",
    transportIdType: "11",
    transportMode: "1",
    transactionNatureCode: "11",
  };

  // Signed lane: HS 0207129000 frozen whole poultry from Brazil
  const itemSeed = {
    sequenceNumber: 1,
    commodityCode: "0207129000",
    description: "Frozen whole chicken, not cut in pieces, Gallus domesticus",
    originCountry: "BR",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    valueAmount: 4200,
    valueCurrency: "GBP",
    grossWeightKg: 120,
    netWeightKg: 118,
    packageCount: 8,
    packageType: "PK",
    shippingMarks: "TEST-MARK-001",
    // Documents come from SIGNED_ADDITIONAL_DOCUMENTS via mapToCDS_H1 fallback
    // (additionalDocuments not set here so the signed matrix is used automatically)
  };

  const input = {
    key: "trade-test-h1-dry-run",
    declaration: { ...baseDecl, eori },
    item: { ...itemSeed },
  };

  const payloadInfo = mapToCDS_H1(input.declaration, [{ ...input.item }]);
  const xmlPayload = buildXml(payloadInfo);

  const tokenRecord = (client && userId) ? await client.query(api.hmrc.getToken, { userId }) : null;
  const preflight = preflightGates(xmlPayload, eori);
  preflight.checks.token_present = Boolean(tokenRecord?.accessToken);
  preflight.failed = Object.entries(preflight.checks)
    .filter(([, ok]) => !ok)
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
          hs: "0207129000",
          cpc: "4000 000",
          origin: "BR",
          type: "IMA",
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
