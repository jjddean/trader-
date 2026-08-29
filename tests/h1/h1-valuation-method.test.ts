import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  H1_SUPPORTED_VALUATION_METHOD,
  resolveH1Valuation,
  resolveH1ValuationMethodCode,
} from "../../convex/lib/h1_valuation";
import { evaluateCompleteness } from "../../convex/lib/declaration_completeness";
import {
  evaluateRules,
  resolveScenario,
  scenarioInputFromRecords,
  type RuleDefinition,
} from "../../convex/lib/rule_engine";
import { mapToCDS_H1, validateTradeTerms } from "../../src/lib/wco-mapper";
import { renderH1Xml } from "../../src/lib/h1-xml-renderer";

const invMethod1N935: RuleDefinition = {
  ruleId: "INV-METHOD1-N935",
  name: "Method 1 valuation requires N935 (commercial invoice)",
  description: "DE 4/16 = 1 requires N935",
  severity: "blocking",
  enabled: true,
  triggerScope: { valuationMethods: ["1"] },
  effects: {
    requiredDocuments: [
      { code: "N935", reason: "Commercial invoice required for Method 1 transaction value." },
    ],
  },
};

const h1ValuationMethod1Only: RuleDefinition = {
  ruleId: "H1-VALUATION-METHOD1-ONLY",
  name: "H1 currently supports valuation Method 1 only",
  description: "SPV/SIV and missing Method 1 confirmation",
  severity: "blocking",
  enabled: true,
  triggerScope: {},
  effects: {
    predicates: [{ name: "H1_VALUATION_FILEABLE" }],
  },
};

const rules = [h1ValuationMethod1Only, invMethod1N935];

const n935Docs = [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }];

function h1Declaration(overrides: Record<string, unknown> = {}) {
  return {
    _id: "kn7h1valuationmethod1",
    eori: "GB531765313922",
    importerEori: "GB531765313922",
    declarationType: "H1",
    route: "import",
    destinationCountry: "GB",
    dispatchCountry: "DE",
    locationId: "GBAUFXTFXTFXT",
    goodsLocationKind: "port",
    invoiceCurrency: "GBP",
    invoiceTotal: 5000,
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
    ...overrides,
  };
}

function h1Items(overrides: Record<string, unknown> = {}) {
  return [
    {
      sequenceNumber: 1,
      commodityCode: "6109100010",
      description: "Cotton t-shirts",
      originCountry: "DE",
      procedureCode: "4000",
      additionalProcedureCode: "000",
      valueAmount: 5000,
      valueCurrency: "GBP",
      grossWeightKg: 120,
      netWeightKg: 115,
      shippingMarks: "CARTON-001",
      packageCount: 10,
      packageType: "CT",
      additionalDocuments: n935Docs,
      ...overrides,
    },
  ];
}

function mappedMethodCode(declaration: Record<string, unknown>, items: Array<Record<string, unknown>>) {
  const payload = mapToCDS_H1(declaration, items);
  return payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].CustomsValuation.MethodCode;
}

describe("H1 Method 1 valuation policy", () => {
  it("1. supported H1: engine method and XML MethodCode are 1", () => {
    const declaration = h1Declaration();
    const items = h1Items();
    const scenario = resolveScenario(scenarioInputFromRecords(declaration, items));
    const xml = renderH1Xml(mapToCDS_H1(declaration, items));

    assert.deepEqual(scenario.valuationMethods, [H1_SUPPORTED_VALUATION_METHOD]);
    assert.equal(mappedMethodCode(declaration, items), "1");
    assert.match(xml, /<CustomsValuation>\s*<MethodCode>1<\/MethodCode>\s*<\/CustomsValuation>/);
  });

  it("2. engine and XML use the same resolved method", () => {
    const declaration = h1Declaration();
    const items = h1Items();
    const method = resolveH1ValuationMethodCode(declaration, items);
    const scenario = resolveScenario(scenarioInputFromRecords(declaration, items));
    const xml = renderH1Xml(mapToCDS_H1(declaration, items));

    assert.equal(method, "1");
    assert.deepEqual(scenario.valuationMethods, [method]);
    assert.equal(mappedMethodCode(declaration, items), method);
    assert.match(xml, new RegExp(`<MethodCode>${method}</MethodCode>`));
  });

  it("3. renderer does not invent MethodCode 1 when mapper output omits it", () => {
    const payload = mapToCDS_H1(h1Declaration(), h1Items()) as {
      Declaration: { GoodsShipment: { GovernmentAgencyGoodsItem: Array<Record<string, unknown>> } };
    };
    delete payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0].CustomsValuation;
    const xml = renderH1Xml(payload);
    assert.doesNotMatch(xml, /<CustomsValuation>/);
    assert.doesNotMatch(xml, /<CustomsValuation>[\s\S]*<MethodCode>1<\/MethodCode>/);
  });

  it("4. Method 1 still requires N935", () => {
    const completeness = evaluateCompleteness({
      rules,
      declaration: h1Declaration(),
      items: h1Items({ additionalDocuments: [] }),
    });
    assert.equal(completeness.ready, false);
    assert.ok(completeness.missing.some((m) => m.ruleId === "INV-METHOD1-N935"));
  });

  it("5. missing N935 still blocks", () => {
    const results = evaluateRules(rules, scenarioInputFromRecords(
      h1Declaration(),
      h1Items({ additionalDocuments: [] }),
    ));
    const n935 = results.find((r) => r.ruleId === "INV-METHOD1-N935");
    assert.equal(n935?.status, "fail");
    assert.equal(n935?.severity, "blocking");
  });

  it("6. DE 4/1 Method-1 requirement remains enforced", () => {
    const missing = validateTradeTerms({ incoterms: "", destinationCountry: "GB" });
    assert.ok(missing.some((e) => e.includes("DE 4/1")));
    const locationOnly = validateTradeTerms({
      incoterms: "CIF",
      destinationCountry: "GB",
    });
    assert.ok(locationOnly.some((e) => e.includes("DE 4/1")));
    assert.deepEqual(
      validateTradeTerms({
        incoterms: "CIF",
        incotermLocation: "Felixstowe",
        destinationCountry: "GB",
      }),
      [],
    );
  });

  it("7. supported ≤ £20k case remains fileable", () => {
    const declaration = h1Declaration({ invoiceTotal: 20000, representationType: "direct" });
    const items = h1Items({ valueAmount: 20000 });
    const resolved = resolveH1Valuation(declaration, items);
    const completeness = evaluateCompleteness({ rules, declaration, items });

    assert.equal(resolved.supported, true);
    assert.equal(resolved.confirmationRequired, false);
    assert.equal(completeness.ready, true);
    assert.equal(mappedMethodCode(declaration, items), "1");
  });

  it("8a. > £20k represented, missing confirmation, is blocked", () => {
    const declaration = h1Declaration({
      invoiceTotal: 20000.01,
      representationType: "direct",
    });
    const items = h1Items({ valueAmount: 20000.01 });
    const resolved = resolveH1Valuation(declaration, items);
    const completeness = evaluateCompleteness({ rules, declaration, items });

    assert.equal(resolved.confirmationRequired, true);
    assert.equal(resolved.confirmationPresent, false);
    assert.equal(completeness.ready, false);
    assert.ok(completeness.missing.some((m) => m.ruleId === "H1-VALUATION-METHOD1-ONLY"));
    assert.throws(
      () => mapToCDS_H1(declaration, items),
      /Method 1 \(transaction value\) conditions were checked/,
    );
  });

  it("8b. > £20k represented, confirmed, is allowed", () => {
    const declaration = h1Declaration({
      invoiceTotal: 25000,
      representationType: "indirect",
      h1Method1ConfirmedAt: 1_700_000_000_000,
    });
    const items = h1Items({ valueAmount: 25000 });
    const resolved = resolveH1Valuation(declaration, items);
    const completeness = evaluateCompleteness({ rules, declaration, items });

    assert.equal(resolved.confirmationRequired, true);
    assert.equal(resolved.confirmationPresent, true);
    assert.equal(completeness.ready, true);
    assert.equal(mappedMethodCode(declaration, items), "1");
  });

  it("9. self-representation is exempt from the > £20k confirmation", () => {
    const declaration = h1Declaration({
      invoiceTotal: 25000,
      representationType: "self",
    });
    const items = h1Items({ valueAmount: 25000 });
    const omittedType = h1Declaration({ invoiceTotal: 25000 });
    const resolved = resolveH1Valuation(declaration, items);
    const omitted = resolveH1Valuation(omittedType, items);

    assert.equal(resolved.confirmationRequired, false);
    assert.equal(omitted.confirmationRequired, false);
    assert.equal(evaluateCompleteness({ rules, declaration, items }).ready, true);
    assert.equal(mappedMethodCode(declaration, items), "1");
  });

  it("10. SPV/SIV is blocked and never emitted as Method 1", () => {
    for (const apc of ["E01", "E02", "1SV"]) {
      const declaration = h1Declaration();
      const items = h1Items({ additionalProcedureCode: apc });
      const resolved = resolveH1Valuation(declaration, items);
      const scenario = resolveScenario(scenarioInputFromRecords(declaration, items));
      const completeness = evaluateCompleteness({ rules, declaration, items });

      assert.equal(resolved.supported, false);
      assert.equal(resolved.methodCode, null);
      assert.deepEqual(scenario.valuationMethods, []);
      assert.equal(completeness.ready, false);
      assert.ok(completeness.missing.some((m) => m.ruleId === "H1-VALUATION-METHOD1-ONLY"));
      assert.ok(!completeness.missing.some((m) => m.ruleId === "INV-METHOD1-N935"));
      assert.throws(
        () => mapToCDS_H1(declaration, items),
        /supported Method 1 valuation path/,
      );
    }
  });

  it("11. existing H1 drafts without valuationMethod remain compatible", () => {
    const declaration = h1Declaration();
    const items = h1Items();
    assert.equal("valuationMethod" in declaration, false);
    assert.equal("valuationMethod" in items[0], false);
    assert.equal(resolveH1ValuationMethodCode(declaration, items), "1");
    assert.deepEqual(
      resolveScenario(scenarioInputFromRecords(declaration, items)).valuationMethods,
      ["1"],
    );
    assert.equal(mappedMethodCode(declaration, items), "1");
    assert.equal(evaluateCompleteness({ rules, declaration, items }).ready, true);
  });
});
