import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAmendFunctionalReferenceId,
  buildAmendmentXmlFromChange,
} from "../../src/lib/hmrc-amendment-xml";
import { deriveHeaderAmendment } from "../../src/lib/hmrc-amendment-pointers";

describe("HMRC amendment XML", () => {
  it("builds TT_IM002b item charge amount amend", () => {
    const xml = buildAmendmentXmlFromChange({
      changeKind: "itemChargeAmount",
      amendLrn: "AM-test",
      mrn: "26GB664W3BLIFZFAR4",
      statementDescription: "Amending item price as a mistake was made on the declaration.",
      changeReasonCode: "21",
      itemSequence: 1,
      itemChargeAmount: "8000.00",
      currencyId: "GBP",
    });
    assert.match(xml, /<TypeCode>COR<\/TypeCode>\s*<InvoiceAmount currencyID="GBP">8000.00<\/InvoiceAmount>/);
    assert.match(xml, /<ItemChargeAmount currencyID="GBP">8000.00<\/ItemChargeAmount>/);
    assert.match(xml, /<TagID>112<\/TagID>/);
    assert.equal((xml.match(/<Amendment>/g) || []).length, 2);
    assert.equal((xml.match(/<AdditionalInformation>/g) || []).length, 2);
    assert.match(xml, /<DocumentSectionCode>06A<\/DocumentSectionCode>/);
    assert.match(xml, /<SequenceNumeric>2<\/SequenceNumeric>[\s\S]*<DocumentSectionCode>06A<\/DocumentSectionCode>/);
    assert.match(xml, /<DocumentSectionCode>42A<\/DocumentSectionCode>\s*<TagID>109<\/TagID>/);
    assert.doesNotMatch(xml, /<GoodsShipment>[\s\S]*<InvoiceAmount/);
  });

  it("builds gross mass amend fragment", () => {
    const xml = buildAmendmentXmlFromChange({
      changeKind: "grossMass",
      amendLrn: "AM-test",
      mrn: "26GB664W3BLIFZFAR4",
      statementDescription: "Correcting gross mass.",
      changeReasonCode: "21",
      itemSequence: 1,
      grossMassKg: "150.5",
    });
    assert.match(xml, /<GrossMassMeasure unitCode="KGM">150.5<\/GrossMassMeasure>/);
    assert.match(xml, /<DocumentSectionCode>65A<\/DocumentSectionCode>\s*<TagID>126<\/TagID>/);
    assert.doesNotMatch(xml, /<DocumentSectionCode>126<\/DocumentSectionCode>/);
  });

  it("builds unique amend functional reference ids within 35 chars", () => {
    const longId = "kn7cnkqjng3yb206ayn22hy36x88fnfj";
    const a = buildAmendFunctionalReferenceId(longId);
    const b = buildAmendFunctionalReferenceId(longId);
    assert.ok(a.startsWith("AM-"));
    assert.ok(a.length <= 35);
    assert.ok(b.length <= 35);
    assert.notEqual(a, b);
  });

  it("derives DE 4/11 InvoiceAmount pointers from the spec table", () => {
    const derived = deriveHeaderAmendment("Declaration/InvoiceAmount");
    assert.ok(derived);
    assert.deepEqual(derived!.pointerSections, ["42A"]);
    assert.equal(derived!.leafTagId, "109");
    assert.equal(derived!.dec, "4/11");
  });

  it("derives gross mass pointer chain with GoodsMeasure 65A and TagID 126", () => {
    const derived = deriveHeaderAmendment(
      "Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/GoodsMeasure/GrossMassMeasure",
    );
    assert.ok(derived);
    assert.deepEqual(derived!.pointerSections, ["42A", "67A", "68A", "23A", "65A"]);
    assert.equal(derived!.leafTagId, "126");
    assert.equal(derived!.dec, "6/5");
  });

  it("derivation reproduces the HMRC-validated item-charge pointer chain", () => {
    const derived = deriveHeaderAmendment(
      "Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/InvoiceLine/ItemChargeAmount",
    );
    assert.ok(derived);
    // Matches the hardcoded TT_IM002b chain: 42A,67A,68A,23A,79A + TagID 112.
    assert.deepEqual(derived!.pointerSections, ["42A", "67A", "68A", "23A", "79A"]);
    assert.equal(derived!.leafTagId, "112");
    assert.equal(derived!.dec, "4/14");
  });

  it("derives DE 8/5 header TransactionNatureCode pointers from the spec table", () => {
    const derived = deriveHeaderAmendment("Declaration/GoodsShipment/TransactionNatureCode");
    assert.ok(derived);
    assert.deepEqual(derived!.pointerSections, ["42A", "67A"]);
    assert.equal(derived!.leafTagId, "103");
    assert.equal(derived!.dec, "8/5");
    assert.deepEqual(derived!.fragmentPath, ["GoodsShipment", "TransactionNatureCode"]);
  });

  it("builds a header-level amendment with derived pointers and nested fragment", () => {
    const derived = deriveHeaderAmendment("Declaration/GoodsShipment/TransactionNatureCode");
    assert.ok(derived);
    const xml = buildAmendmentXmlFromChange({
      changeKind: "headerField",
      amendLrn: "AM-test",
      mrn: "26GB664W3BLIFZFAR4",
      statementDescription: "Amending nature of transaction.",
      changeReasonCode: "21",
      itemSequence: 1,
      pointerSections: derived!.pointerSections,
      leafTagId: derived!.leafTagId,
      fragmentPath: derived!.fragmentPath,
      value: "11",
    });
    assert.match(xml, /<TypeCode>COR<\/TypeCode>/);
    assert.match(xml, /<DocumentSectionCode>67A<\/DocumentSectionCode>\s*<TagID>103<\/TagID>/);
    assert.match(xml, /<GoodsShipment><TransactionNatureCode>11<\/TransactionNatureCode><\/GoodsShipment>/);
  });

  it("returns null for an unknown WCO path", () => {
    assert.equal(deriveHeaderAmendment("Declaration/GoodsShipment/NotARealField"), null);
  });
});
