/**
 * Probe invalidation XML shapes against HMRC (sandbox).
 * MRN=26GB6518YNA44F6AR4 from user session.
 */
require("dotenv").config({ path: ".env.local" });
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const mrn = process.env.MRN || "26GB6518YNA44F6AR4";
const eori = process.env.EORI || "GB553202734852";
const cancelLrn = `CX-${Date.now()}`;
const reason = "Declaration is no longer required";

const header = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>`;

const footer = `</MetaData>`;

const variants = {
  oas_like: `${header}
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${cancelLrn}</FunctionalReferenceID>
    <ID>${mrn}</ID>
    <TypeCode>INV</TypeCode>
    <AdditionalInformation>
      <StatementDescription>${reason}</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>
    </AdditionalInformation>
    <Amendment>
      <Pointer><SequenceNumeric>1</SequenceNumeric><DocumentSectionCode>42A</DocumentSectionCode></Pointer>
      <Pointer><SequenceNumeric>1</SequenceNumeric><DocumentSectionCode>06A</DocumentSectionCode></Pointer>
    </Amendment>
    <Declarant><ID>${eori}</ID></Declarant>
  </Declaration>
${footer}`,
  oas_with_crc: `${header}
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${cancelLrn}a</FunctionalReferenceID>
    <ID>${mrn}</ID>
    <TypeCode>INV</TypeCode>
    <AdditionalInformation>
      <StatementTypeCode>AES</StatementTypeCode>
      <StatementDescription>${reason}</StatementDescription>
      <Pointer><DocumentSectionCode>42A</DocumentSectionCode><SequenceNumeric>1</SequenceNumeric></Pointer>
    </AdditionalInformation>
    <Amendment>
      <ChangeReasonCode>1</ChangeReasonCode>
    </Amendment>
    <Declarant><ID>${eori}</ID></Declarant>
  </Declaration>
${footer}`,
  declarant_first: `${header}
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${cancelLrn}b</FunctionalReferenceID>
    <ID>${mrn}</ID>
    <TypeCode>INV</TypeCode>
    <Declarant><ID>${eori}</ID></Declarant>
    <AdditionalInformation>
      <StatementTypeCode>AES</StatementTypeCode>
      <StatementDescription>${reason}</StatementDescription>
      <Pointer><DocumentSectionCode>42A</DocumentSectionCode><SequenceNumeric>1</SequenceNumeric></Pointer>
    </AdditionalInformation>
    <Amendment>
      <ChangeReasonCode>1</ChangeReasonCode>
    </Amendment>
  </Declaration>
${footer}`,
};

async function run() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const t = await client.query(api.hmrc.getToken, { userId: process.env.HMRC_TEST_USER_ID });
  const base =
    process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk";

  for (const [name, xml] of Object.entries(variants)) {
    const r = await fetch(`${base}/customs/declarations`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.hmrc.2.0+xml",
        "Content-Type": "application/xml; charset=UTF-8",
        Authorization: `Bearer ${t.accessToken}`,
        "X-Client-ID": process.env.HMRC_CLIENT_ID,
        "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
        "Gov-Vendor-Public-IP": process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6",
      },
      body: xml,
    });
    const body = await r.text();
    const code = body.match(/ValidationCode>([^<]+)/)?.[1] || body.match(/<code>([^<]+)/)?.[1] || "";
    console.log(name, "HTTP", r.status, code || body.slice(0, 80).replace(/\n/g, " "));
  }
}

run();
