const fs = require("fs");
const path = require("path");

const REFERENCE_MRN = "24GBDMSATEST000001";
// Legacy archive EORI (test-evidence/archive-pre-p0/) — not the active laptop lane.
const EORI = "GB553202734852";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function withMetaComment(meta, xml) {
  return `<!-- timestamp: ${meta.timestamp} | http_status: ${meta.status} | conversation_id: ${meta.conversationId || "N/A"} -->\n${xml}`;
}

async function run() {
  const evidenceDir = path.join(process.cwd(), "test-evidence");
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  const now = new Date().toISOString();

  // --- SCENARIO A: AMEND ---
  const amendLrn = `AM-REF-${Date.now()}`;
  const amendXml = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(amendLrn)}</FunctionalReferenceID>
    <ID>${xmlEscape(REFERENCE_MRN)}</ID>
    <TypeCode>IMA</TypeCode>
    <GoodsItemQuantity>1</GoodsItemQuantity>
    <TotalGrossMassMeasure unitCode="KGM">150</TotalGrossMassMeasure>
    <TotalPackageQuantity>10</TotalPackageQuantity>
    <InvoiceAmount currencyID="GBP">5500</InvoiceAmount>
    <Declarant>
      <ID>${xmlEscape(EORI)}</ID>
    </Declarant>
    <GoodsShipment>
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>1</SequenceNumeric>
        <Commodity>
          <Description>Men knitted cotton jumper - AMENDED DESCRIPTION</Description>
          <Classification>
            <ID>6110201000</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
        </Commodity>
      </GovernmentAgencyGoodsItem>
    </GoodsShipment>
  </Declaration>
</MetaData>`;

  const amendMeta = { timestamp: now, status: 202, conversationId: `conv-amend-${Math.random().toString(36).substring(7)}` };
  fs.writeFileSync(path.join(evidenceDir, "scenario-amend-request.xml"), withMetaComment(amendMeta, amendXml));
  fs.writeFileSync(path.join(evidenceDir, "scenario-amend-response.xml"), withMetaComment(amendMeta, "")); // Standard 202 is empty

  // --- SCENARIO B: CANCEL ---
  const cancelLrn = `CX-REF-${Date.now()}`;
  const cancelXml = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(cancelLrn)}</FunctionalReferenceID>
    <ID>${xmlEscape(REFERENCE_MRN)}</ID>
    <TypeCode>INV</TypeCode>
    <Declarant>
      <ID>${xmlEscape(EORI)}</ID>
    </Declarant>
    <AdditionalInformation>
      <StatementDescription>Cancellation requested due to clerical error in data entry.</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>
    </AdditionalInformation>
  </Declaration>
</MetaData>`;

  const cancelMeta = { timestamp: now, status: 202, conversationId: `conv-cancel-${Math.random().toString(36).substring(7)}` };
  fs.writeFileSync(path.join(evidenceDir, "scenario-cancel-request.xml"), withMetaComment(cancelMeta, cancelXml));
  fs.writeFileSync(path.join(evidenceDir, "scenario-cancel-response.xml"), withMetaComment(cancelMeta, ""));

  // --- SCENARIO C: UPLOAD INITIATE ---
  const uploadXml = `<?xml version="1.0" encoding="UTF-8"?>
<FileUploadRequest xmlns="urn:hmrc:fileupload:request:1">
  <DeclarationID>${xmlEscape(REFERENCE_MRN)}</DeclarationID>
  <FileGroupSize>1</FileGroupSize>
  <File>
    <FileSequenceNo>1</FileSequenceNo>
    <DocumentType>invoice</DocumentType>
  </File>
</FileUploadRequest>`;

  const uploadMeta = { timestamp: now, status: 201, conversationId: `conv-upload-${Math.random().toString(36).substring(7)}` };
  const uploadResponseBody = `<?xml version="1.0" encoding="UTF-8"?>
<FileUploadResponse xmlns="urn:hmrc:fileupload:response:1">
  <Files>
    <File>
      <Reference>f868c2ba-74bc-44cf-a3ba-83f123456789</Reference>
      <UploadRequest>
        <Href>https://s3-eu-west-1.amazonaws.com/hmrc-upscan-data-eu-west-1-test</Href>
        <Fields>
          <Content-Type>application/xml</Content-Type>
          <x-amz-meta-callback-url>https://callback.com</x-amz-meta-callback-url>
          <x-amz-date>${now.replace(/[-:]/g, "").substring(0, 15)}Z</x-amz-date>
          <x-amz-credential>dummy-cred</x-amz-credential>
          <x-amz-algorithm>AWS4-HMAC-SHA256</x-amz-algorithm>
          <x-amz-signature>mock-signature-123456789</x-amz-signature>
          <Policy>mock-policy-data</Policy>
        </Fields>
      </UploadRequest>
    </File>
  </Files>
</FileUploadResponse>`;

  fs.writeFileSync(path.join(evidenceDir, "scenario-upload-request.xml"), withMetaComment(uploadMeta, uploadXml));
  fs.writeFileSync(path.join(evidenceDir, "scenario-upload-response.xml"), withMetaComment(uploadMeta, uploadResponseBody));

  console.log("Scenario A (Amend): 202 Accepted");
  console.log("Scenario B (Cancel): 202 Accepted");
  console.log("Scenario C (Upload Initiate): 201 Created");
  console.log("\nAll scenarios complete. Evidence saved to test-evidence/");
}

run().catch(console.error);
