import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateCompleteness } from "../../convex/lib/declaration_completeness";
import {
  evaluateRules,
  resolveScenario,
  scenarioInputFromRecords,
  type RuleDefinition,
} from "../../convex/lib/rule_engine";
import { resolveCdsTypeCode } from "../../convex/lib/cds_type_code";
import { mapToCDS_H1 } from "../../src/lib/wco-mapper";
import { mapToCDS_B1 } from "../../src/lib/b1-mapper";
import { mapToCDS_C1 } from "../../src/lib/c1-mapper";
import { mapToCDS_I1 } from "../../src/lib/i1-mapper";

const h1Items = [
  {
    sequenceNumber: 1,
    commodityCode: "6109100010",
    description: "Cotton t-shirts",
    originCountry: "DE",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    valueAmount: 2500,
    valueCurrency: "GBP",
    grossWeightKg: 120,
    netWeightKg: 115,
    packageCount: 10,
    packageType: "CT",
    additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-2026-0001" }],
  },
];

function h1Declaration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: "kn7h1decltype01",
    eori: "GB531765313922",
    importerEori: "GB531765313922",
    declarationType: "H1",
    route: "import",
    destinationCountry: "GB",
    dispatchCountry: "DE",
    exporterName: "Acme Export GmbH",
    exporterCity: "Hamburg",
    exporterLine: "1 Hafenstrasse",
    exporterPostcode: "20095",
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
    ...overrides,
  };
}

function xmlTypeCode(declaration: Record<string, unknown>): string {
  return mapToCDS_H1(declaration, h1Items).Declaration.TypeCode;
}

function engineTypeCode(declaration: Record<string, unknown>): string {
  return resolveScenario(scenarioInputFromRecords(declaration, h1Items)).declarationType;
}

const imdOnlyRule: RuleDefinition = {
  ruleId: "TEST-IMD-ONLY",
  name: "synthetic IMD-only",
  description: "Test-only. Not a production rule.",
  severity: "blocking",
  enabled: true,
  triggerScope: { declarationTypes: ["IMD"] },
  effects: {
    requiredFields: [{ path: "declaration.dispatchCountry", reason: "IMD-only marker" }],
  },
};

describe("H1 DE 1/2 source of truth", () => {
  it("H1 import A: XML IMA and engine IMA", () => {
    const declaration = h1Declaration({ additionalDeclarationType: "A" });
    assert.equal(xmlTypeCode(declaration), "IMA");
    assert.equal(engineTypeCode(declaration), "IMA");
  });

  it("H1 import D: XML IMD and engine IMD", () => {
    const declaration = h1Declaration({ additionalDeclarationType: "D" });
    assert.equal(xmlTypeCode(declaration), "IMD");
    assert.equal(engineTypeCode(declaration), "IMD");
  });

  it("H1 export A: XML EXA and engine EXA", () => {
    const declaration = h1Declaration({ route: "export", additionalDeclarationType: "A" });
    assert.equal(xmlTypeCode(declaration), "EXA");
    assert.equal(engineTypeCode(declaration), "EXA");
  });

  it("H1 export D: XML EXD and engine EXD", () => {
    const declaration = h1Declaration({ route: "export", additionalDeclarationType: "D" });
    assert.equal(xmlTypeCode(declaration), "EXD");
    assert.equal(engineTypeCode(declaration), "EXD");
  });

  it("omitted additionalDeclarationType is empty-letter IMA, not category H1", () => {
    const declaration = h1Declaration();
    assert.equal(declaration.additionalDeclarationType, undefined);
    assert.equal(xmlTypeCode(declaration), "IMA");
    assert.equal(engineTypeCode(declaration), "IMA");
  });

  it("does not use declarationType H1 as the DE 1/2 letter", () => {
    const withD = h1Declaration({ declarationType: "H1", additionalDeclarationType: "D" });
    assert.equal(xmlTypeCode(withD), "IMD");
    assert.equal(engineTypeCode(withD), "IMD");

    const letterInCategoryOnly = h1Declaration({
      declarationType: "D",
      additionalDeclarationType: "",
    });
    assert.equal(xmlTypeCode(letterInCategoryOnly), "IMA");
    assert.equal(engineTypeCode(letterInCategoryOnly), "IMA");
  });

  it("invalid DE 1/2 does not silently become IMA or EXA", () => {
    assert.throws(() => resolveCdsTypeCode("H1", "import"), /Invalid additional declaration type/);
    assert.throws(() => resolveCdsTypeCode("Q", "import"), /Invalid additional declaration type/);
    assert.throws(
      () => xmlTypeCode(h1Declaration({ additionalDeclarationType: "H1" })),
      /Invalid additional declaration type/,
    );
    assert.throws(
      () => engineTypeCode(h1Declaration({ additionalDeclarationType: "Q" })),
      /Invalid additional declaration type/,
    );
    assert.throws(() => resolveCdsTypeCode("H1", "export"), /Invalid additional declaration type/);
  });

  it("submit, completeness, and validation_results construct the same type", () => {
    const declaration = h1Declaration({ additionalDeclarationType: "D" });
    const xml = xmlTypeCode(declaration);
    const engine = engineTypeCode(declaration);
    const completenessInput = scenarioInputFromRecords(declaration, h1Items);
    assert.equal(xml, "IMD");
    assert.equal(engine, "IMD");
    assert.equal(resolveScenario(completenessInput).declarationType, "IMD");
    const completeness = evaluateCompleteness({
      rules: [imdOnlyRule],
      declaration,
      items: h1Items,
    });
    assert.equal(completeness.ready, true);
  });
});

describe("synthetic IMD-only rule (not in rule_seed)", () => {
  it("applies for H1 additionalDeclarationType D and not for A", () => {
    const withD = scenarioInputFromRecords(
      h1Declaration({ additionalDeclarationType: "D" }),
      h1Items,
    );
    const withA = scenarioInputFromRecords(
      h1Declaration({ additionalDeclarationType: "A" }),
      h1Items,
    );
    const dResults = evaluateRules([imdOnlyRule], withD);
    const aResults = evaluateRules([imdOnlyRule], withA);
    assert.equal(dResults[0]?.status, "pass");
    assert.equal(aResults[0]?.status, "skip");
  });
});

describe("B1 C1 I1 TypeCode unchanged", () => {
  it("B1 additionalDeclarationType D → EXD", () => {
    const payload = mapToCDS_B1(
      {
        _id: "b1exportdeclarationrecordid000001",
        route: "export",
        declarationCategory: "B1",
        additionalDeclarationType: "D",
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
      },
      [
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
      ],
    ) as { Declaration: { TypeCode: string } };
    assert.equal(payload.Declaration.TypeCode, "EXD");
  });

  it("C1 additionalDeclarationType C → EXC", () => {
    const payload = mapToCDS_C1(
      {
        _id: "c1exportdeclarationrecordid000001",
        route: "export",
        declarationCategory: "C1",
        additionalDeclarationType: "C",
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
        containerNumber: "MSKU1234567",
        sealNumber: "SEAL-88213",
      },
      [
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
      ],
    ) as { Declaration: { TypeCode: string } };
    assert.equal(payload.Declaration.TypeCode, "EXC");
  });

  it("I1 additionalDeclarationType C → IMC", () => {
    const payload = mapToCDS_I1(
      {
        _id: "i1importdeclarationrecordid000001",
        route: "import",
        declarationCategory: "I1",
        additionalDeclarationType: "C",
        lrn: "FC-I1TEST01",
        eori: "GB553202734852",
        importerEori: "GB553202734852",
        authorisationHolderEori: "GB553202734852",
        authorisationCategoryCode: "SDE",
        dispatchCountry: "DE",
        destinationCountry: "GB",
        exporterName: "Acme Export GmbH",
        exporterCity: "Hamburg",
        exporterLine: "1 Hafenstrasse",
        exporterPostcode: "20095",
        locationId: "GBAUFXTFXTFXT",
        goodsLocationKind: "port",
        transportMode: "1",
        transportId: "MAERSK ESSEX",
        transportIdType: "11",
        invoiceCurrency: "GBP",
        invoiceTotal: 5000,
      },
      [
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
          additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-2026-001" }],
        },
      ],
    ) as { Declaration: { TypeCode: string } };
    assert.equal(payload.Declaration.TypeCode, "IMC");
  });
});
