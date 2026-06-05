import { xmlEscape } from "./xml-utils";

/**
 * CDS amendment (FunctionCode 13, TypeCode COR).
 * Source: HMRC TT_IM002b_Amendment.xml (hmrc/customs-declarations annotated samples).
 *
 * Allowed shape: COR message with AES AdditionalInformation, Amendment pointers,
 * and a minimal GoodsShipment fragment for the changed field — not a full IMA declaration.
 */
const ITEM_CHARGE_TAG_ID = "112";
const ITEM_CHARGE_SECTION = "79A";

function pointerXml(sequence: number, section: string, tagId?: string): string {
  const tag = tagId ? `\n        <TagID>${xmlEscape(tagId)}</TagID>` : "";
  return `
      <Pointer>
        <SequenceNumeric>${sequence}</SequenceNumeric>
        <DocumentSectionCode>${xmlEscape(section)}</DocumentSectionCode>${tag}
      </Pointer>`;
}

export function buildAmendmentXml(args: {
  amendLrn: string;
  mrn: string;
  statementDescription: string;
  changeReasonCode: string;
  itemSequence: number;
  itemChargeAmount: string;
  currencyId: string;
}): string {
  const currency = args.currencyId.trim() || "GBP";
  const amount = args.itemChargeAmount.trim();
  const seq = Math.max(1, args.itemSequence);

  const aesPointers = pointerXml(1, "42A") + pointerXml(1, "06A");
  const amendFieldPointers =
    pointerXml(1, "42A") +
    pointerXml(1, "67A") +
    pointerXml(seq, "68A") +
    pointerXml(1, "23A") +
    pointerXml(1, ITEM_CHARGE_SECTION, ITEM_CHARGE_TAG_ID);

  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(args.amendLrn)}</FunctionalReferenceID>
    <ID>${xmlEscape(args.mrn)}</ID>
    <TypeCode>COR</TypeCode>
    <AdditionalInformation>
      <StatementDescription>${xmlEscape(args.statementDescription)}</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>${aesPointers}
    </AdditionalInformation>
    <Amendment>
      <ChangeReasonCode>${xmlEscape(args.changeReasonCode)}</ChangeReasonCode>${amendFieldPointers}
    </Amendment>
    <GoodsShipment>
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${seq}</SequenceNumeric>
        <Commodity>
          <InvoiceLine>
            <ItemChargeAmount currencyID="${xmlEscape(currency)}">${xmlEscape(amount)}</ItemChargeAmount>
          </InvoiceLine>
        </Commodity>
      </GovernmentAgencyGoodsItem>
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
