import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAmendmentXmlFromChange } from "../../src/lib/hmrc-amendment-xml";

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
});
