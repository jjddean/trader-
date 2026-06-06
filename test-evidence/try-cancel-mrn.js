require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const mrn = process.env.MRN || "26GB63M1I0RQFCVAR4";
const lrn = process.env.LRN || "FC-MPYAJ7RN";
const eori = process.env.EORI || "GB553202734852";
const reason = process.env.CANCEL_REASON || "Trade Test SDST cancellation evidence";

// Minimal invalidation — reason may be optional at XML layer; AES block needs correct sequence if added later.
const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${lrn}</FunctionalReferenceID>
    <ID>${mrn}</ID>
    <TypeCode>INV</TypeCode>
    <Declarant><ID>${eori}</ID></Declarant>
  </Declaration>
</MetaData>`;

async function run() {
  const userId = process.env.HMRC_TEST_USER_ID;
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const tokenRecord = await client.query(api.hmrc.getToken, { userId });
  const base = process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk";

  const response = await fetch(`${base}/customs/declarations`, {
    method: "POST",
    headers: {
      Accept: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
      "Content-Type": "application/xml; charset=UTF-8",
      Authorization: `Bearer ${tokenRecord.accessToken}`,
      "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Vendor-Public-IP": process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6",
    },
    body: xmlPayload,
  });

  const body = await response.text();
  const outDir = path.join(process.cwd(), "documentation/HMRC/sdst-evidence-pack/evidence/04-cancel");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "request.xml"), xmlPayload);
  fs.writeFileSync(path.join(outDir, "response.xml"), body);

  console.log(JSON.stringify({
    httpStatus: response.status,
    conversationId: response.headers.get("X-Conversation-ID"),
    bodyPreview: body.slice(0, 1500),
  }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
