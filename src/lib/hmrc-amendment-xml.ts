import { xmlEscape } from "./xml-utils";

/**
 * CDS amendment (FunctionCode 13, TypeCode COR).
 * Source: HMRC TT_IM002b_Amendment.xml (hmrc/customs-declarations annotated samples).
 */

export type AmendmentChangeKind = "itemChargeAmount" | "grossMass" | "headerField";

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

/**
 * Generic header-level amendment. The pointer chain and TagID are NOT hand-written:
 * they are derived from the HMRC CDS WCO reference table (cds_wco_references.ts) via
 * deriveHeaderAmendment() and passed in here, so element placement is spec-sourced,
 * not invented. The same derivation reproduces the HMRC-validated item-charge chain.
 */
export type HeaderFieldChange = AmendmentBaseArgs & {
  changeKind: "headerField";
  /** Ordered ancestor container DocumentSectionCodes (e.g. ["42A","67A"]). */
  pointerSections: string[];
  /** Leaf WCO TagID carried on the final pointer (e.g. "103"). */
  leafTagId: string;
  /** Element path below <Declaration> to the leaf (e.g. ["GoodsShipment","TransactionNatureCode"]). */
  fragmentPath: string[];
  value: string;
};

export type AmendmentChange = ItemChargeAmountChange | GrossMassChange | HeaderFieldChange;

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

function nestedFragmentXml(fragmentPath: string[], value: string): string {
  let inner = xmlEscape(value);
  for (let i = fragmentPath.length - 1; i >= 0; i--) {
    const tag = fragmentPath[i];
    inner = `<${tag}>${inner}</${tag}>`;
  }
  return `
    ${inner}`;
}

function goodsShipmentFragment(change: AmendmentChange, seq: number): string {
  if (change.changeKind === "headerField") {
    return nestedFragmentXml(change.fragmentPath, change.value);
  }

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
  if (change.changeKind === "headerField") {
    return change.pointerSections
      .map((section, idx) =>
        idx === change.pointerSections.length - 1
          ? pointerXml(1, section, change.leafTagId)
          : pointerXml(1, section),
      )
      .join("");
  }

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
