import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { evaluateCompleteness } from "../../convex/lib/declaration_completeness";
import type { RuleDefinition } from "../../convex/lib/rule_engine";
import { resolveSubmitReadiness } from "../../src/lib/submit-filing-readiness";
import {
  REQUIRED_DOCS,
  getHmrcRequirementSetForDeclaration,
} from "../../src/lib/utils/document-utils";

const invMethod1N935: RuleDefinition = {
  ruleId: "INV-METHOD1-N935",
  name: "Method 1 valuation requires N935 (commercial invoice)",
  description:
    "DE 4/16 = 1 (transaction value) requires N935 on every goods item per the wco-dec valuation-method-types invariant.",
  severity: "blocking",
  enabled: true,
  triggerScope: { valuationMethods: ["1"] },
  effects: {
    requiredDocuments: [
      { code: "N935", reason: "Commercial invoice required for Method 1 transaction value." },
    ],
  },
};

const n271ChecklistMissing = [
  { code: "N271", status: "missing", requirementLevel: "blocking" },
];

describe("submit filing readiness — REQUIRED_DOCS is not a second gate", () => {
  it("Case A: engine ready + REQUIRED_DOCS N271 missing does not block filing", () => {
    const completeness = evaluateCompleteness({
      rules: [invMethod1N935],
      declaration: { valuationMethod: "1", route: "import" },
      items: [
        {
          additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }],
        },
      ],
    });
    assert.equal(completeness.ready, true);

    const readiness = resolveSubmitReadiness({
      completenessReady: completeness.ready,
      requirements: n271ChecklistMissing,
    });
    assert.equal(readiness.isReady, true);
    assert.deepEqual(readiness.missingBlockingCodes, ["N271"]);
    assert.ok(REQUIRED_DOCS.STANDARD.some((row) => row.code === "N271"));
  });

  it("Case B: engine N935 missing still blocks filing", () => {
    const completeness = evaluateCompleteness({
      rules: [invMethod1N935],
      declaration: { valuationMethod: "1", route: "import" },
      items: [{ additionalDocuments: [] }],
    });
    assert.equal(completeness.ready, false);
    assert.ok(completeness.missing.some((m) => m.ruleId === "INV-METHOD1-N935"));

    const readiness = resolveSubmitReadiness({
      completenessReady: completeness.ready,
      requirements: [],
    });
    assert.equal(readiness.isReady, false);
  });

  it("Case C: engine satisfied — ready even with an unrelated checklist-only row", () => {
    const completeness = evaluateCompleteness({
      rules: [invMethod1N935],
      declaration: { valuationMethod: "1", route: "import" },
      items: [
        {
          additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }],
        },
      ],
    });
    assert.equal(completeness.ready, true);

    const readiness = resolveSubmitReadiness({
      completenessReady: completeness.ready,
      requirements: [
        { code: "N271", status: "missing", requirementLevel: "blocking" },
        { code: "C400", status: "missing", requirementLevel: "blocking" },
      ],
    });
    assert.equal(readiness.isReady, true);
    assert.deepEqual(readiness.missingBlockingCodes, ["N271", "C400"]);
  });

  it("document checklist / REQUIRED_DOCS persistence source is unchanged", () => {
    assert.equal(REQUIRED_DOCS.STANDARD[0].code, "N935");
    assert.equal(REQUIRED_DOCS.STANDARD[1].code, "N271");
    const set = getHmrcRequirementSetForDeclaration({
      declarationType: "H1",
      route: "import",
    });
    assert.ok(set.some((row) => row.code === "N935"));
    assert.ok(set.some((row) => row.code === "N271"));
    assert.ok(set.every((row) => row.source === "shipment_rules" || row.source === "hmrc_origin_mapping"));
  });

  it("submit page uses resolveSubmitReadiness and still renders the checklist", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/dashboard/declarations/[id]/submit/page.tsx"),
      "utf8",
    );
    assert.match(page, /resolveSubmitReadiness/);
    assert.match(page, /getHmrcRequirementSetForDeclaration/);
    assert.match(page, /upsertRequirementsForDeclaration/);
    assert.match(page, /Required Documents \(Blocking\)/);
    assert.match(page, /missingBlockingCodes/);
    assert.doesNotMatch(
      page,
      /completenessReady && missingBlockingRequirements\.length === 0/,
    );
  });

  it("/api/hmrc/submit still does not read document_requirements or REQUIRED_DOCS", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/hmrc/submit/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(route, /document_requirements/);
    assert.doesNotMatch(route, /REQUIRED_DOCS/);
    assert.doesNotMatch(route, /getHmrcRequirementSetForDeclaration/);
    assert.doesNotMatch(route, /resolveSubmitReadiness/);
  });

  it("XML mapper and portal document display are not wired to filing readiness", () => {
    const mapper = fs.readFileSync(path.join(process.cwd(), "src/lib/wco-mapper.ts"), "utf8");
    const portal = fs.readFileSync(path.join(process.cwd(), "convex/client_portal.ts"), "utf8");
    const documents = fs.readFileSync(path.join(process.cwd(), "convex/documents.ts"), "utf8");
    assert.doesNotMatch(mapper, /resolveSubmitReadiness/);
    assert.doesNotMatch(mapper, /REQUIRED_DOCS/);
    assert.doesNotMatch(portal, /resolveSubmitReadiness/);
    assert.match(documents, /document_requirements/);
    assert.match(documents, /upsertRequirementsForDeclaration/);
  });
});
