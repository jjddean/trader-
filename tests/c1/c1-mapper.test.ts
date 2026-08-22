import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapToCDS_C1, validateC1Declaration, NOT_ON_C1_FIELDS } from "../../src/lib/c1-mapper";
import { renderC1Xml } from "../../src/lib/c1-xml-renderer";
import { resolveDeclarationCategory, validateC1SubmitGate } from "../../src/lib/submit-category";

/**
 * Obligation source: docs/hmrc/specs/cds-api/appendix-22d-c1-obligations.md
 * (GOV.UK Appendix 22D).
 */

const baseDeclaration: Record<string, unknown> = {
  _id: "c1exportdeclarationrecordid000001",
  route: "export",
  declarationCategory: "C1",
  declarationType: "C",
  lrn: "FC-C1TEST01",
  eori: "GB553202734852",
  exporterEori: "GB553202734852",
  authorisationHolderEori: "GB553202734852",
  authorisationCategoryCode: "SDE",
  destinationCountry: "US",
  customsOfficeOfExit: "GB000060",
  presentationOffice: "GB000060",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  invoiceCurrency: "GBP",
  invoiceTotal: 12500,
  consigneeName: "Acme Inc",
  consigneeCity: "Newark",
  consigneeLine: "200 Dock Street",
  consigneePostcode: "07102",
  consigneeCountry: "US",
  containerId: "MSKU1234567",
  sealNumber: "SEAL-88213",
};

const baseItems: Record<string, unknown>[] = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "GB",
    procedureCode: "1000",
    additionalProcedureCode: "000",
    netWeightKg: 110,
    grossWeightKg: 120,
    packageCount: 4,
    packageType: "PK",
    shippingMarks: "ACME-001",
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "INV-1" }],
  },
];

function decl(overrides: Record<string, unknown> = {}) {
  return { ...baseDeclaration, ...overrides };
}
function items(overrides: Record<string, unknown> = {}) {
  return [{ ...baseItems[0], ...overrides }];
}

describe("validateC1Declaration — mandatory data elements", () => {
  it("accepts a complete C1 declaration", () => {
    assert.deepEqual(validateC1Declaration(decl(), baseItems), []);
  });

  it("rejects a declaration explicitly marked as an import", () => {
    assert.ok(
      validateC1Declaration(decl({ route: "import" }), baseItems)
        .some((e) => e.includes("C1 is an export data set")),
    );
  });

  it("accepts a document-check route value such as \"Route 1\"", () => {
    assert.deepEqual(validateC1Declaration(decl({ route: "Route 1" }), baseItems), []);
  });

  it("accepts DE 1/2 codes C and F only", () => {
    for (const t of ["C", "F"]) {
      assert.deepEqual(validateC1Declaration(decl({ declarationType: t }), baseItems), []);
    }
    assert.ok(
      validateC1Declaration(decl({ declarationType: "A" }), baseItems)
        .some((e) => e.includes("not valid for C1 C&F") && e.includes("B1")),
    );
  });

  it("rejects a missing holder of the authorisation (DE 3/39)", () => {
    assert.ok(
      validateC1Declaration(decl({ authorisationHolderEori: "" }), baseItems)
        .some((e) => e.includes("DE 3/39")),
    );
  });

  it("rejects a missing customs office of exit (DE 5/12)", () => {
    assert.ok(
      validateC1Declaration(decl({ customsOfficeOfExit: "" }), baseItems)
        .some((e) => e.includes("DE 5/12")),
    );
  });

  it("rejects missing DE 2/3, DE 6/9, DE 6/10 and DE 6/11 at item level", () => {
    assert.ok(validateC1Declaration(decl(), items({ additionalDocuments: [] })).some((e) => e.includes("DE 2/3")));
    assert.ok(validateC1Declaration(decl(), items({ packageType: "" })).some((e) => e.includes("DE 6/9")));
    assert.ok(validateC1Declaration(decl(), items({ packageCount: 0 })).some((e) => e.includes("DE 6/10")));
    assert.ok(validateC1Declaration(decl(), items({ shippingMarks: "" })).some((e) => e.includes("DE 6/11")));
  });

  // Mandatory on B1, absent or conditional on C1.
  it("does not demand DE 6/5 gross mass or DE 6/14 commodity code", () => {
    assert.deepEqual(
      validateC1Declaration(decl(), items({ grossWeightKg: 0, commodityCode: "" })),
      [],
    );
  });

  it("rejects every element not on the C1 data set", () => {
    for (const field of NOT_ON_C1_FIELDS) {
      assert.ok(
        validateC1Declaration(decl({ [field]: "X" }), baseItems)
          .some((e) => e.includes("not present on the C1 data set") && e.includes(field)),
        `${field} was not rejected`,
      );
    }
  });
});

describe("mapToCDS_C1 — payload shape", () => {
  it("emits an EX TypeCode carrying the C&F letter", () => {
    assert.equal((mapToCDS_C1(decl(), baseItems) as any).Declaration.TypeCode, "EXC");
    assert.equal(
      (mapToCDS_C1(decl({ declarationType: "F" }), baseItems) as any).Declaration.TypeCode,
      "EXF",
    );
  });

  it("emits DE 5/12 and the mandatory DE 3/39", () => {
    const p = mapToCDS_C1(decl(), baseItems) as any;
    assert.equal(p.Declaration.ExitOffice.ID, "GB000060");
    assert.equal(p.Declaration.AuthorisationHolder.ID, "GB553202734852");
  });

  // The eleven elements B1 carries and C1 does not.
  it("omits every element absent from the C1 data set", () => {
    const p = mapToCDS_C1(decl(), baseItems) as any;
    const d = p.Declaration;
    const gs = d.GoodsShipment;
    const item = gs.GovernmentAgencyGoodsItem[0];
    assert.equal(d.TotalGrossMassMeasure, undefined, "DE 6/5");
    assert.equal(d.TotalPackageQuantity, undefined, "DE 6/18");
    assert.equal(d.CurrencyExchange, undefined, "DE 4/15");
    assert.equal(gs.TransactionNatureCode, undefined, "DE 8/5");
    assert.equal(gs.ExportCountry, undefined, "DE 5/14");
    assert.equal(gs.Consignment.DepartureTransportMeans, undefined, "DE 7/7");
    assert.equal(item.StatisticalValueAmount, undefined, "DE 8/6");
    assert.equal(item.Commodity.GoodsMeasure.GrossMassMeasure, undefined, "DE 6/5");
    assert.equal(d.BorderTransportMeans.ID, undefined, "DE 7/14");
    assert.equal(d.BorderTransportMeans.RegistrationNationalityCode, undefined, "DE 7/15");
    assert.equal(gs.Importer, undefined);
    assert.equal(gs.TradeTerms, undefined);
  });

  it("keeps DE 7/2 container indicator and DE 7/18 seal", () => {
    const p = mapToCDS_C1(decl(), baseItems) as any;
    const consignment = p.Declaration.GoodsShipment.Consignment;
    assert.equal(consignment.ContainerCode, "1");
    assert.equal(consignment.TransportEquipment.Seal.ID, "SEAL-88213");
  });

  it("throws rather than emitting a partial payload", () => {
    assert.throws(() => mapToCDS_C1(decl({ authorisationHolderEori: "" }), baseItems), /DE 3\/39/);
  });
});

describe("renderC1Xml", () => {
  const xml = renderC1Xml(mapToCDS_C1(baseDeclaration, baseItems));

  it("renders an EXC envelope with DE 5/12 and DE 3/39", () => {
    assert.ok(xml.includes("<TypeCode>EXC</TypeCode>"));
    assert.ok(xml.includes("<ExitOffice>"));
    assert.ok(xml.includes("<AuthorisationHolder>"));
  });

  it("omits the elements Appendix 22D does not carry", () => {
    for (const tag of [
      "TotalGrossMassMeasure",
      "TotalPackageQuantity",
      "CurrencyExchange",
      "TransactionNatureCode",
      "ExportCountry",
      "DepartureTransportMeans",
      "StatisticalValueAmount",
      "GrossMassMeasure",
      "Importer",
      "TradeTerms",
    ]) {
      assert.ok(!xml.includes(`<${tag}`), `${tag} must not be rendered on a C1`);
    }
  });

  it("emits no empty elements", () => {
    assert.ok(!/<([A-Za-z][\w]*)\s*>\s*<\/\1>/.test(xml), "empty tag would fail the XML preflight");
  });

  it("escapes XML metacharacters", () => {
    const hostile = renderC1Xml(
      mapToCDS_C1({ ...baseDeclaration, consigneeName: 'A & <B>' }, baseItems),
    );
    assert.ok(hostile.includes("A &amp; &lt;B&gt;"));
  });
});

describe("C1 routing", () => {
  it("routes an explicit C1 to the simplified export data set", () => {
    assert.equal(resolveDeclarationCategory({ declarationCategory: "C1" }), "C1");
    assert.equal(resolveDeclarationCategory({ declarationCategory: "c1" }), "C1");
  });

  it("gates at the route boundary", () => {
    assert.deepEqual(validateC1SubmitGate(baseDeclaration, baseItems), []);
    assert.ok(
      validateC1SubmitGate({ ...baseDeclaration, customsOfficeOfExit: "" }, baseItems)
        .some((e) => e.includes("DE 5/12")),
    );
    assert.ok(
      validateC1SubmitGate({ ...baseDeclaration, locationId: "", goodsLocationKind: "" }, baseItems)
        .some((e) => e.includes("DE 5/23")),
    );
  });
});
