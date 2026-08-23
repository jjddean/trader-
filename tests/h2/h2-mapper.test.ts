import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  H2_APC_7100,
  H2_PROCEDURE_CODES,
  H2_WAREHOUSE_AUTHORISATION_MAP,
  H2_WAREHOUSE_TYPES,
  mapToCDS_H2,
  NOT_ON_H2_FIELDS,
  validateH2Declaration,
  warehouseIdentifierCountry,
} from "../../src/lib/h2-mapper";

/**
 * Obligations: docs/hmrc/specs/cds-api/appendix-21b-h2-obligations.md
 * Procedure:   docs/hmrc/customs-warehousing/declarations/procedure-71.md
 * Rules:       docs/hmrc/customs-warehousing/validation/h2-rules.json
 */

const RULES = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "docs/hmrc/customs-warehousing/validation/h2-rules.json"),
    "utf8",
  ),
) as { rules: { ruleId: string }[] };

const base: Record<string, unknown> = {
  _id: "h2warehousedeclarationrecord0001",
  route: "import",
  declarationCategory: "H2",
  declarationType: "IM",
  additionalDeclarationType: "A",
  lrn: "FC-H2TEST01",
  eori: "GB553202734852",
  importerEori: "GB553202734852",
  warehouseTypeCode: "U",
  warehouseIdentifier: "1234567GB",
  authorisationHolderEori: "GB553202734852",
  authorisationCategoryCode: "CWP",
  supervisingCustomsOffice: "GB000060",
  presentationOffice: "GB000060",
  dispatchCountry: "DE",
  destinationCountry: "GB",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transportId: "CSCL GLOBE",
  transportIdType: "11",
  transactionNatureCode: "11",
  invoiceCurrency: "GBP",
};

const baseItems: Record<string, unknown>[] = [
  {
    sequenceNumber: 1,
    procedureCode: "7100",
    additionalProcedureCode: "000",
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "DE",
    grossWeightKg: 120,
    packageCount: 4,
    packageType: "BX",
    shippingMarks: "ACME-1",
    statisticalValue: 5000,
    // Commodity 8471300000 requires DE 6/2 supplementary units.
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    additionalDocuments: [
      { CategoryCode: "C", TypeCode: "517", StatusCode: "AC", ID: "GBCWP12345" },
    ],
  },
];

function decl(o: Record<string, unknown> = {}) {
  return { ...base, ...o };
}
function items(o: Record<string, unknown> = {}) {
  return [{ ...baseItems[0], ...o }];
}

describe("H2 code sets match the specification pack", () => {
  it("carries the ten published 71-series codes", () => {
    assert.deepEqual([...H2_PROCEDURE_CODES], [
      "7100", "7110", "7121", "7122", "7123", "7151", "7153", "7154", "7171", "7178",
    ]);
  });

  it("permits only the four customs warehouse types on procedure 71", () => {
    assert.deepEqual([...H2_WAREHOUSE_TYPES], ["R", "S", "T", "U"]);
  });

  it("maps warehouse type to authorisation type and document code", () => {
    assert.equal(H2_WAREHOUSE_AUTHORISATION_MAP.U.authorisationTypeCode, "CWP");
    assert.equal(H2_WAREHOUSE_AUTHORISATION_MAP.U.documentCode, "C517");
    assert.equal(H2_WAREHOUSE_AUTHORISATION_MAP.R.authorisationTypeCode, "CW1");
    assert.equal(H2_WAREHOUSE_AUTHORISATION_MAP.S.documentCode, "C519");
  });

  it("references rules that exist in the pack", () => {
    const ids = new Set(RULES.rules.map((r) => r.ruleId));
    for (const id of ["H2-CAT-PROC", "H2-SAME-WAREHOUSE", "H2-NO-SUPPLEMENTARY", "H2-NO-VALUATION-BLOCK"]) {
      assert.ok(ids.has(id), `${id} missing from h2-rules.json`);
    }
  });
});

describe("warehouseIdentifierCountry", () => {
  it("reads the trailing country code", () => {
    assert.equal(warehouseIdentifierCountry("1234567GB"), "GB");
    assert.equal(warehouseIdentifierCountry("1234567XI"), "XI");
    assert.equal(warehouseIdentifierCountry("9999999FR"), "FR");
  });

  it("returns empty when there is no country suffix", () => {
    assert.equal(warehouseIdentifierCountry("1234567"), "");
    assert.equal(warehouseIdentifierCountry(""), "");
  });
});

describe("validateH2Declaration — mandatory elements", () => {
  it("accepts a complete H2", () => {
    assert.deepEqual(validateH2Declaration(decl(), baseItems), []);
  });

  it("rejects a declaration marked as an export", () => {
    assert.ok(
      validateH2Declaration(decl({ route: "export" }), baseItems)
        .some((e) => e.includes("H2 is an import data set")),
    );
  });

  it("accepts a document-check route value", () => {
    assert.deepEqual(validateH2Declaration(decl({ route: "Route 1" }), baseItems), []);
  });

  it("rejects a missing declarant EORI (DE 3/18)", () => {
    assert.ok(validateH2Declaration(decl({ eori: "" }), baseItems).some((e) => e.includes("DE 3/18")));
  });

  it("rejects missing DE 5/8, DE 5/14, DE 5/23, DE 7/4 and DE 8/5", () => {
    for (const [field, de] of [
      ["destinationCountry", "DE 5/8"],
      ["dispatchCountry", "DE 5/14"],
      ["locationId", "DE 5/23"],
      ["transportMode", "DE 7/4"],
      ["transactionNatureCode", "DE 8/5"],
    ] as const) {
      assert.ok(
        validateH2Declaration(decl({ [field]: "" }), baseItems).some((e) => e.includes(de)),
        `${de} not enforced`,
      );
    }
  });
});

describe("DE 2/7 — identification of warehouse", () => {
  it("requires both the type and the identifier", () => {
    assert.ok(validateH2Declaration(decl({ warehouseTypeCode: "" }), baseItems).some((e) => e.includes("DE 2/7")));
    assert.ok(validateH2Declaration(decl({ warehouseIdentifier: "" }), baseItems).some((e) => e.includes("DE 2/7")));
  });

  // Y and Z are in the wider DE 2/7 code list but are not customs warehouses.
  it("rejects warehouse types Y and Z", () => {
    for (const t of ["Y", "Z"]) {
      assert.ok(
        validateH2Declaration(decl({ warehouseTypeCode: t }), baseItems)
          .some((e) => e.includes("not valid on procedure 71")),
        `type ${t} should be rejected`,
      );
    }
  });

  it("bars types S and T from a GB or XI identifier", () => {
    for (const t of ["S", "T"]) {
      for (const c of ["GB", "XI"]) {
        const errs = validateH2Declaration(
          decl({ warehouseTypeCode: t, warehouseIdentifier: `1234567${c}`, authorisationCategoryCode: t === "S" ? "CW2" : "" }),
          baseItems,
        );
        assert.ok(errs.some((e) => e.includes("may not be used with a")), `${t} + ${c} should be rejected`);
      }
    }
  });

  it("allows type S with a non-GB identifier", () => {
    const errs = validateH2Declaration(
      decl({ warehouseTypeCode: "S", warehouseIdentifier: "1234567FR", authorisationCategoryCode: "CW2" }),
      baseItems,
    );
    assert.deepEqual(errs, []);
  });
});

describe("DE 3/39 — holder of the authorisation", () => {
  it("is mandatory on H2, unlike H1", () => {
    assert.ok(
      validateH2Declaration(decl({ authorisationHolderEori: "" }), baseItems)
        .some((e) => e.includes("DE 3/39")),
    );
  });

  it("rejects CW2 with a GB identifier", () => {
    assert.ok(
      validateH2Declaration(
        decl({ warehouseTypeCode: "S", warehouseIdentifier: "1234567GB", authorisationCategoryCode: "CW2" }),
        baseItems,
      ).some((e) => e.includes("CW2 cannot be used with GB or XI")),
    );
  });

  it("flags an authorisation type that contradicts the warehouse type", () => {
    assert.ok(
      validateH2Declaration(decl({ warehouseTypeCode: "U", authorisationCategoryCode: "CW1" }), baseItems)
        .some((e) => e.includes("expects authorisation type CWP")),
    );
  });
});

describe("DE 1/1 and DE 1/2", () => {
  it("accepts IM and CO", () => {
    assert.deepEqual(validateH2Declaration(decl({ declarationType: "IM" }), baseItems), []);
    assert.deepEqual(
      validateH2Declaration(decl({ declarationType: "CO" }), items({ additionalProcedureCode: "F15" })),
      [],
    );
  });

  it("requires F15 when the declaration type is CO", () => {
    assert.ok(
      validateH2Declaration(decl({ declarationType: "CO" }), baseItems)
        .some((e) => e.includes("F15")),
    );
  });

  it("accepts the six permitted additional declaration types", () => {
    for (const t of ["A", "C", "D", "F", "J", "K"]) {
      assert.deepEqual(validateH2Declaration(decl({ additionalDeclarationType: t }), baseItems), [], `type ${t}`);
    }
  });

  // The supplementary obligation is waived on entry — UCC 167(2)(a).
  it("rejects the supplementary types Y and Z with the reason", () => {
    for (const t of ["Y", "Z"]) {
      const errs = validateH2Declaration(decl({ additionalDeclarationType: t }), baseItems);
      assert.ok(errs.some((e) => e.includes("supplementary obligation is waived")), `type ${t}`);
    }
  });
});

describe("procedure and additional procedure codes", () => {
  it("requires every item to be a 71-series entry", () => {
    assert.ok(
      validateH2Declaration(decl(), items({ procedureCode: "4000" }))
        .some((e) => e.includes("must begin 71")),
    );
  });

  it("rejects an unpublished 71-series code", () => {
    assert.ok(
      validateH2Declaration(decl(), items({ procedureCode: "7199" }))
        .some((e) => e.includes("not a published 71-series")),
    );
  });

  it("accepts every published entry code", () => {
    for (const code of H2_PROCEDURE_CODES) {
      const apc = code === "7100" ? "000" : "000";
      assert.deepEqual(
        validateH2Declaration(decl(), items({ procedureCode: code, additionalProcedureCode: apc })),
        [],
        `code ${code}`,
      );
    }
  });

  it("checks the APC list for 7100", () => {
    for (const apc of H2_APC_7100) {
      const d = apc === "F15" ? decl({ declarationType: "CO" }) : decl();
      assert.deepEqual(validateH2Declaration(d, items({ additionalProcedureCode: apc })), [], `apc ${apc}`);
    }
    assert.ok(
      validateH2Declaration(decl(), items({ additionalProcedureCode: "9ZZ" }))
        .some((e) => e.includes("not valid with 7100")),
    );
  });
});

describe("item-level mandatory elements", () => {
  it("requires documents (DE 2/3), mandatory on H2 and conditional on H1", () => {
    assert.ok(
      validateH2Declaration(decl(), items({ additionalDocuments: [] })).some((e) => e.includes("DE 2/3")),
    );
  });

  it("requires the three packaging elements that are A on H2", () => {
    assert.ok(validateH2Declaration(decl(), items({ packageType: "" })).some((e) => e.includes("DE 6/9")));
    assert.ok(validateH2Declaration(decl(), items({ packageCount: 0 })).some((e) => e.includes("DE 6/10")));
    assert.ok(validateH2Declaration(decl(), items({ shippingMarks: "" })).some((e) => e.includes("DE 6/11")));
  });

  it("requires statistical value (DE 8/6)", () => {
    assert.ok(
      validateH2Declaration(decl(), items({ statisticalValue: 0, valueAmount: 0 }))
        .some((e) => e.includes("DE 8/6")),
    );
  });

  it("requires commodity code and gross mass", () => {
    assert.ok(validateH2Declaration(decl(), items({ commodityCode: "" })).some((e) => e.includes("DE 6/14")));
    assert.ok(validateH2Declaration(decl(), items({ grossWeightKg: 0 })).some((e) => e.includes("DE 6/5")));
  });
});

describe("the valuation block is not on H2", () => {
  it("rejects every field that belongs to H1 valuation or guarantees", () => {
    for (const field of NOT_ON_H2_FIELDS) {
      assert.ok(
        validateH2Declaration(decl({ [field]: "X" }), baseItems)
          .some((e) => e.includes("not present on the H2 data set") && e.includes(field)),
        `${field} was not rejected`,
      );
    }
  });
});

describe("mapToCDS_H2 — payload shape", () => {
  it("throws rather than emitting a partial payload", () => {
    assert.throws(() => mapToCDS_H2(decl({ warehouseTypeCode: "" }), baseItems), /DE 2\/7/);
  });

  it("emits DE 2/7 at header level, not per item", () => {
    const p = mapToCDS_H2(decl(), baseItems) as any;
    assert.equal(p.Declaration.GoodsShipment.Warehouse.ID, "1234567GB");
    assert.equal(p.Declaration.GoodsShipment.Warehouse.TypeCode, "U");
    assert.equal(p.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Warehouse, undefined);
  });

  it("emits DE 3/39 with the authorisation type", () => {
    const p = mapToCDS_H2(decl(), baseItems) as any;
    assert.equal(p.Declaration.AuthorisationHolder.ID, "GB553202734852");
    assert.equal(p.Declaration.AuthorisationHolder.CategoryCode, "CWP");
  });

  it("derives the authorisation type from the warehouse type when omitted", () => {
    const p = mapToCDS_H2(decl({ authorisationCategoryCode: "" }), baseItems) as any;
    assert.equal(p.Declaration.AuthorisationHolder.CategoryCode, "CWP");
  });

  // The point of the category: duty is suspended, so Group 4 is absent.
  it("omits the entire valuation and duty block", () => {
    const p = mapToCDS_H2(decl(), baseItems) as any;
    const gs = p.Declaration.GoodsShipment;
    const item = gs.GovernmentAgencyGoodsItem[0];
    assert.equal(gs.TradeTerms, undefined);
    assert.equal(item.CustomsValuation, undefined);
    assert.equal(item.Commodity.DutyTaxFee, undefined);
    assert.equal(item.Commodity.InvoiceLine, undefined);
    assert.equal(item.ValuationAdjustment, undefined);
  });

  it("omits net mass, which is not on the H2 data set", () => {
    const p = mapToCDS_H2(decl(), items({ netWeightKg: 100 })) as any;
    const measure = p.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Commodity.GoodsMeasure;
    assert.equal(measure.NetNetWeightMeasure, undefined);
    assert.equal(measure.GrossMassMeasure, "120.000");
  });

  it("emits statistical value in GBP", () => {
    const p = mapToCDS_H2(decl(), baseItems) as any;
    const sv = p.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].StatisticalValueAmount;
    assert.equal(sv.currencyID, "GBP");
    assert.equal(sv.value, "5000.00");
  });

  it("splits DE 1/10 and appends DE 1/11", () => {
    const p = mapToCDS_H2(decl(), baseItems) as any;
    const procs = p.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].GovernmentProcedure;
    assert.deepEqual(procs[0], { CurrentCode: "71", PreviousCode: "00" });
    assert.deepEqual(procs[1], { CurrentCode: "000" });
  });

  it("emits DE 5/27 when supplied and omits it when not", () => {
    assert.equal((mapToCDS_H2(decl(), baseItems) as any).Declaration.SupervisingOffice.ID, "GB000060");
    assert.equal(
      (mapToCDS_H2(decl({ supervisingCustomsOffice: "" }), baseItems) as any).Declaration.SupervisingOffice,
      undefined,
    );
  });

  it("sets ContainerCode from the container number", () => {
    assert.equal(
      (mapToCDS_H2(decl({ containerNumber: "MSKU1234567" }), baseItems) as any)
        .Declaration.GoodsShipment.Consignment.ContainerCode,
      "1",
    );
  });

  it("drops forbidden DE 2/3 document codes", () => {
    const p = mapToCDS_H2(
      decl(),
      items({
        additionalDocuments: [
          { CategoryCode: "C", TypeCode: "517", ID: "GBCWP12345" },
          { CategoryCode: "N", TypeCode: "935", ID: "INV-1" },
        ],
      }),
      { forbiddenDocCodes: ["N935"] },
    ) as any;
    const docs = p.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].AdditionalDocument;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].TypeCode, "517");
  });
});

describe("H2 routing at the submit boundary", () => {
  it("routes an explicit H2 to the warehousing data set", async () => {
    const { resolveDeclarationCategory, isH2WarehouseDeclaration } = await import(
      "../../src/lib/submit-category"
    );
    assert.equal(resolveDeclarationCategory({ declarationCategory: "H2" }), "H2");
    assert.equal(isH2WarehouseDeclaration({ declarationCategory: "h2" }), true);
    assert.equal(isH2WarehouseDeclaration({ declarationCategory: "H1" }), false);
  });

  it("leaves every other category on its existing path", async () => {
    const { resolveDeclarationCategory } = await import("../../src/lib/submit-category");
    assert.equal(resolveDeclarationCategory({}), "H1");
    assert.equal(resolveDeclarationCategory({ declarationCategory: "B1" }), "B1");
    assert.equal(resolveDeclarationCategory({ declarationCategory: "ZZ" }), "H1");
  });

  it("gates on DE 2/7 before the mapper runs", async () => {
    const { validateH2SubmitGate } = await import("../../src/lib/submit-category");
    assert.deepEqual(validateH2SubmitGate(base, baseItems), []);
    assert.ok(
      validateH2SubmitGate({ ...base, warehouseTypeCode: "" }, baseItems)
        .some((e) => e.includes("DE 2/7")),
    );
  });

  // The H1 gate demands an invoice currency; H2 declares no valuation at all.
  it("does not demand valuation data the H2 data set has no room for", async () => {
    const { validateH2SubmitGate } = await import("../../src/lib/submit-category");
    assert.deepEqual(validateH2SubmitGate({ ...base, invoiceCurrency: "" }, baseItems), []);
  });

  it("still enforces the shared DE 5/23 and DE 6/2 rules", async () => {
    const { validateH2SubmitGate } = await import("../../src/lib/submit-category");
    assert.ok(
      validateH2SubmitGate({ ...base, locationId: "", goodsLocationKind: "" }, baseItems)
        .some((e) => e.includes("DE 5/23")),
    );
    assert.ok(
      validateH2SubmitGate(base, [{ ...baseItems[0], supplementaryUnitQty: 0 }])
        .some((e) => e.includes("DE 6/2")),
    );
  });
});
