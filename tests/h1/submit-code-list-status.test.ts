import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { validateCdsCodeLists } from "../../src/lib/wco-mapper";
import {
  createTrackedCdsCodeListLookup,
  summarizeCodeListLookups,
} from "../../src/lib/submit-code-list-status";
import { buildDryRunLocalPreflight } from "../../src/lib/submit-dry-run-preflight";

const SEEDED = [{ code: "seeded" }];

function payloadWithOfficeAndIncoterm() {
  return {
    Declaration: {
      DeclarationOfficeID: "GB000001",
      GoodsShipment: {
        TradeTerms: { ConditionCode: "CIF" },
        GovernmentAgencyGoodsItem: [{}],
      },
    },
  };
}

function payloadWithProcedureOnly() {
  return {
    Declaration: {
      GoodsShipment: {
        GovernmentAgencyGoodsItem: [{}],
      },
    },
  };
}

describe("code-list dry-run visibility — fail-open lookup unchanged", () => {
  it("all required lists seeded and valid → codeLists checked", async () => {
    const tracked = createTrackedCdsCodeListLookup({
      listCodes: async () => SEEDED,
      validateCodes: async () => ({ missing: [] }),
    });
    const errors = await validateCdsCodeLists(
      payloadWithOfficeAndIncoterm(),
      [{ procedureCode: "4000" }],
      tracked.lookup,
      { category: "H1" },
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(tracked.status(), { codeLists: "checked" });
    assert.equal("skippedCodeLists" in tracked.status(), false);
  });

  it("one list unseeded → skipped + that list name, lookup returns []", async () => {
    const tracked = createTrackedCdsCodeListLookup({
      listCodes: async (listName) => (listName === "incoterms" ? [] : SEEDED),
      validateCodes: async () => ({ missing: [] }),
    });
    const errors = await validateCdsCodeLists(
      payloadWithOfficeAndIncoterm(),
      [],
      tracked.lookup,
      { category: "H1" },
    );
    assert.deepEqual(errors, []);
    const status = tracked.status();
    assert.equal(status.codeLists, "skipped");
    assert.deepEqual(status.skippedCodeLists, ["incoterms"]);
    assert.equal(status.unavailableCodeLists, undefined);
  });

  it("multiple lists unseeded → skipped + all distinct names", async () => {
    const tracked = createTrackedCdsCodeListLookup({
      listCodes: async (listName) =>
        listName === "incoterms" || listName === "customs_offices" ? [] : SEEDED,
      validateCodes: async () => ({ missing: [] }),
    });
    const errors = await validateCdsCodeLists(
      payloadWithOfficeAndIncoterm(),
      [],
      tracked.lookup,
      { category: "H1" },
    );
    assert.deepEqual(errors, []);
    const status = tracked.status();
    assert.equal(status.codeLists, "skipped");
    assert.deepEqual(status.skippedCodeLists, ["customs_offices", "incoterms"]);
  });

  it("lookup exception → skipped/unavailable and fail-open returns []", async () => {
    const tracked = createTrackedCdsCodeListLookup({
      listCodes: async () => {
        throw new Error("convex down");
      },
      validateCodes: async () => ({ missing: [] }),
    });
    const missingReturned = await tracked.lookup("incoterms", ["CIF"]);
    assert.deepEqual(missingReturned, []);
    const status = tracked.status();
    assert.equal(status.codeLists, "skipped");
    assert.deepEqual(status.skippedCodeLists, ["incoterms"]);
    assert.deepEqual(status.unavailableCodeLists, ["incoterms"]);
  });

  it("seeded invalid code still produces the existing validation errors", async () => {
    const tracked = createTrackedCdsCodeListLookup({
      listCodes: async () => SEEDED,
      validateCodes: async (_listName, values) => ({ missing: values }),
    });
    const errors = await validateCdsCodeLists(
      payloadWithOfficeAndIncoterm(),
      [{ procedureCode: "4000" }],
      tracked.lookup,
      { category: "H1" },
    );
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.field === "incoterms"));
    assert.ok(errors.some((e) => e.field === "presentationOffice"));
    assert.equal(tracked.status().codeLists, "checked");
  });

  it("B1/C1 still skip previous_procedure_codes", async () => {
    const asked: string[] = [];
    const tracked = createTrackedCdsCodeListLookup({
      listCodes: async (listName) => {
        asked.push(listName);
        return SEEDED;
      },
      validateCodes: async () => ({ missing: [] }),
    });
    const b1Errors = await validateCdsCodeLists(
      payloadWithProcedureOnly(),
      [{ procedureCode: "1040" }],
      tracked.lookup,
      { category: "B1" },
    );
    const c1Errors = await validateCdsCodeLists(
      payloadWithProcedureOnly(),
      [{ procedureCode: "1040" }],
      tracked.lookup,
      { category: "C1" },
    );
    assert.deepEqual(b1Errors, []);
    assert.deepEqual(c1Errors, []);
    assert.equal(asked.includes("previous_procedure_codes"), false);
    assert.equal(asked.includes("procedure_codes"), true);
  });

  it("dry-run UI Object.entries still renders with the new fields", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/dashboard/declarations/[id]/submit/page.tsx"),
      "utf8",
    );
    assert.match(page, /Object\.entries\(dryRunResult\.localPreflight \|\| \{\}\)/);
    const skipped = buildDryRunLocalPreflight({
      fraudHeadersPass: true,
      eoriConsistencyPass: true,
      xmlPass: true,
      xmlFailedChecks: [],
      token: "pass",
      ruleEngine: "pass",
      codeLists: "skipped",
      skippedCodeLists: ["incoterms", "package_types"],
      unavailableCodeLists: ["package_types"],
    });
    const rows = Object.entries(skipped);
    assert.ok(rows.some(([k, v]) => k === "codeLists" && v === "skipped"));
    assert.ok(rows.some(([k, v]) => k === "skippedCodeLists" && Array.isArray(v)));
    assert.ok(rows.some(([k, v]) => k === "unavailableCodeLists" && Array.isArray(v)));
    const rendered = rows.map(([k, v]) => {
      const display = v == null ? "—" : Array.isArray(v) ? v.join(",") : String(v);
      return `${k}:${display}`;
    });
    assert.ok(rendered.includes("codeLists:skipped"));
    assert.ok(rendered.some((line) => line.startsWith("skippedCodeLists:")));
  });
});

describe("code-list filing acceptance path is unchanged", () => {
  it("submit route still 400s on code-list errors and does not add a fail-closed env flag", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/hmrc/submit/route.ts"),
      "utf8",
    );
    assert.match(route, /createTrackedCdsCodeListLookup\(/);
    assert.match(route, /\.\.\.trackedCodeLists\.status\(\)/);
    assert.match(route, /error: "Code-list validation failed"/);
    assert.match(route, /status: 400/);
    assert.doesNotMatch(route, /HMRC_REQUIRE_CODE_LISTS/);
    const mapper = fs.readFileSync(path.join(process.cwd(), "src/lib/wco-mapper.ts"), "utf8");
    assert.match(mapper, /if \(!isExportDataSet\) \{/);
    assert.match(mapper, /LIST\.previousProcedureCodes/);
  });

  it("unseeded and thrown lookups still return empty missing sets so filing continues", async () => {
    const unseeded = createTrackedCdsCodeListLookup({
      listCodes: async () => [],
      validateCodes: async () => ({ missing: ["CIF"] }),
    });
    assert.deepEqual(await unseeded.lookup("incoterms", ["CIF"]), []);

    const threw = createTrackedCdsCodeListLookup({
      listCodes: async () => SEEDED,
      validateCodes: async () => {
        throw new Error("timeout");
      },
    });
    assert.deepEqual(await threw.lookup("incoterms", ["CIF"]), []);
    assert.equal(threw.status().codeLists, "skipped");
  });

  it("vacuous lookups (nothing consulted) report checked", () => {
    const status = summarizeCodeListLookups(new Map());
    assert.deepEqual(status, { codeLists: "checked" });
  });
});
