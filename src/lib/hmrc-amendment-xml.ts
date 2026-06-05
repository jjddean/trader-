import { xmlEscape } from "./xml-utils";

/**
 * CDS amendment (FunctionCode 13, TypeCode COR).
 * Source: HMRC TT_IM002b_Amendment.xml (hmrc/customs-declarations annotated samples).
 */

export type AmendmentChangeKind = "itemChargeAmount" | "grossMass";

export interface AmendmentBaseArgs {
  amendLrn: string;
  mrn: string;
  statementDescription: string;
  changeReasonCode: string;
  itemSequence: number;
  currencyId?: string;
}

export type ItemChargeAmountChange = AmendmentBaseArgs & {
  changeKind: "itemChargeAmount";
  itemChargeAmount: string;
};

export type GrossMassChange = AmendmentBaseArgs & {
  changeKind: "grossMass";
  grossMassKg: string;
};

export type AmendmentChange = ItemChargeAmountChange | GrossMassChange;

const ITEM_CHARGE_TAG_ID = "112";
const ITEM_CHARGE_SECTION = "79A";
const GROSS_MASS_TAG_ID = "126";
const GROSS_MASS_SECTION = "126";

function pointerXml(sequence: number, section: string, tagId?: string): string {
  const tag = tagId ? `\n        <TagID>${xmlEscape(tagId)}</TagID>` : "";
  return `
      <Pointer>
        <SequenceNumeric>${sequence}</SequenceNumeric>
        <DocumentSectionCode>${xmlEscape(section)}</DocumentSectionCode>${tag}
      </Pointer>`;
}

function goodsShipmentFragment(change: AmendmentChange, seq: number): string {
  if (change.changeKind === "itemChargeAmount") {
    const currency = (change.currencyId || "GBP").trim();
    return `
    <GoodsShipment>
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${seq}</SequenceNumeric>
        <Commodity>
          <InvoiceLine>
            <ItemChargeAmount currencyID="${xmlEscape(currency)}">${xmlEscape(change.itemChargeAmount.trim())}</ItemChargeAmount>
          </InvoiceLine>
        </Commodity>
      </GovernmentAgencyGoodsItem>
    </GoodsShipment>`;
  }

  return `
    <GoodsShipment>
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${seq}</SequenceNumeric>
        <Commodity>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(change.grossMassKg.trim())}</GrossMassMeasure>
          </GoodsMeasure>
        </Commodity>
      </GovernmentAgencyGoodsItem>
    </GoodsShipment>`;
}

function amendmentPointers(change: AmendmentChange, seq: number): string {
  if (change.changeKind === "itemChargeAmount") {
    return (
      pointerXml(1, "42A") +
      pointerXml(1, "67A") +
      pointerXml(seq, "68A") +
      pointerXml(1, "23A") +
      pointerXml(1, ITEM_CHARGE_SECTION, ITEM_CHARGE_TAG_ID)
    );
  }

  return (
    pointerXml(1, "42A") +
    pointerXml(1, "67A") +
    pointerXml(seq, "68A") +
    pointerXml(1, "23A") +
    pointerXml(1, GROSS_MASS_SECTION, GROSS_MASS_TAG_ID)
  );
}

/** @deprecated Use buildAmendmentXmlFromChange */
export function buildAmendmentXml(args: {
  amendLrn: string;
  mrn: string;
  statementDescription: string;
  changeReasonCode: string;
  itemSequence: number;
  itemChargeAmount: string;
  currencyId: string;
}): string {
  return buildAmendmentXmlFromChange({
    changeKind: "itemChargeAmount",
    amendLrn: args.amendLrn,
    mrn: args.mrn,
    statementDescription: args.statementDescription,
    changeReasonCode: args.changeReasonCode,
    itemSequence: args.itemSequence,
    itemChargeAmount: args.itemChargeAmount,
    currencyId: args.currencyId,
  });
}

export function buildAmendmentXmlFromChange(change: AmendmentChange): string {
  const seq = Math.max(1, change.itemSequence);
  const aesPointers = pointerXml(1, "42A") + pointerXml(1, "06A");
  const amendFieldPointers = amendmentPointers(change, seq);
  const goodsShipment = goodsShipmentFragment(change, seq);

  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(change.amendLrn)}</FunctionalReferenceID>
    <ID>${xmlEscape(change.mrn)}</ID>
    <TypeCode>COR</TypeCode>
    <AdditionalInformation>
      <StatementDescription>${xmlEscape(change.statementDescription)}</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>${aesPointers}
    </AdditionalInformation>
    <Amendment>
      <ChangeReasonCode>${xmlEscape(change.changeReasonCode)}</ChangeReasonCode>${amendFieldPointers}
    </Amendment>${goodsShipment}
  </Declaration>
</MetaData>`;
}
