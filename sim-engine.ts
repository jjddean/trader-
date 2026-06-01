import { evaluateRules, summarizeFailures } from "./convex/lib/rule_engine";
import fs from "node:fs";

const all = JSON.parse(fs.readFileSync("./rules.json", "utf8"));
const rules = all.map((r: Record<string, unknown>) => ({
  ruleId: r.ruleId,
  name: r.name,
  description: r.description,
  severity: r.severity,
  enabled: r.enabled,
  source: r.source,
  triggerScope: r.triggerScope,
  effects: r.effects,
  metadata: r.metadata,
}));

const input = {
  declaration: {
    declarationType: "A",
    route: "import",
    dispatchCountry: "DE",
    transportMode: "1",
    mode: "enriched",
    invoiceTotal: 1000,
  },
  items: [
    {
      commodityCode: "8471300000",
      originCountry: "DE",
      procedureCode: "4000",
      additionalProcedureCode: "000",
      valuationMethod: "1",
      valueAmount: 1000,
      additionalDocuments: [],
    },
  ],
};

const results = evaluateRules(rules, input);
const summary = { pass: 0, fail: 0, skip: 0 };
for (const r of results) summary[r.status]++;
console.log("Raw rule results:", summary);
console.log("Total enabled rules evaluated:", rules.filter((r: Record<string, unknown>) => r.enabled).length);
console.log();
const actions = summarizeFailures(results);
console.log(`Actionable failures (${actions.length}):`);
console.log(JSON.stringify(actions, null, 2));
