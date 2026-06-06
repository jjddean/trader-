import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAmendmentXmlFromChange } from "../../src/lib/hmrc-amendment-xml";
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
    assert.match(xml, /<TypeCode>COR<\/TypeCode>/);
    assert.match(xml, /<ItemChargeAmount currencyID="GBP">8000.00<\/ItemChargeAmount>/);
    assert.match(xml, /<TagID>112<\/TagID>/);
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
