import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enrichExtractedLine } from "../../src/lib/invoice-extract-enrichment";

describe("invoice extraction enrichment", () => {
  it("normalizes explicitly extracted invoice and customs values", () => {
    const result = enrichExtractedLine(
      {
        commodityCode: "8471300000",
        description: "Portable computer",
        originCountry: "cn",
        valueAmount: "1250.50",
        valueCurrency: "usd",
        grossWeightKg: "12.5",
        netWeightKg: 10,
        supplementaryUnitQty: "4",
        procedureCode: "4000",
        additionalProcedureCode: "000",
        packageCount: "2",
        packageType: "ct",
        shippingMarks: "BOX-1",
        invoiceReference: " INV-42 ",
        packingListReference: " PACK-42 ",
      },
    );

    assert.deepEqual(result, {
      commodityCode: "8471300000",
      description: "Portable computer",
      originCountry: "CN",
      valueAmount: 1250.5,
      valueCurrency: "USD",
      grossWeightKg: 12.5,
      netWeightKg: 10,
      supplementaryUnitQty: 4,
      supplementaryUnitCode: "NAR",
      procedureCode: "4000",
      additionalProcedureCode: "000",
      packageCount: 2,
      packageType: "CT",
      shippingMarks: "BOX-1",
      additionalDocuments: [
        {
          CategoryCode: "N",
          TypeCode: "935",
          StatusCode: "AC",
          ID: "INV-42",
        },
        {
          CategoryCode: "N",
          TypeCode: "271",
          StatusCode: "AC",
          ID: "PACK-42",
        },
      ],
    });
  });

  it("leaves missing customs facts missing for a sparse line", () => {
    const result = enrichExtractedLine({ description: "Spare parts" });

    assert.deepEqual(result, {
      description: "Spare parts",
    });
  });

  it("copies explicitly supplied procedure and packaging values", () => {
    const result = enrichExtractedLine(
      {
        description: "Export goods",
        procedureCode: "1000",
        additionalProcedureCode: "000",
        packageCount: "3",
        packageType: "bx",
        shippingMarks: "EXPORT-3",
      },
    );

    assert.deepEqual(result, {
      description: "Export goods",
      procedureCode: "1000",
      additionalProcedureCode: "000",
      packageCount: 3,
      packageType: "BX",
      shippingMarks: "EXPORT-3",
    });
  });

  it("omits invalid non-positive numbers and irrelevant supplementary quantity", () => {
    const result = enrichExtractedLine(
      {
        commodityCode: "6109100010",
        valueAmount: 0,
        grossWeightKg: -1,
        netWeightKg: "not-a-number",
        quantity: 5,
      },
    );

    assert.deepEqual(result, {
      commodityCode: "6109100010",
    });
  });

  it("uses the supplied invoice number when extraction has no invoice number", () => {
    const result = enrichExtractedLine(
      { description: "Invoice line" },
      { invoiceNumber: "INV-FALLBACK" },
    );

    assert.deepEqual(result.additionalDocuments, [
      {
        CategoryCode: "N",
        TypeCode: "935",
        StatusCode: "AC",
        ID: "INV-FALLBACK",
      },
    ]);
  });

  it("falls back to the supplied invoice number when extraction returns a blank value", () => {
    const result = enrichExtractedLine(
      { invoiceNumber: "   " },
      { invoiceNumber: "INV-FALLBACK" },
    );

    assert.deepEqual(result.additionalDocuments, [
      {
        CategoryCode: "N",
        TypeCode: "935",
        StatusCode: "AC",
        ID: "INV-FALLBACK",
      },
    ]);
  });
});
