import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type GoodsItemFormRow,
  buildExtractedDocuments,
  itemErrors,
  looksLikeConvexId,
  mapGoodsItem,
  slotsToValidDocs,
} from "../src/lib/declaration-items-form";

function row(overrides: Partial<GoodsItemFormRow> = {}): GoodsItemFormRow {
  return {
    key: "new-1",
    description: "Cotton t-shirts",
    commodityCode: "6109100010",
    originCountry: "CN",
    valueAmount: "1000",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    grossWeightKg: "12",
    netWeightKg: "10",
    supplementaryUnitQty: "4",
    packageCount: "1",
    packageType: "CT",
    shippingMarks: "NIL",
    docs: [
      { code: "N935", ref: "INV-1" },
      { code: "N271", ref: "PL-1" },
    ],
    ...overrides,
  };
}

describe("items form — field errors", () => {
  it("accepts a complete row", () => {
    assert.deepEqual(itemErrors(row()), {});
  });

  it("requires a ten-digit commodity code", () => {
    assert.equal(itemErrors(row({ commodityCode: "" })).commodityCode, "Commodity code is required.");
    assert.equal(itemErrors(row({ commodityCode: "8471" })).commodityCode, "Ten digits.");
  });

  it("requires a two-letter origin", () => {
    assert.equal(itemErrors(row({ originCountry: "" })).originCountry, "Origin is required.");
    assert.equal(itemErrors(row({ originCountry: "CHN" })).originCountry, "Two-letter code.");
  });

  it("requires a numeric value and a procedure code and gross weight", () => {
    assert.equal(itemErrors(row({ valueAmount: "" })).valueAmount, "Value is required.");
    assert.equal(itemErrors(row({ valueAmount: "n/a" })).valueAmount, "Must be a number.");
    assert.equal(itemErrors(row({ procedureCode: "" })).procedureCode, "Procedure code is required.");
    assert.equal(itemErrors(row({ grossWeightKg: "" })).grossWeightKg, "Gross weight is required.");
  });
});

describe("items form — DE 2/3 slots", () => {
  it("saves N935 and N271 with category split from the code", () => {
    assert.deepEqual(
      slotsToValidDocs([
        { code: "N935", ref: "INV-B1-260824-01" },
        { code: "N271", ref: "PL-B1-260824-01" },
      ]),
      [
        { CategoryCode: "N", TypeCode: "935", ID: "INV-B1-260824-01", StatusCode: "" },
        { CategoryCode: "N", TypeCode: "271", ID: "PL-B1-260824-01", StatusCode: "" },
      ],
    );
  });

  it("keeps only the first slot of each document code", () => {
    const docs = slotsToValidDocs([
      { code: "N935", ref: "FIRST" },
      { code: "N935", ref: "SECOND" },
      { code: "N271", ref: "PL-1" },
    ]);
    assert.equal(docs.length, 2);
    assert.equal(docs[0]?.ID, "FIRST");
    assert.equal(docs[1]?.ID, "PL-1");
  });

  it("does not send a reference of Excluded", () => {
    assert.deepEqual(
      slotsToValidDocs([
        { code: "N935", ref: "Excluded" },
        { code: "N271", ref: "PL-1" },
      ]),
      [{ CategoryCode: "N", TypeCode: "271", ID: "PL-1", StatusCode: "" }],
    );
  });

  it("sets CHED status XW on N853", () => {
    assert.equal(
      slotsToValidDocs([{ code: "N853", ref: "CHED-1" }])[0]?.StatusCode,
      "XW",
    );
  });
});

describe("items form — hydrate and AI documents", () => {
  it("maps stored documents into two slots", () => {
    const mapped = mapGoodsItem(
      {
        _id: "abcdefghijklmnopqrst",
        description: "Widget",
        originCountry: "cn",
        additionalDocuments: [
          { CategoryCode: "N", TypeCode: "935", ID: "INV-1" },
          { categoryCode: "N", typeCode: "271", id: "PL-1" },
        ],
      },
      0,
    );
    assert.equal(mapped.key, "abcdefghijklmnopqrst");
    assert.equal(mapped.originCountry, "CN");
    assert.deepEqual(mapped.docs, [
      { code: "N935", ref: "INV-1" },
      { code: "N271", ref: "PL-1" },
    ]);
  });

  it("builds N935 and N271 from extracted invoice references", () => {
    assert.deepEqual(
      buildExtractedDocuments({ invoiceNo: "INV-42", packingListRef: "PACK-42" }),
      [
        { CategoryCode: "N", TypeCode: "935", ID: "INV-42" },
        { CategoryCode: "N", TypeCode: "271", ID: "PACK-42" },
      ],
    );
  });

  it("treats a 20-character lowercase id as a persisted goods item", () => {
    assert.equal(looksLikeConvexId("abcdefghijklmnopqrst"), true);
    assert.equal(looksLikeConvexId("new-1"), false);
  });
});
