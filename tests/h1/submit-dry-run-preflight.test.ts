import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildDryRunLocalPreflight,
  DRY_RUN_LOCAL_PREFLIGHT_ALWAYS_KEYS,
} from "../../src/lib/submit-dry-run-preflight";
import {
  DECLARATION_INCOMPLETE_ERROR,
  declarationIncompleteResponse,
  validateDeclaration,
} from "../../src/lib/submit-h1-gate";

const passingPreflight = buildDryRunLocalPreflight({
  fraudHeadersPass: true,
  eoriConsistencyPass: true,
  xmlPass: true,
  xmlFailedChecks: [],
  token: "pass",
  ruleEngine: "pass",
  codeLists: "checked",
});

describe("dry-run localPreflight — no fake validationFields stage", () => {
  it("successful dry-run preflight has the real indicators only", () => {
    assert.deepEqual(
      Object.keys(passingPreflight).sort(),
      [...DRY_RUN_LOCAL_PREFLIGHT_ALWAYS_KEYS].sort(),
    );
    assert.equal(passingPreflight.fraudHeaders, "pass");
    assert.equal(passingPreflight.eoriConsistency, "pass");
    assert.equal(passingPreflight.xml, "pass");
    assert.equal(passingPreflight.token, "pass");
    assert.equal(passingPreflight.ruleEngine, "pass");
    assert.equal(passingPreflight.codeLists, "checked");
    assert.equal("validationFields" in passingPreflight, false);
    assert.equal(passingPreflight.xmlFailedChecks, undefined);
  });

  it("includes xmlFailedChecks only when preflight failed checks exist", () => {
    const failed = buildDryRunLocalPreflight({
      fraudHeadersPass: true,
      eoriConsistencyPass: true,
      xmlPass: false,
      xmlFailedChecks: ["empty TypeCode"],
      token: "n/a",
      ruleEngine: "skipped",
      codeLists: "checked",
    });
    assert.equal(failed.xml, "fail");
    assert.deepEqual(failed.xmlFailedChecks, ["empty TypeCode"]);
    assert.equal(failed.token, "n/a");
    assert.equal(failed.ruleEngine, "skipped");
    assert.equal("validationFields" in failed, false);
  });

  it("other localPreflight indicators keep pass/fail/n/a/skipped/blocked/advisory", () => {
    const blocked = buildDryRunLocalPreflight({
      fraudHeadersPass: false,
      eoriConsistencyPass: false,
      xmlPass: true,
      xmlFailedChecks: [],
      token: "fail",
      ruleEngine: "blocked",
      codeLists: "checked",
    });
    assert.equal(blocked.fraudHeaders, "fail");
    assert.equal(blocked.eoriConsistency, "fail");
    assert.equal(blocked.xml, "pass");
    assert.equal(blocked.token, "fail");
    assert.equal(blocked.ruleEngine, "blocked");

    const advisory = buildDryRunLocalPreflight({
      fraudHeadersPass: true,
      eoriConsistencyPass: true,
      xmlPass: true,
      xmlFailedChecks: [],
      token: "pass",
      ruleEngine: "advisory",
      codeLists: "checked",
    });
    assert.equal(advisory.ruleEngine, "advisory");
  });

  it("submit UI lists localPreflight entries without requiring validationFields", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/dashboard/declarations/[id]/submit/page.tsx"),
      "utf8",
    );
    assert.match(page, /Object\.entries\(dryRunResult\.localPreflight \|\| \{\}\)/);
    assert.doesNotMatch(page, /validationFields/);
    const rows = Object.entries(passingPreflight);
    assert.ok(rows.every(([key]) => key !== "validationFields"));
    assert.deepEqual(
      rows.map(([k]) => k).sort(),
      [...DRY_RUN_LOCAL_PREFLIGHT_ALWAYS_KEYS].sort(),
    );
  });

  it("submit route dry-run no longer emits validationFields or a dead validationErrors array", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/hmrc/submit/route.ts"),
      "utf8",
    );
    assert.match(route, /buildDryRunLocalPreflight\(/);
    assert.doesNotMatch(route, /validationFields/);
    assert.doesNotMatch(route, /validationErrors/);
  });
});

describe("incomplete declaration still uses the existing 400 gate", () => {
  it("returns Declaration incomplete with missing field list", () => {
    const missing = validateDeclaration({}, []);
    assert.ok(missing.length > 0);
    assert.ok(missing.includes("Missing declarant EORI"));
    assert.ok(missing.includes("No goods items"));
    const body = declarationIncompleteResponse(missing);
    assert.deepEqual(body, { error: DECLARATION_INCOMPLETE_ERROR, missing });
    assert.equal(body.error, "Declaration incomplete");
  });

  it("submit route still returns that 400 body", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/hmrc/submit/route.ts"),
      "utf8",
    );
    assert.match(route, /declarationIncompleteResponse\(baselineErrors\)/);
    assert.match(route, /status: 400/);
  });
});
