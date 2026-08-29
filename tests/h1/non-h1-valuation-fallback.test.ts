import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateCompleteness } from "../../convex/lib/declaration_completeness";
import {
  evaluateRules,
  resolveScenario,
  ruleApplies,
  scenarioInputFromRecords,
  type RuleDefinition,
} from "../../convex/lib/rule_engine";

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

const curatedD006: RuleDefinition = {
  ruleId: "CURATED-4000-02071290-BR-D006",
  name: "Curated: D006 required for HS 02071290 / BR / CPC 4000",
  description: "CDS rejection-backed D006 obligation",
  severity: "blocking",
  enabled: true,
  source: "cds-rejection:TDR-2026-04-26",
  triggerScope: {
    procedureCodes: ["4000"],
    commodityPrefixes: ["02071290"],
    originCountries: ["BR"],
  },
  effects: {
    requiredDocuments: [
      { code: "D006", reason: "Required by CDS (observed): rejection cited missing D006 on AdditionalDocument 02A." },
    ],
  },
};

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    sequenceNumber: 1,
    commodityCode: "6109100010",
    description: "Cotton t-shirts",
    originCountry: "DE",
    procedureCode: "1040",
    additionalProcedureCode: "000",
    valueAmount: 5000,
    valueCurrency: "GBP",
    additionalDocuments: [],
    ...overrides,
  };
}

function categoryDeclaration(
  category: "B1" | "C1" | "I1" | "H1",
  overrides: Record<string, unknown> = {},
) {
  const isExport = category === "B1" || category === "C1";
  return {
    _id: `kn7valuation-${category.toLowerCase()}`,
    declarationCategory: category,
    declarationType: category,
    additionalDeclarationType: category === "B1" ? "A" : category === "H1" ? "A" : "C",
    route: isExport ? "export" : "import",
    destinationCountry: isExport ? "FR" : "GB",
    dispatchCountry: isExport ? "GB" : "DE",
    ...overrides,
  };
}

function method1DoesNotApply(declaration: Record<string, unknown>, items: Array<Record<string, unknown>>) {
  const input = scenarioInputFromRecords(declaration, items);
  const scenario = resolveScenario(input);
  assert.ok(!scenario.valuationMethods.includes("1"));
  assert.equal(ruleApplies(invMethod1N935.triggerScope, scenario), false);
  const result = evaluateRules([invMethod1N935], input).find((r) => r.ruleId === "INV-METHOD1-N935");
  assert.equal(result?.status, "skip");
  const completeness = evaluateCompleteness({ rules: [invMethod1N935], declaration, items });
  assert.ok(!completeness.missing.some((m) => m.ruleId === "INV-METHOD1-N935"));
}

describe("non-H1 valuation fallback", () => {
  it("A. B1 without valuationMethod does not invent Method 1 or N935", () => {
    method1DoesNotApply(categoryDeclaration("B1"), [baseItem()]);
  });

  it("B. C1 without valuationMethod does not invent Method 1 or N935", () => {
    method1DoesNotApply(categoryDeclaration("C1"), [baseItem()]);
  });

  it("C. I1 without valuationMethod does not invent Method 1 or N935", () => {
    method1DoesNotApply(categoryDeclaration("I1"), [baseItem()]);
  });

  it("D. H1 without DB valuationMethod still scenarios Method 1 and N935", () => {
    const declaration = categoryDeclaration("H1");
    const items = [baseItem({ procedureCode: "4000" })];
    assert.equal("valuationMethod" in declaration, false);
    assert.equal("valuationMethod" in items[0], false);
    const input = scenarioInputFromRecords(declaration, items);
    const scenario = resolveScenario(input);
    assert.deepEqual(scenario.valuationMethods, ["1"]);
    assert.equal(ruleApplies(invMethod1N935.triggerScope, scenario), true);
    const result = evaluateRules([invMethod1N935], input).find((r) => r.ruleId === "INV-METHOD1-N935");
    assert.equal(result?.status, "fail");
    const completeness = evaluateCompleteness({ rules: [invMethod1N935], declaration, items });
    assert.ok(completeness.missing.some((m) => m.ruleId === "INV-METHOD1-N935"));
  });

  it("engine-level only: explicit non-H1 valuationMethod \"1\" is preserved (not a persisted B1/C1/I1 field)", () => {
    const declaration = categoryDeclaration("B1");
    const items = [baseItem({ valuationMethod: "1" })];
    const scenario = resolveScenario(scenarioInputFromRecords(declaration, items));
    assert.deepEqual(scenario.valuationMethods, ["1"]);
    assert.equal(ruleApplies(invMethod1N935.triggerScope, scenario), true);
  });

  it("H. I1 CPC 4000 / HS 02071290 / BR still requires curated D006 without inventing Method 1", () => {
    const declaration = categoryDeclaration("I1", { dispatchCountry: "BR" });
    const items = [
      baseItem({
        commodityCode: "0207129000",
        originCountry: "BR",
        procedureCode: "4000",
      }),
    ];
    const input = scenarioInputFromRecords(declaration, items);
    const scenario = resolveScenario(input);
    assert.ok(!scenario.valuationMethods.includes("1"));
    assert.equal(ruleApplies(invMethod1N935.triggerScope, scenario), false);
    assert.equal(ruleApplies(curatedD006.triggerScope, scenario), true);
    const results = evaluateRules([invMethod1N935, curatedD006], input);
    assert.equal(results.find((r) => r.ruleId === "INV-METHOD1-N935")?.status, "skip");
    assert.equal(results.find((r) => r.ruleId === "CURATED-4000-02071290-BR-D006")?.status, "fail");
    const completeness = evaluateCompleteness({
      rules: [invMethod1N935, curatedD006],
      declaration,
      items,
    });
    assert.ok(!completeness.missing.some((m) => m.ruleId === "INV-METHOD1-N935"));
    assert.ok(completeness.missing.some((m) => m.ruleId === "CURATED-4000-02071290-BR-D006"));
  });
});
