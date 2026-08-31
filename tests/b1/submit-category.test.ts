import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isB1ExportDeclaration,
  isI1ImportDeclaration,
  resolveDeclarationCategory,
  validateB1SubmitGate,
  validateI1SubmitGate,
} from "../../src/lib/submit-category";

/**
 * Covers the submit-route wiring: which data set a declaration is routed to,
 * and which pre-mapper gate runs. The route itself needs Clerk + Convex, so the
 * decision logic lives in src/lib/submit-category.ts to keep it testable.
 */

const b1Lane: Record<string, unknown> = {
  route: "export",
  declarationCategory: "B1",
  additionalDeclarationType: "A",
  eori: "GB553202734852",
  exporterEori: "GB553202734852",
  destinationCountry: "US",
  customsOfficeOfExit: "GB000060",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transactionNatureCode: "11",
};

const b1Items: Record<string, unknown>[] = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    procedureCode: "1000",
    additionalProcedureCode: "000",
    valueAmount: 12500,
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 4,
    packageType: "PK",
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    requiresSupplementaryUnit: true,
  },
];

describe("resolveDeclarationCategory — routing", () => {
  it("routes an explicit B1 to the export data set", () => {
    assert.equal(resolveDeclarationCategory({ declarationCategory: "B1" }), "B1");
    assert.equal(isB1ExportDeclaration({ declarationCategory: "b1" }), true);
    assert.equal(isB1ExportDeclaration({ declarationCategory: " B1 " }), true);
  });

  it("routes an explicit I1 to the simplified import data set", () => {
    assert.equal(resolveDeclarationCategory({ declarationCategory: "I1" }), "I1");
    assert.equal(isI1ImportDeclaration({ declarationCategory: "i1" }), true);
    assert.equal(isB1ExportDeclaration({ declarationCategory: "I1" }), false);
  });

  // Existing rows carry no category and must keep taking the H1 path.
  it("routes everything else to the H1 full import data set", () => {
    assert.equal(resolveDeclarationCategory({}), "H1");
    assert.equal(resolveDeclarationCategory({ declarationCategory: "" }), "H1");
    assert.equal(resolveDeclarationCategory({ declarationCategory: "ZZ" }), "H1");
    assert.equal(resolveDeclarationCategory(null), "H1");
    assert.equal(resolveDeclarationCategory(undefined), "H1");
    // route alone must not flip the data set — category is the switch.
    assert.equal(resolveDeclarationCategory({ route: "export" }), "H1");
    assert.equal(resolveDeclarationCategory({ route: "import" }), "H1");
  });
});

describe("validateI1SubmitGate — simplified import obligations at the route boundary", () => {
  const i1Lane: Record<string, unknown> = {
    route: "import",
    declarationCategory: "I1",
    additionalDeclarationType: "C",
    eori: "GB553202734852",
    authorisationHolderEori: "GB553202734852",
    locationId: "GBAUFXTFXTFXT",
    goodsLocationKind: "port",
    transportMode: "1",
  };
  const i1Items: Record<string, unknown>[] = [
    {
      sequenceNumber: 1,
      commodityCode: "8471300000",
      description: "Portable automatic data processing machine",
      procedureCode: "4000",
      additionalProcedureCode: "000",
      grossWeightKg: 120,
      packageCount: 1,
      packageType: "PK",
      shippingMarks: "ACME-001",
      supplementaryUnitQty: 10,
      supplementaryUnitCode: "NAR",
      requiresSupplementaryUnit: true,
      additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }],
    },
  ];

  it("passes a complete I1 lane", () => {
    assert.deepEqual(validateI1SubmitGate(i1Lane, i1Items), []);
  });

  it("blocks a missing authorisation holder (DE 3/39) before the mapper runs", () => {
    const errors = validateI1SubmitGate({ ...i1Lane, authorisationHolderEori: "" }, i1Items);
    assert.ok(errors.some((e) => e.includes("DE 3/39")));
  });

  it("blocks an item with no documents (DE 2/3), which the H1 gate treats as optional", () => {
    const errors = validateI1SubmitGate(i1Lane, [{ ...i1Items[0], additionalDocuments: [] }]);
    assert.ok(errors.some((e) => e.includes("DE 2/3")));
  });

  // The H1 gate requires DE 8/5; I1 does not carry it at all.
  it("does not demand DE 8/5 transaction nature, and rejects it if supplied", () => {
    assert.deepEqual(validateI1SubmitGate(i1Lane, i1Items), []);
    const errors = validateI1SubmitGate({ ...i1Lane, transactionNatureCode: "11" }, i1Items);
    assert.ok(errors.some((e) => e.includes("not present on the I1 data set")));
  });

  it("does not demand DE 6/1 net mass or DE 5/8 destination, both conditional on I1", () => {
    assert.deepEqual(validateI1SubmitGate(i1Lane, i1Items), []);
  });

  it("still enforces the shared DE 5/23 and DE 6/2 rules", () => {
    assert.ok(
      validateI1SubmitGate({ ...i1Lane, locationId: "", goodsLocationKind: "" }, i1Items)
        .some((e) => e.includes("DE 5/23")),
    );
    assert.ok(
      validateI1SubmitGate(i1Lane, [{
        ...i1Items[0],
        supplementaryUnitQty: 0,
        requiresSupplementaryUnit: true,
      }]).some((e) => e.includes("DE 6/2")),
    );
  });
});

describe("validateB1SubmitGate — export obligations at the route boundary", () => {
  it("passes a complete B1 lane", () => {
    assert.deepEqual(validateB1SubmitGate(b1Lane, b1Items), []);
  });

  // The defect the H1 gate had: DE 5/12 was never checked before mapping.
  it("blocks a missing customs office of exit (DE 5/12) before the mapper runs", () => {
    const errors = validateB1SubmitGate({ ...b1Lane, customsOfficeOfExit: "" }, b1Items);
    assert.ok(errors.some((e) => e.includes("DE 5/12")));
  });

  it("blocks a missing net mass (DE 6/1), which the H1 gate does not check", () => {
    const errors = validateB1SubmitGate(b1Lane, [{ ...b1Items[0], netWeightKg: 0 }]);
    assert.ok(errors.some((e) => e.includes("DE 6/1")));
  });

  // The H1 gate demanded these; B1 does not have them.
  it("does not demand DE 5/14 dispatch country, which is conditional on B1", () => {
    const errors = validateB1SubmitGate({ ...b1Lane, dispatchCountry: "" }, b1Items);
    assert.deepEqual(errors, []);
  });

  it("does not demand DE 7/9 transport identity, which does not exist on B1", () => {
    const errors = validateB1SubmitGate({ ...b1Lane, transportId: "", transportIdType: "" }, b1Items);
    assert.deepEqual(errors, []);
  });

  it("does not demand item origin (DE 5/15), which is conditional on B1", () => {
    const errors = validateB1SubmitGate(b1Lane, [{ ...b1Items[0], originCountry: "" }]);
    assert.deepEqual(errors, []);
  });

  it("does not demand an invoice currency at the gate", () => {
    const errors = validateB1SubmitGate({ ...b1Lane, invoiceCurrency: "" }, b1Items);
    assert.deepEqual(errors, []);
  });

  it("still enforces the shared DE 5/23 goods-location rules", () => {
    const errors = validateB1SubmitGate({ ...b1Lane, locationId: "", goodsLocationKind: "" }, b1Items);
    assert.ok(errors.some((e) => e.includes("DE 5/23")));
  });

  it("still enforces DE 6/2 supplementary units when the tariff requirement is known", () => {
    const errors = validateB1SubmitGate(b1Lane, [{
      ...b1Items[0],
      supplementaryUnitQty: 0,
      requiresSupplementaryUnit: true,
    }]);
    assert.ok(errors.some((e) => e.includes("DE 6/2")));
  });

  it("reports unknown DE 6/2 instead of treating 8471300000 as a hard-coded exception", () => {
    const { requiresSupplementaryUnit: _flag, ...withoutFlag } = b1Items[0];
    const unknown = validateB1SubmitGate(b1Lane, [{ ...withoutFlag, supplementaryUnitQty: 0 }]);
    assert.ok(unknown.some((e) => e.includes("cannot be determined") && e.includes("8471300000")));
    const knownNotRequired = validateB1SubmitGate(b1Lane, [{
      ...b1Items[0],
      requiresSupplementaryUnit: false,
      supplementaryUnitQty: 0,
    }]);
    assert.equal(knownNotRequired.some((e) => e.includes("DE 6/2")), false);
  });

  it("rejects import-only fields reaching the export gate", () => {
    const errors = validateB1SubmitGate({ ...b1Lane, importerEori: "GB553202734852" }, b1Items);
    assert.ok(errors.some((e) => e.includes("Import-only") && e.includes("importerEori")));
  });
});
