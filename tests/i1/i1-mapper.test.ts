import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapToCDS_I1, validateI1Declaration, H1_ONLY_FIELDS } from "../../src/lib/i1-mapper";
import { renderI1Xml } from "../../src/lib/i1-xml-renderer";

/**
 * Obligation source: docs/hmrc/specs/cds-api/appendix-21f-i1-obligations.md
 * (GOV.UK Appendix 21F).
 */

const baseDeclaration: Record<string, unknown> = {
  _id: "i1importdeclarationrecordid000001",
  route: "import",
  declarationCategory: "I1",
  declarationType: "C",
  lrn: "FC-I1TEST01",
  eori: "GB553202734852",
  importerEori: "GB553202734852",
  authorisationHolderEori: "GB553202734852",
  authorisationCategoryCode: "SDE",
  dispatchCountry: "DE",
  destinationCountry: "GB",
  // DE 3/1 is conditional on I1; declared here as an overseas Name + Address.
  exporterName: "Acme Export GmbH",
  exporterCity: "Hamburg",
  exporterLine: "1 Hafenstrasse",
  exporterPostcode: "20095",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transportId: "CSCL GLOBE",
  transportIdType: "11",
  invoiceCurrency: "GBP",
  invoiceTotal: 5000,
};

const baseItems: Record<string, unknown>[] = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "DE",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    valueAmount: 5000,
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 1,
    packageType: "PK",
    shippingMarks: "ACME-001",
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    additionalDocuments: [
      { CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "INV-2026-001" },
    ],
  },
];

function decl(overrides: Record<string, unknown> = {}) {
  return { ...baseDeclaration, ...overrides };
}

function items(overrides: Record<string, unknown> = {}) {
  return [{ ...baseItems[0], ...overrides }];
}

describe("validateI1Declaration — mandatory data elements", () => {
  it("accepts a complete I1 declaration", () => {
    assert.deepEqual(validateI1Declaration(decl(), baseItems), []);
  });

  it("rejects a declaration explicitly marked as an export", () => {
    const errors = validateI1Declaration(decl({ route: "export" }), baseItems);
    assert.ok(errors.some((e) => e.includes("I1 is an import data set")));
  });

  it("accepts a document-check route value such as \"Route 1\"", () => {
    assert.deepEqual(validateI1Declaration(decl({ route: "Route 1" }), baseItems), []);
  });

  // DE 1/2 selects the data set: only C and F are I1 C&F regular use.
  it("accepts DE 1/2 codes C and F", () => {
    for (const t of ["C", "F"]) {
      assert.deepEqual(validateI1Declaration(decl({ declarationType: t }), baseItems), []);
    }
  });

  it("rejects a DE 1/2 code that belongs to the H1 full data set", () => {
    const errors = validateI1Declaration(decl({ declarationType: "A" }), baseItems);
    assert.ok(errors.some((e) => e.includes("not valid for I1 C&F") && e.includes("H1")));
  });

  // Mandatory on I1, conditional on H1 — the authorisation is what permits the
  // reduced form at all.
  it("rejects a missing holder of the authorisation (DE 3/39)", () => {
    const errors = validateI1Declaration(decl({ authorisationHolderEori: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 3/39")));
  });

  // Mandatory on I1, conditional on H1.
  it("rejects an item with no documents (DE 2/3)", () => {
    const errors = validateI1Declaration(decl(), items({ additionalDocuments: [] }));
    assert.ok(errors.some((e) => e.includes("DE 2/3")));
  });

  it("rejects missing shipping marks (DE 6/11)", () => {
    const errors = validateI1Declaration(decl(), items({ shippingMarks: "" }));
    assert.ok(errors.some((e) => e.includes("DE 6/11")));
  });

  it("rejects missing package type (DE 6/9) and count (DE 6/10)", () => {
    assert.ok(validateI1Declaration(decl(), items({ packageType: "" })).some((e) => e.includes("DE 6/9")));
    assert.ok(validateI1Declaration(decl(), items({ packageCount: 0 })).some((e) => e.includes("DE 6/10")));
  });

  it("rejects missing declarant EORI (DE 3/18), location (DE 5/23) and transport mode (DE 7/4)", () => {
    assert.ok(validateI1Declaration(decl({ eori: "" }), baseItems).some((e) => e.includes("DE 3/18")));
    assert.ok(validateI1Declaration(decl({ locationId: "" }), baseItems).some((e) => e.includes("DE 5/23")));
    assert.ok(validateI1Declaration(decl({ transportMode: "" }), baseItems).some((e) => e.includes("DE 7/4")));
  });

  // Conditional on I1 though mandatory on H1 — must not be demanded here.
  it("does not demand DE 6/1 net mass, DE 6/14 commodity code, DE 5/8 or DE 5/14", () => {
    const errors = validateI1Declaration(
      decl({ destinationCountry: "", dispatchCountry: "" }),
      items({ netWeightKg: 0, commodityCode: "" }),
    );
    assert.deepEqual(errors, []);
  });

  it("rejects every H1-only data element", () => {
    for (const field of H1_ONLY_FIELDS) {
      const errors = validateI1Declaration(decl({ [field]: "X" }), baseItems);
      assert.ok(
        errors.some((e) => e.includes("not present on the I1 data set") && e.includes(field)),
        `${field} was not rejected`,
      );
    }
  });
});

describe("mapToCDS_I1 — payload shape", () => {
  it("throws when validation fails rather than emitting a partial payload", () => {
    assert.throws(() => mapToCDS_I1(decl({ authorisationHolderEori: "" }), baseItems), /DE 3\/39/);
  });

  it("emits an IM TypeCode carrying the C&F letter", () => {
    assert.equal((mapToCDS_I1(decl(), baseItems) as any).Declaration.TypeCode, "IMC");
    assert.equal(
      (mapToCDS_I1(decl({ declarationType: "F" }), baseItems) as any).Declaration.TypeCode,
      "IMF",
    );
  });

  it("emits DE 3/39 AuthorisationHolder", () => {
    const payload = mapToCDS_I1(decl(), baseItems) as any;
    assert.equal(payload.Declaration.AuthorisationHolder.ID, "GB553202734852");
    assert.equal(payload.Declaration.AuthorisationHolder.CategoryCode, "SDE");
  });

  // The four elements the H1 mapper emits unconditionally and I1 does not carry.
  it("omits DE 7/9 arrival transport, DE 8/5, DE 8/6 and DE 4/15", () => {
    const payload = mapToCDS_I1(decl(), baseItems) as any;
    const gs = payload.Declaration.GoodsShipment;
    assert.equal(gs.Consignment.ArrivalTransportMeans, undefined);
    assert.equal(gs.TransactionNatureCode, undefined);
    assert.equal(gs.GovernmentAgencyGoodsItem[0].StatisticalValueAmount, undefined);
    assert.equal(payload.Declaration.CurrencyExchange, undefined);
  });

  it("omits Buyer and Seller, which are not on the I1 data set", () => {
    const payload = mapToCDS_I1(decl(), baseItems) as any;
    const gs = payload.Declaration.GoodsShipment;
    assert.equal(gs.Buyer, undefined);
    assert.equal(gs.Seller, undefined);
  });

  it("omits net mass when not declared, and emits it when present", () => {
    const without = mapToCDS_I1(decl(), items({ netWeightKg: 0 })) as any;
    const measureless =
      without.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Commodity.GoodsMeasure;
    assert.equal(measureless.NetNetWeightMeasure, undefined);

    const with_ = mapToCDS_I1(decl(), baseItems) as any;
    const measure = with_.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Commodity.GoodsMeasure;
    assert.equal(measure.NetNetWeightMeasure, "110.000");
  });

  it("splits DE 1/10 and appends DE 1/11", () => {
    const payload = mapToCDS_I1(decl(), baseItems) as any;
    const procedures = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].GovernmentProcedure;
    assert.deepEqual(procedures[0], { CurrentCode: "40", PreviousCode: "00" });
    assert.deepEqual(procedures[1], { CurrentCode: "000" });
  });

  it("drops forbidden DE 2/3 document codes", () => {
    const payload = mapToCDS_I1(
      decl(),
      items({
        additionalDocuments: [
          { CategoryCode: "N", TypeCode: "935", ID: "INV-1" },
          { CategoryCode: "C", TypeCode: "512", ID: "AUTH-1" },
        ],
      }),
      { forbiddenDocCodes: ["C512"] },
    ) as any;
    const docs = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].AdditionalDocument;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].TypeCode, "935");
  });
});

describe("renderI1Xml", () => {
  const xml = renderI1Xml(mapToCDS_I1(baseDeclaration, baseItems));

  it("renders a WCO 3.6 DEC envelope with an IM TypeCode", () => {
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes("<TypeCode>IMC</TypeCode>"));
  });

  it("renders DE 3/39 and DE 2/3", () => {
    assert.ok(xml.includes("<AuthorisationHolder>"));
    assert.ok(xml.includes("<CategoryCode>SDE</CategoryCode>"));
    assert.ok(xml.includes("<AdditionalDocument>"));
  });

  it("omits the elements Appendix 21F does not carry", () => {
    assert.ok(!xml.includes("<ArrivalTransportMeans>"));
    assert.ok(!xml.includes("<TransactionNatureCode>"));
    assert.ok(!xml.includes("<StatisticalValueAmount"));
    assert.ok(!xml.includes("<CurrencyExchange>"));
    assert.ok(!xml.includes("<Buyer>"));
    assert.ok(!xml.includes("<Seller>"));
  });

  it("orders Declaration children per WCO_DEC_2_DMS.xsd", () => {
    const seq = [
      "FunctionCode",
      "FunctionalReferenceID",
      "TypeCode",
      "GoodsItemQuantity",
      "TotalGrossMassMeasure",
      "TotalPackageQuantity",
      "AuthorisationHolder",
      "BorderTransportMeans",
      "Declarant",
      "Exporter",
      "GoodsShipment",
    ];
    const positions = seq.map((t) => xml.search(new RegExp(`<${t}[ >]`)));
    positions.forEach((p, i) => {
      assert.ok(p > -1, `${seq[i]} missing`);
      if (i > 0) assert.ok(p > positions[i - 1], `${seq[i]} must follow ${seq[i - 1]}`);
    });
  });

  it("escapes XML metacharacters", () => {
    const hostile = renderI1Xml(
      mapToCDS_I1(baseDeclaration, items({ description: 'Widget & <script>' })),
    );
    assert.ok(hostile.includes("Widget &amp; &lt;script&gt;"));
    assert.ok(!hostile.includes("<script>"));
  });
});
