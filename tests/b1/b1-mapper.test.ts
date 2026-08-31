import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADDITIONAL_DECLARATION_TYPES,
  IMPORT_ONLY_FIELDS,
  mapToCDS_B1,
  validateB1Declaration,
} from "../../src/lib/b1-mapper";
import { validateCdsCodeLists } from "../../src/lib/wco-mapper";

/**
 * Obligation source: docs/hmrc/specs/cds-api/appendix-22a-b1-obligations.md
 * (GOV.UK Appendix 22A, transcribed 2026-08-21).
 */

const baseDeclaration: Record<string, unknown> = {
  _id: "b1exportdeclarationrecordid000001",
  route: "export",
  declarationCategory: "B1",
  additionalDeclarationType: "A",
  lrn: "FC-B1TEST01",
  eori: "GB553202734852",
  exporterEori: "GB553202734852",
  destinationCountry: "US",
  dispatchCountry: "GB",
  customsOfficeOfExit: "GB000060",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transportId: "MAERSK ESSEX",
  transportIdType: "11",
  transactionNatureCode: "11",
  invoiceCurrency: "GBP",
  invoiceTotal: 12500,
  consigneeName: "Acme Inc",
  consigneeCity: "Newark",
  consigneeLine: "200 Dock Street",
  consigneePostcode: "07102",
  consigneeCountry: "US",
};

const baseItems: Record<string, unknown>[] = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "GB",
    procedureCode: "1000",
    additionalProcedureCode: "000",
    valueAmount: 12500,
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 4,
    packageType: "PK",
    shippingMarks: "ACME-001",
  },
];

function decl(overrides: Record<string, unknown> = {}) {
  return { ...baseDeclaration, ...overrides };
}

function items(overrides: Record<string, unknown> = {}) {
  return [{ ...baseItems[0], ...overrides }];
}

describe("validateB1Declaration — mandatory data elements", () => {
  it("accepts a complete B1 declaration", () => {
    assert.deepEqual(validateB1Declaration(decl(), baseItems), []);
  });

  it("rejects a declaration explicitly marked as an import", () => {
    const errors = validateB1Declaration(decl({ route: "import" }), baseItems);
    assert.ok(errors.some((e) => e.includes("B1 is an export data set")));
  });

  // The dashboard stores HMRC's document-check route here, not a direction.
  it("accepts a document-check route value such as \"Route 1\"", () => {
    assert.deepEqual(validateB1Declaration(decl({ route: "Route 1" }), baseItems), []);
  });

  it("rejects a C1 declaration routed to the B1 mapper", () => {
    const errors = validateB1Declaration(decl({ declarationCategory: "C1" }), baseItems);
    assert.ok(errors.some((e) => e.includes("C1 routed to the B1 mapper")));
  });

  // DE 5/12 is mandatory on B1 and has no import equivalent — the element the
  // superseded draft of Appendix 22A omitted entirely.
  it("rejects a missing customs office of exit (DE 5/12)", () => {
    const errors = validateB1Declaration(decl({ customsOfficeOfExit: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 5/12")));
  });

  it("rejects a missing declarant EORI (DE 3/18)", () => {
    const errors = validateB1Declaration(decl({ eori: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 3/18")));
  });

  it("rejects a missing country of destination (DE 5/8)", () => {
    const errors = validateB1Declaration(decl({ destinationCountry: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 5/8")));
  });

  it("rejects a missing goods location (DE 5/23)", () => {
    const errors = validateB1Declaration(decl({ locationId: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 5/23")));
  });

  it("rejects a missing mode of transport at the border (DE 7/4)", () => {
    const errors = validateB1Declaration(decl({ transportMode: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 7/4")));
  });

  it("rejects a missing transaction nature code (DE 8/5)", () => {
    const errors = validateB1Declaration(decl({ transactionNatureCode: "" }), baseItems);
    assert.ok(errors.some((e) => e.includes("DE 8/5")));
  });

  // DE 6/1 is A on B1 but D on H1 — the draft carried the import symbol across.
  it("rejects a missing net mass (DE 6/1), which is mandatory on B1", () => {
    const errors = validateB1Declaration(decl(), items({ netWeightKg: 0 }));
    assert.ok(errors.some((e) => e.includes("DE 6/1")));
  });

  it("rejects a missing gross mass (DE 6/5)", () => {
    const errors = validateB1Declaration(decl(), items({ grossWeightKg: undefined }));
    assert.ok(errors.some((e) => e.includes("DE 6/5")));
  });

  it("rejects a missing number of packages (DE 6/10)", () => {
    const errors = validateB1Declaration(decl(), items({ packageCount: 0 }));
    assert.ok(errors.some((e) => e.includes("DE 6/10")));
  });

  it("rejects a missing commodity code (DE 6/14)", () => {
    const errors = validateB1Declaration(decl(), items({ commodityCode: "" }));
    assert.ok(errors.some((e) => e.includes("DE 6/14")));
  });

  it("rejects a declaration with no goods items", () => {
    const errors = validateB1Declaration(decl(), []);
    assert.ok(errors.some((e) => e.includes("DE 1/6")));
  });

  it("rejects every import-only data element", () => {
    for (const field of IMPORT_ONLY_FIELDS) {
      const errors = validateB1Declaration(decl({ [field]: "X" }), baseItems);
      assert.ok(
        errors.some((e) => e.includes("Import-only") && e.includes(field)),
        `${field} was not rejected`,
      );
    }
  });
});

describe("mapToCDS_B1 — payload shape", () => {
  it("throws when validation fails rather than emitting a partial payload", () => {
    assert.throws(() => mapToCDS_B1(decl({ customsOfficeOfExit: "" }), baseItems), /DE 5\/12/);
  });

  it("emits an EX TypeCode, never IM", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    assert.equal(payload.Declaration.TypeCode, "EXA");
  });

  it("emits DE 5/12 as Declaration/ExitOffice/ID", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    assert.equal(payload.Declaration.ExitOffice.ID, "GB000060");
  });

  it("emits Consignee and never Importer", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    const gs = payload.Declaration.GoodsShipment;
    assert.equal(gs.Consignee.Name, "Acme Inc");
    assert.equal(gs.Consignee.Address.CountryCode, "US");
    assert.equal(gs.Importer, undefined);
  });

  // Export declares identity at departure. ArrivalTransportMeans is import-only.
  it("emits DepartureTransportMeans and never ArrivalTransportMeans", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    const consignment = payload.Declaration.GoodsShipment.Consignment;
    assert.equal(consignment.DepartureTransportMeans.ID, "MAERSKESSEX");
    assert.equal(consignment.ArrivalTransportMeans, undefined);
  });

  it("omits the import valuation and duty blocks entirely", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    const gs = payload.Declaration.GoodsShipment;
    const item = gs.GovernmentAgencyGoodsItem[0];
    assert.equal(gs.TradeTerms, undefined);
    assert.equal(item.CustomsValuation, undefined);
    assert.equal(item.Commodity.DutyTaxFee, undefined);
    assert.equal(item.Commodity.InvoiceLine, undefined);
    assert.equal(item.ValuationAdjustment, undefined);
  });

  it("keeps the exporter at header level only", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    assert.equal(payload.Declaration.Exporter.ID, "GB553202734852");
    assert.equal(payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Exporter, undefined);
  });

  it("declares an overseas exporter by name and address when no GB/XI EORI applies", () => {
    const payload = mapToCDS_B1(
      decl({
        exporterEori: "",
        exporterName: "Zentrum GmbH",
        exporterCity: "Hamburg",
        exporterLine: "1 Hafenstrasse",
        exporterPostcode: "20095",
        exporterCountry: "DE",
      }),
      baseItems,
    ) as any;
    assert.equal(payload.Declaration.Exporter.Name, "Zentrum GmbH");
    assert.equal(payload.Declaration.Exporter.Address.CountryCode, "DE");
  });

  it("splits DE 1/10 into current and previous procedure and appends DE 1/11", () => {
    const payload = mapToCDS_B1(decl(), baseItems) as any;
    const procedures = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].GovernmentProcedure;
    assert.deepEqual(procedures[0], { CurrentCode: "10", PreviousCode: "00" });
    assert.deepEqual(procedures[1], { CurrentCode: "000" });
  });

  it("emits DE 5/18 routing countries in declared order", () => {
    const payload = mapToCDS_B1(decl({ countriesOfRouting: ["FR", "ES"] }), baseItems) as any;
    assert.deepEqual(payload.Declaration.Consignment.Itinerary, [
      { SequenceNumeric: "1", RoutingCountryCode: "FR" },
      { SequenceNumeric: "2", RoutingCountryCode: "ES" },
    ]);
  });

  it("emits DE 7/18 seal under TransportEquipment", () => {
    const payload = mapToCDS_B1(decl({ sealNumber: "SEAL-88213" }), baseItems) as any;
    const te = payload.Declaration.GoodsShipment.Consignment.TransportEquipment;
    assert.equal(te.Seal.ID, "SEAL-88213");
  });

  it("sets ContainerCode to 1 when a container is declared", () => {
    // CDS12070 — a declared container mandates a seal.
    const payload = mapToCDS_B1(
      decl({ containerNumber: "MSKU1234567", sealNumber: "SEAL0099" }),
      baseItems,
    ) as any;
    assert.equal(payload.Declaration.GoodsShipment.Consignment.ContainerCode, "1");
  });

  it("clamps net mass to gross mass", () => {
    const payload = mapToCDS_B1(decl(), items({ netWeightKg: 500, grossWeightKg: 120 })) as any;
    const measure = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].Commodity.GoodsMeasure;
    assert.equal(measure.NetNetWeightMeasure, "120.000");
  });

  it("drops forbidden DE 2/3 document codes", () => {
    const payload = mapToCDS_B1(
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

describe("code-list validation is scoped to the data set", () => {
  /**
   * `previous_procedure_codes` is seeded from HMRC's *import*
   * previous-procedures file (convex/actions/cds_codes.ts). 1040 is a standard
   * permanent export, but "40" is not an import previous procedure, so
   * measuring a B1 against that list rejected a valid declaration.
   */
  it("does not check an export previous procedure against the import list", async () => {
    const asked: string[] = [];
    const lookup = async (listName: string, values: string[]) => {
      asked.push(listName);
      return listName === "previous_procedure_codes" ? values : [];
    };

    const payload = { Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: [{}] } } };
    const items = [{ procedureCode: "1040" }];

    const exportErrors = await validateCdsCodeLists(payload, items, lookup, { category: "B1" });
    assert.equal(
      asked.includes("previous_procedure_codes"),
      false,
      "the import previous-procedure list must not be consulted for an export data set",
    );
    assert.deepEqual(exportErrors, []);
  });

  it("still checks the previous procedure on an import data set", async () => {
    const lookup = async (listName: string, values: string[]) =>
      listName === "previous_procedure_codes" ? values : [];
    const payload = { Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: [{}] } } };
    const errors = await validateCdsCodeLists(payload, [{ procedureCode: "4000" }], lookup, {
      category: "H1",
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0].reason, /import-previous-procedures/);
  });

  it("still checks the requested procedure on both", async () => {
    const asked: string[] = [];
    const lookup = async (listName: string) => {
      asked.push(listName);
      return [];
    };
    const payload = { Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: [{}] } } };
    await validateCdsCodeLists(payload, [{ procedureCode: "1040" }], lookup, { category: "B1" });
    assert.ok(asked.includes("procedure_codes"));
  });
});

describe("DE 1/2 reaches the payload", () => {
  /**
   * `declarationType` on the declarations table holds the *category* ("H1"),
   * not DE 1/2. All three category mappers read it for the additional
   * declaration type, and `mapDeclarationType` silently falls back to "A" for
   * anything it does not recognise — so every B1 was emitted as EXA whatever
   * the user selected, and C1/I1 could never validate at all.
   *
   * These fixtures use the field names the app actually stores.
   */
  const asStored = (additionalDeclarationType: string) => ({
    ...baseDeclaration,
    declarationType: "H1",
    additionalDeclarationType,
  });

  it("emits EXD when the user selects D, not EXA", () => {
    const payload = mapToCDS_B1(asStored("D"), baseItems) as {
      Declaration: { TypeCode: string };
    };
    assert.equal(payload.Declaration.TypeCode, "EXD");
  });

  it("emits EXA when the user selects A", () => {
    const payload = mapToCDS_B1(asStored("A"), baseItems) as {
      Declaration: { TypeCode: string };
    };
    assert.equal(payload.Declaration.TypeCode, "EXA");
  });

  it("never reads the category as DE 1/2", () => {
    // "H1" is not a DE 1/2 code; it must be rejected, not silently become "A".
    const errors = validateB1Declaration(
      { ...baseDeclaration, declarationType: "H1", additionalDeclarationType: "" },
      baseItems,
    );
    assert.match(errors.join(" "), /additional declaration type \(DE 1\/2\)/i);
  });

  it("rejects a DE 1/2 code that is not in HMRC's list", () => {
    const errors = validateB1Declaration(asStored("Q"), baseItems);
    assert.match(errors.join(" "), /not a valid DE 1\/2 code/i);
  });

  it("accepts every published DE 1/2 code", () => {
    for (const code of ADDITIONAL_DECLARATION_TYPES) {
      assert.deepEqual(
        validateB1Declaration(asStored(code), baseItems),
        [],
        `DE 1/2 ${code} should be accepted`,
      );
    }
  });
});

describe("DE 3/1 exporter and DE 4/11 invoice total", () => {
  /**
   * The form's only exporter block was gated on `dispatchCountry !== GB`, an
   * import rule — on an export the goods leave GB, so DE 3/1 could never be
   * entered and the Exporter element was omitted from the payload entirely.
   * Nothing in validation objected.
   */
  it("rejects a declaration with no exporter at all", () => {
    const { exporterEori: _e, exporterName: _n, exporterCity: _c, exporterLine: _l,
            exporterPostcode: _p, ...withoutExporter } = baseDeclaration as Record<string, unknown>;
    const errors = validateB1Declaration(withoutExporter, baseItems);
    assert.match(errors.join(" "), /exporter \(DE 3\/1 \+ 3\/2\)/i);
  });

  it("accepts an exporter identified by EORI alone", () => {
    const { exporterName: _n, exporterCity: _c, exporterLine: _l, exporterPostcode: _p,
            ...eoriOnly } = baseDeclaration as Record<string, unknown>;
    assert.deepEqual(
      validateB1Declaration({ ...eoriOnly, exporterEori: "GB553202734852" }, baseItems),
      [],
    );
  });

  it("accepts an exporter identified by name and address", () => {
    const { exporterEori: _e, ...addressOnly } = baseDeclaration as Record<string, unknown>;
    assert.deepEqual(
      validateB1Declaration(
        {
          ...addressOnly,
          exporterName: "Acme Ltd",
          exporterLine: "1 Dock Road",
          exporterCity: "Dover",
          exporterPostcode: "CT17 9TF",
        },
        baseItems,
      ),
      [],
    );
  });

  it("rejects a half-complete address with no EORI", () => {
    const { exporterEori: _e, ...partial } = baseDeclaration as Record<string, unknown>;
    const errors = validateB1Declaration(
      { ...partial, exporterName: "Acme Ltd", exporterCity: "", exporterLine: "", exporterPostcode: "" },
      baseItems,
    );
    assert.match(errors.join(" "), /exporter \(DE 3\/1 \+ 3\/2\)/i);
  });

  it("sums the item values when DE 4/11 is left blank", () => {
    // The form promises "if empty, mapper sums from items". B1 used the field
    // directly and emitted 0.00 against a populated statistical value.
    const payload = mapToCDS_B1(
      { ...baseDeclaration, invoiceTotal: undefined },
      baseItems,
    ) as { Declaration: { InvoiceAmount: { value: string } } };
    const expected = baseItems.reduce(
      (sum, item) => sum + (parseFloat(String((item as Record<string, unknown>).valueAmount ?? "")) || 0),
      0,
    );
    assert.equal(payload.Declaration.InvoiceAmount.value, expected.toFixed(2));
    assert.notEqual(payload.Declaration.InvoiceAmount.value, "0.00");
  });

  it("uses an explicit DE 4/11 override when given", () => {
    const payload = mapToCDS_B1(
      { ...baseDeclaration, invoiceTotal: "9999.99" },
      baseItems,
    ) as { Declaration: { InvoiceAmount: { value: string } } };
    assert.equal(payload.Declaration.InvoiceAmount.value, "9999.99");
  });
});

describe("DE 3/1 and DE 3/2 are mutually exclusive", () => {
  /**
   * HMRC export completion guide, Group 3 (retrieved 2026-08-24):
   *   DE 3/2 "is mandatory where the Exporter holds an EORI"
   *   DE 3/1 "is only required where an EORI is not held" and
   *          "must be left blank where an EU or GB EORI is provided in DE 3/2"
   */
  const withExporter = (fields: Record<string, unknown>) => {
    const { exporterEori: _e, exporterName: _n, exporterCity: _c, exporterLine: _l,
            exporterPostcode: _p, ...rest } = baseDeclaration as Record<string, unknown>;
    return { ...rest, ...fields };
  };

  it("emits the EORI form alone, with no address", () => {
    const payload = mapToCDS_B1(
      withExporter({
        exporterEori: "GB553202734852",
        exporterName: "Acme Ltd",
        exporterLine: "1 Dock Road",
        exporterCity: "Dover",
        exporterPostcode: "CT17 9TF",
      }),
      baseItems,
    ) as { Declaration: { Exporter?: Record<string, unknown> } };
    assert.deepEqual(payload.Declaration.Exporter, { ID: "GB553202734852" });
  });

  it("emits name and address when no EORI is held", () => {
    const payload = mapToCDS_B1(
      withExporter({
        exporterName: "Acme Ltd",
        exporterLine: "1 Dock Road",
        exporterCity: "Dover",
        exporterPostcode: "CT17 9TF",
        exporterCountry: "GB",
      }),
      baseItems,
    ) as { Declaration: { Exporter?: { ID?: string; Name?: string } } };
    assert.equal(payload.Declaration.Exporter?.Name, "Acme Ltd");
    assert.equal(payload.Declaration.Exporter?.ID, undefined);
  });

  it("does not accept an EORI the mapper will ignore", () => {
    // An EU EORI passes no GB/XI check, so validation must demand the address
    // rather than letting the mapper omit the Exporter element entirely.
    const errors = validateB1Declaration(withExporter({ exporterEori: "FR12345678901" }), baseItems);
    assert.match(errors.join(" "), /exporter \(DE 3\/1 \+ 3\/2\)/i);
  });

  it("validation and mapping agree on every accepted form", () => {
    for (const fields of [
      { exporterEori: "GB553202734852" },
      { exporterEori: "XI553202734852" },
      { exporterName: "Acme Ltd", exporterLine: "1 Dock Road", exporterCity: "Dover", exporterPostcode: "CT17 9TF" },
    ]) {
      const decl = withExporter(fields);
      assert.deepEqual(validateB1Declaration(decl, baseItems), [], JSON.stringify(fields));
      const payload = mapToCDS_B1(decl, baseItems) as { Declaration: { Exporter?: unknown } };
      assert.ok(payload.Declaration.Exporter, `no Exporter emitted for ${JSON.stringify(fields)}`);
    }
  });
});

describe("CDS rejection of FC-MT7W5R6P, 24 Aug", () => {
  /**
   * Four faults CDS reported on the first export it validated. Codes and
   * meanings from docs/hmrc/specs/error-codes/cds-error-codes-2026-03-11.ods.
   */
  it("CDS12071 — gross mass is not declared at both header and item level", () => {
    const payload = mapToCDS_B1(baseDeclaration, baseItems) as {
      Declaration: Record<string, unknown> & {
        GoodsShipment: { GovernmentAgencyGoodsItem: Array<Record<string, unknown>> };
      };
    };
    assert.equal(payload.Declaration.TotalGrossMassMeasure, undefined);
    const item = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0] as {
      Commodity: { GoodsMeasure: { GrossMassMeasure?: string } };
    };
    assert.ok(item.Commodity.GoodsMeasure.GrossMassMeasure);
  });

  it("CDS12074 — self-representation carries AI 00400 at item level", () => {
    const payload = mapToCDS_B1(baseDeclaration, baseItems) as {
      Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: Array<Record<string, unknown>> } };
    };
    const [item] = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem;
    const ai = (item.AdditionalInformation ?? []) as Array<Record<string, string>>;
    assert.deepEqual(ai, [{ StatementCode: "00400", StatementDescription: "Exporter" }]);
  });

  it("CDS12074 — the statement is omitted when a representative is declared", () => {
    const payload = mapToCDS_B1(
      { ...baseDeclaration, representativeEori: "GB553202734852" },
      baseItems,
    ) as { Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: Array<Record<string, unknown>> } } };
    const [item] = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem;
    assert.equal(item.AdditionalInformation, undefined);
  });

  it("CDS77002 — every document carries a status code", () => {
    const withDoc = items({
      additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }],
    });
    const payload = mapToCDS_B1(baseDeclaration, withDoc) as {
      Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: Array<Record<string, unknown>> } };
    };
    const [item] = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem;
    const docs = (item.AdditionalDocument ?? []) as Array<Record<string, string>>;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].StatusCode, "AC");
  });

  it("CDS12070 — DE 7/18 is declared as NOSEALS when nothing is sealed", () => {
    // Export completion guide, Group 7: "When no seals are used: In Number of
    // seals, enter: 0 and In Seal Identifier, enter: NOSEALS". Omitting the
    // element is what CDS rejected.
    const payload = mapToCDS_B1({ ...baseDeclaration, sealNumber: "" }, baseItems) as {
      Declaration: { GoodsShipment: { Consignment: { TransportEquipment?: Record<string, unknown> } } };
    };
    const te = payload.Declaration.GoodsShipment.Consignment.TransportEquipment;
    assert.deepEqual(te?.Seal, { SequenceNumeric: "0", ID: "NOSEALS" });
  });

  it("CDS12070 — a declared seal is carried through", () => {
    const payload = mapToCDS_B1(
      { ...baseDeclaration, containerNumber: "MSKU1234567", sealNumber: "SEAL0099" },
      baseItems,
    ) as {
      Declaration: { GoodsShipment: { Consignment: { TransportEquipment?: Record<string, unknown> } } };
    };
    const te = payload.Declaration.GoodsShipment.Consignment.TransportEquipment;
    assert.deepEqual(te?.Seal, { SequenceNumeric: "1", ID: "SEAL0099" });
    assert.equal(te?.ID, "MSKU1234567");
  });
});
