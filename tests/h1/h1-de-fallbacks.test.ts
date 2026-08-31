import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderH1Xml } from "../../src/lib/h1-xml-renderer";
import { mapToCDS_H1 } from "../../src/lib/wco-mapper";
import { validateDeclaration } from "../../src/lib/submit-h1-gate";
import {
  commodityRequiresSupplementaryUnit,
  resolveSupplementaryUnitRequirement,
} from "../../src/lib/supplementary-units";
import { HMRC_MARKS_BREAK_BULK, HMRC_MARKS_LOOSE_BULK, HMRC_MARKS_UNPACKAGED } from "../../src/lib/h1-shipping-marks";

const declaration = {
  _id: "kn7h1defaults01",
  eori: "GB531765313922",
  importerEori: "GB531765313922",
  destinationCountry: "GB",
  dispatchCountry: "DE",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  invoiceCurrency: "GBP",
  invoiceTotal: 2500,
  incoterms: "CIF",
  incotermLocation: "Felixstowe",
  transactionNatureCode: "11",
  transportMode: "1",
  transportIdType: "11",
  transportId: "CSCL GLOBE",
  exporterName: "Acme Export GmbH",
  exporterCity: "Hamburg",
  exporterLine: "1 Hafenstrasse",
  exporterPostcode: "20095",
};

const item = {
  sequenceNumber: 1,
  commodityCode: "6109100010",
  description: "Cotton t-shirts",
  originCountry: "DE",
  procedureCode: "4000",
  additionalProcedureCode: "000",
  preferenceCode: "100",
  valueAmount: 2500,
  valueCurrency: "GBP",
  grossWeightKg: 120,
  netWeightKg: 115,
  shippingMarks: "CARTON-001",
  packageCount: 10,
  packageType: "CT",
  requiresSupplementaryUnit: false,
  additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-2026-0001" }],
};

function mappedItem(overrides: Record<string, unknown> = {}) {
  return mapToCDS_H1(declaration, [{ ...item, ...overrides }]).Declaration
    .GoodsShipment.GovernmentAgencyGoodsItem[0];
}

describe("H1 DE 4/17 preference", () => {
  it("does not invent 100 when preference is blank", () => {
    assert.throws(
      () => mapToCDS_H1(declaration, [{ ...item, preferenceCode: "" }]),
      /missing preference \(DE 4\/17\)/,
    );
    const xml = renderH1Xml({
      Declaration: {
        FunctionCode: "9",
        FunctionalReferenceID: "FC-TEST",
        TypeCode: "IMA",
        GoodsItemQuantity: 1,
        TotalGrossMassMeasure: "1.000",
        TotalPackageQuantity: 1,
        GoodsShipment: {
          GovernmentAgencyGoodsItem: [{
            SequenceNumeric: 1,
            StatisticalValueAmount: { currencyID: "GBP", value: "1.00" },
            Commodity: {
              Description: "x",
              DutyTaxFee: [{ TypeCode: "A00" }],
              GoodsMeasure: { GrossMassMeasure: "1.000", NetNetWeightMeasure: "1.000" },
            },
            Packaging: { SequenceNumeric: "1", QuantityQuantity: "1", TypeCode: "CT" },
          }],
        },
      },
    });
    assert.doesNotMatch(xml, /<DutyRegimeCode>100<\/DutyRegimeCode>/);
  });

  it("keeps an explicit 100", () => {
    const mapped = mappedItem({ preferenceCode: "100" });
    assert.equal(
      (mapped.Commodity.DutyTaxFee[0] as { DutyRegimeCode?: string }).DutyRegimeCode,
      "100",
    );
    const xml = renderH1Xml(mapToCDS_H1(declaration, [item]));
    assert.match(xml, /<DutyRegimeCode>100<\/DutyRegimeCode>/);
  });
});

describe("H1 DE 1/11 additional procedure", () => {
  it("does not invent 000 when APC is missing", () => {
    assert.throws(
      () => mapToCDS_H1(declaration, [{ ...item, additionalProcedureCode: "" }]),
      /missing additional procedure \(DE 1\/11\)/,
    );
  });

  it("keeps explicit 4000 + 000", () => {
    const mapped = mappedItem({ procedureCode: "4000", additionalProcedureCode: "000" });
    assert.deepEqual(mapped.GovernmentProcedure, [
      { CurrentCode: "40", PreviousCode: "00" },
      { CurrentCode: "000" },
    ]);
  });
});

describe("H1 DE 6/2 supplementary units", () => {
  it("reports unknown instead of treating it as not required", () => {
    assert.equal(commodityRequiresSupplementaryUnit("8471300000"), false);
    assert.equal(resolveSupplementaryUnitRequirement({}), "unknown");
    const missing = validateDeclaration(declaration, [{
      ...item,
      commodityCode: "8471300000",
      requiresSupplementaryUnit: undefined,
      supplementaryUnitQty: "",
    }]);
    assert.ok(missing.some((e) => e.includes("cannot be determined") && e.includes("8471300000")));
    assert.throws(
      () => mapToCDS_H1(declaration, [{
        ...item,
        commodityCode: "8471300000",
        requiresSupplementaryUnit: undefined,
      }]),
      /cannot be determined/,
    );
  });

  it("does not require DE 6/2 when the tariff requirement is known not to apply", () => {
    const missing = validateDeclaration(declaration, [{
      ...item,
      commodityCode: "8471300000",
      requiresSupplementaryUnit: false,
      supplementaryUnitQty: "",
    }]);
    assert.equal(missing.some((e) => e.includes("DE 6/2")), false);
  });

  it("requires DE 6/2 for any commodity once the tariff requirement is known", () => {
    assert.equal(
      commodityRequiresSupplementaryUnit("6109100010", { requiresSupplementaryUnit: true }),
      true,
    );
    const missing = validateDeclaration(declaration, [{
      ...item,
      commodityCode: "6109100010",
      requiresSupplementaryUnit: true,
      supplementaryUnitQty: "",
    }]);
    assert.ok(missing.some((e) => e.includes("DE 6/2") && e.includes("6109100010")));
  });
});

describe("H1 DE 6/11 shipping marks", () => {
  it("does not invent N/A for blank marks", () => {
    assert.throws(
      () => mapToCDS_H1(declaration, [{ ...item, shippingMarks: "" }]),
      /missing shipping marks \(DE 6\/11\)/,
    );
    assert.throws(
      () => mapToCDS_H1(declaration, [{ ...item, shippingMarks: "N/A" }]),
      /missing shipping marks \(DE 6\/11\)/,
    );
  });

  it("emits HMRC-prescribed packaging marks", () => {
    const unpackaged = renderH1Xml(mapToCDS_H1(declaration, [{
      ...item,
      shippingMarks: "",
      packageType: "NE",
    }]));
    assert.match(unpackaged, new RegExp(`<MarksNumbersID>${HMRC_MARKS_UNPACKAGED}</MarksNumbersID>`));

    const loose = renderH1Xml(mapToCDS_H1(declaration, [{
      ...item,
      shippingMarks: HMRC_MARKS_LOOSE_BULK,
    }]));
    assert.match(loose, new RegExp(`<MarksNumbersID>${HMRC_MARKS_LOOSE_BULK}</MarksNumbersID>`));

    const bulk = renderH1Xml(mapToCDS_H1(declaration, [{
      ...item,
      shippingMarks: HMRC_MARKS_BREAK_BULK,
    }]));
    assert.match(bulk, new RegExp(`<MarksNumbersID>${HMRC_MARKS_BREAK_BULK}</MarksNumbersID>`));
  });

  it("omits marks on GB supplementary Y/Z and does not fabricate a packaging block", () => {
    const payload = mapToCDS_H1(
      { ...declaration, additionalDeclarationType: "Y" },
      [{ ...item, shippingMarks: "" }],
    );
    assert.equal(
      (payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Packaging[0] as { MarksNumbersID?: string }).MarksNumbersID,
      undefined,
    );
    const xml = renderH1Xml({
      Declaration: {
        FunctionCode: "9",
        FunctionalReferenceID: "FC-TEST",
        TypeCode: "IMY",
        GoodsItemQuantity: 1,
        TotalGrossMassMeasure: "1.000",
        TotalPackageQuantity: 1,
        GoodsShipment: {
          GovernmentAgencyGoodsItem: [{
            SequenceNumeric: 1,
            StatisticalValueAmount: { currencyID: "GBP", value: "1.00" },
            Commodity: {
              Description: "x",
              DutyTaxFee: [{ DutyRegimeCode: "100", TypeCode: "A00" }],
              GoodsMeasure: { GrossMassMeasure: "1.000", NetNetWeightMeasure: "1.000" },
            },
          }],
        },
      },
    });
    assert.doesNotMatch(xml, /<MarksNumbersID>N\/A<\/MarksNumbersID>/);
    assert.doesNotMatch(xml, /<TypeCode>PK<\/TypeCode>/);
  });
});

describe("H1 DE 4/11 invoice total", () => {
  it("omits DE 4/11 when invoice total is blank", () => {
    const payload = mapToCDS_H1({ ...declaration, invoiceTotal: "" }, [item]);
    assert.equal(payload.Declaration.InvoiceAmount, undefined);
    const xml = renderH1Xml(payload);
    assert.doesNotMatch(xml, /<InvoiceAmount/);
  });

  it("rejects a supplied total that does not match the DE 4/14 item sum", () => {
    assert.throws(
      () => mapToCDS_H1({ ...declaration, invoiceTotal: 999 }, [item]),
      /must equal the sum of item prices \(DE 4\/14\)/,
    );
  });

  it("does not replace numeric 0 through ||", () => {
    assert.throws(
      () => mapToCDS_H1({ ...declaration, invoiceTotal: 0 }, [item]),
      /must equal the sum of item prices \(DE 4\/14\)/,
    );
    const zeroItem = { ...item, valueAmount: 0 };
    const payload = mapToCDS_H1({ ...declaration, invoiceTotal: 0 }, [zeroItem]);
    assert.equal(payload.Declaration.InvoiceAmount?.value, "0.00");
    const xml = renderH1Xml(payload);
    assert.match(xml, /<InvoiceAmount currencyID="GBP">0\.00<\/InvoiceAmount>/);
  });
});
