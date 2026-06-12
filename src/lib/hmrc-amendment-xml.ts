import { xmlEscape } from "./xml-utils";
import { deriveHeaderAmendment } from "./hmrc-amendment-pointers";

/**
 * CDS amendment (FunctionCode 13, TypeCode COR).
 * Source: HMRC TT_IM002b_Amendment.xml (hmrc/customs-declarations annotated samples).
 */

const ITEM_CHARGE_WCO_PATH =
  "Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/InvoiceLine/ItemChargeAmount";
const GROSS_MASS_WCO_PATH =
  "Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/GoodsMeasure/GrossMassMeasure";
const INVOICE_AMOUNT_WCO_PATH = "Declaration/InvoiceAmount";

/** FunctionalReferenceID for amend messages (max 35 chars). AM- prefix for DMSRES context. */
export function buildAmendFunctionalReferenceId(declarationId: string): string {
  const id = String(declarationId).replace(/[^a-z0-9]/gi, "");
  const uniq = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase().slice(-6);
  const maxIdLen = 35 - 3 - 1 - uniq.length;
  const idPart = id.length > maxIdLen ? id.slice(-maxIdLen) : id;
  return `AM-${idPart}-${uniq}`.slice(0, 35);
}

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

function buildDerivedItemPointers(wcoPath: string, itemSequence: number): string {
  const derived = deriveHeaderAmendment(wcoPath);
  if (!derived) {
    throw new Error(`No CDS WCO reference row for ${wcoPath}; cannot derive amendment pointers.`);
  }
  return derived.pointerSections
    .map((section, idx) => {
      const isLast = idx === derived.pointerSections.length - 1;
      const sequence = section === "68A" ? itemSequence : 1;
      return pointerXml(sequence, section, isLast ? derived.leafTagId : undefined);
    })
    .join("");
}

function buildDerivedHeaderPointers(pointerSections: string[], leafTagId: string): string {
  return pointerSections
    .map((section, idx) =>
      idx === pointerSections.length - 1
        ? pointerXml(1, section, leafTagId)
        : pointerXml(1, section),
    )
    .join("");
}

function amendmentBlock(changeReasonCode: string, pointers: string): string {
  return `
    <Amendment>
      <ChangeReasonCode>${xmlEscape(changeReasonCode)}</ChangeReasonCode>${pointers}
    </Amendment>`;
}

function amendmentPointers(change: AmendmentChange, seq: number): string {
  if (change.changeKind === "headerField") {
    return buildDerivedHeaderPointers(change.pointerSections, change.leafTagId);
  }

  if (change.changeKind === "itemChargeAmount") {
    return buildDerivedItemPointers(ITEM_CHARGE_WCO_PATH, seq);
  }

  return buildDerivedItemPointers(GROSS_MASS_WCO_PATH, seq);
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

function invoiceAmountFragment(currencyId: string, amount: string): string {
  const currency = currencyId.trim() || "GBP";
  return `
    <InvoiceAmount currencyID="${xmlEscape(currency)}">${xmlEscape(amount.trim())}</InvoiceAmount>`;
}

function declarationFragments(change: AmendmentChange, seq: number): string {
  return goodsShipmentFragment(change, seq);
}

function preAdditionalInformationFragment(change: AmendmentChange): string {
  if (change.changeKind !== "itemChargeAmount") {
    return "";
  }
  return invoiceAmountFragment(change.currencyId || "GBP", change.itemChargeAmount);
}

function aesAdditionalInformationBlock(statementDescription: string, amendmentSequence: number): string {
  return `
    <AdditionalInformation>
      <StatementDescription>${xmlEscape(statementDescription)}</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>${pointerXml(1, "42A")}${pointerXml(amendmentSequence, "06A")}
    </AdditionalInformation>`;
}

function additionalInformationBlocks(change: AmendmentChange): string {
  const text = change.statementDescription;
  if (change.changeKind === "itemChargeAmount") {
    // One AES block per Amendment (06A seq 1..n). TT_IM002b uses seq 1 for a single 06A.
    // Cancel evidence: CDS10001 on 03A/225 when a second 06A lacks a linked StatementDescription.
    return aesAdditionalInformationBlock(text, 1) + aesAdditionalInformationBlock(text, 2);
  }
  return aesAdditionalInformationBlock(text, 1);
}

function amendmentBlocks(change: AmendmentChange, seq: number): string {
  const reason = change.changeReasonCode;
  if (change.changeKind !== "itemChargeAmount") {
    return amendmentBlock(reason, amendmentPointers(change, seq));
  }

  const invoiceDerived = deriveHeaderAmendment(INVOICE_AMOUNT_WCO_PATH);
  if (!invoiceDerived) {
    throw new Error(`No CDS WCO reference row for ${INVOICE_AMOUNT_WCO_PATH}; cannot co-amend DE 4/11.`);
  }

  return (
    amendmentBlock(reason, amendmentPointers(change, seq)) +
    amendmentBlock(reason, buildDerivedHeaderPointers(invoiceDerived.pointerSections, invoiceDerived.leafTagId))
  );
}

export function buildAmendmentXmlFromChange(change: AmendmentChange): string {
  const seq = Math.max(1, change.itemSequence);
  const preAes = preAdditionalInformationFragment(change);
  const aesBlocks = additionalInformationBlocks(change);
  const amendments = amendmentBlocks(change, seq);
  const fragments = declarationFragments(change, seq);

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
    <TypeCode>COR</TypeCode>${preAes}${aesBlocks}${amendments}${fragments}
  </Declaration>
</MetaData>`;
}
