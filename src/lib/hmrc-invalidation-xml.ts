import { xmlEscape } from "./xml-utils";

/**
 * CDS invalidation — must conform to HMRC CANCEL.xsd (not full WCO_DEC_2_DMS).
 * Source: hmrc/customs-declarations public/api/conf/2.0/schemas/wco/declaration/CANCEL.xsd
 *
 * Allowed Declaration children: FunctionCode, FunctionalReferenceID, ID, TypeCode,
 * Submitter (optional), AdditionalInformation (required), Amendment (required).
 * No Declarant — that element causes xml_validation_error cvc-complex-type.2.4.a.
 *
 * AdditionalInformation must include Pointer to 42A and 06A so AES text links to
 * Amendment/ChangeReasonCode (TT_IM011a_Cancellation.xml).
 */
const INVALIDATION_REASON_TEXT: Record<string, string> = {
  "1": "Declaration is no longer required",
  "2": "Duplicate declaration (MRN of new declaration provided)",
  "3": "Other reason for cancellation",
};

export function resolveInvalidationChangeReasonCode(reason?: string): string {
  const text = reason?.trim() || "";
  if (!text) return "1";
  const entry = Object.entries(INVALIDATION_REASON_TEXT).find(([, label]) => label === text);
  if (entry) return entry[0];
  if (/^duplicate/i.test(text)) return "2";
  return "3";
}

export function buildInvalidationXml(args: {
  cancelLrn: string;
  mrn: string;
  eori: string;
  reason?: string;
}): string {
  const changeReasonCode = resolveInvalidationChangeReasonCode(args.reason);
  const reasonText =
    args.reason?.trim() ||
    INVALIDATION_REASON_TEXT[changeReasonCode] ||
    INVALIDATION_REASON_TEXT["1"];

  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(args.cancelLrn)}</FunctionalReferenceID>
    <ID>${xmlEscape(args.mrn)}</ID>
    <TypeCode>INV</TypeCode>
    <Submitter>
      <ID>${xmlEscape(args.eori)}</ID>
    </Submitter>
    <AdditionalInformation>
      <StatementDescription>${xmlEscape(reasonText)}</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>
      <Pointer>
        <SequenceNumeric>1</SequenceNumeric>
        <DocumentSectionCode>42A</DocumentSectionCode>
      </Pointer>
      <Pointer>
        <SequenceNumeric>1</SequenceNumeric>
        <DocumentSectionCode>06A</DocumentSectionCode>
      </Pointer>
    </AdditionalInformation>
    <Amendment>
      <ChangeReasonCode>${changeReasonCode}</ChangeReasonCode>
    </Amendment>
  </Declaration>
</MetaData>`;
}
