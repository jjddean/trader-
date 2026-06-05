import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateGoodsItemSequences } from "../../src/lib/submit-goods-items";
import { mapToCDS_H1 } from "../../src/lib/wco-mapper";
import { renderH1Xml } from "../../src/lib/h1-xml-renderer";

describe("multi-item submit validation", () => {
  it("accepts contiguous unique sequences", () => {
    assert.deepEqual(
      validateGoodsItemSequences([{ sequenceNumber: 1 }, { sequenceNumber: 2 }]),
      [],
    );
  });

  it("rejects duplicate sequences", () => {
    assert.match(
      validateGoodsItemSequences([{ sequenceNumber: 1 }, { sequenceNumber: 1 }]).join(" "),
      /unique/,
    );
  });

  it("maps two items into H1 XML", () => {
    const declaration = {
      _id: "kn7multiitemtest01",
      eori: "GB531765313922",
      importerEori: "GB531765313922",
      destinationCountry: "GB",
      dispatchCountry: "DE",
      locationId: "GBAUFXTFXTFXT",
      goodsLocationKind: "port",
      invoiceCurrency: "GBP",
      transportMode: "1",
      transportIdType: "11",
      transportId: "CSCL GLOBE",
    };
    const items = [
      {
        sequenceNumber: 1,
        commodityCode: "6109100010",
        description: "Cotton t-shirts",
        originCountry: "DE",
        procedureCode: "4000",
        additionalProcedureCode: "000",
        valueAmount: 1000,
        valueCurrency: "GBP",
        grossWeightKg: 60,
        netWeightKg: 58,
        packageCount: 1,
        packageType: "PK",
      },
      {
        sequenceNumber: 2,
        commodityCode: "6109100010",
        description: "Cotton t-shirts pack 2",
        originCountry: "DE",
        procedureCode: "4000",
        additionalProcedureCode: "000",
        valueAmount: 1500,
        valueCurrency: "GBP",
        grossWeightKg: 60,
        netWeightKg: 57,
        packageCount: 1,
        packageType: "PK",
      },
    ];
    const xml = renderH1Xml(mapToCDS_H1(declaration, items));
    const itemBlocks = xml.match(/<GovernmentAgencyGoodsItem>/g) ?? [];
    assert.equal(itemBlocks.length, 2);
  });
});
