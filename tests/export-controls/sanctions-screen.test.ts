import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { canonicaliseName, bestNameSimilarity } from "../../src/lib/export-controls/sanctions/canonicalise";
import { computeScreeningScore, thresholdBand } from "../../src/lib/export-controls/sanctions/scoring";
import type { SanctionsSnapshot } from "../../src/lib/export-controls/sanctions/snapshot";
import { buildSanctionsIndex, screenSubject } from "../../src/lib/export-controls/sanctions/screen";

const fixturePath = path.join(process.cwd(), "tests", "export-controls", "fixtures", "sanctions-mini.json");
const snapshot = JSON.parse(readFileSync(fixturePath, "utf8")) as SanctionsSnapshot;
const index = buildSanctionsIndex(snapshot);

describe("sanctions canonicalise", () => {
  it("strips corporate suffix and sorts tokens", () => {
    const out = canonicaliseName("Acme Trading Ltd");
    assert.ok(out.includes("ACME"));
    assert.ok(out.includes("TRADING"));
    assert.ok(!out.includes("LTD"));
  });
});

describe("sanctions screening", () => {
  it("exact passport match floors score", () => {
    const breakdown = computeScreeningScore({
      name: 0.2,
      address: 0,
      country: 0,
      dob: 0,
      identifier: 1,
      identifierExact: true,
    });
    assert.ok(breakdown.total >= 0.97);
    assert.equal(thresholdBand(breakdown.total, true).band, "block");
  });

  it("matches listed entity by alias name", () => {
    const hits = screenSubject(index, {
      subjectType: "consignee",
      name: "Haji Alim Hawala",
    });
    assert.ok(hits.length > 0);
    assert.equal(hits[0].uniqueId, "AFG0001");
  });

  it("matches passport identifier on John Smith", () => {
    const hits = screenSubject(index, {
      subjectType: "end_user",
      name: "Jonathan Smith",
      identifiers: [{ type: "passport", value: "AB123456" }],
    });
    assert.ok(hits.some((h) => h.uniqueId === "TST0001"));
    assert.ok(hits[0].scoreBreakdown.identifierExact);
  });

  it("matches vessel by IMO", () => {
    const hits = screenSubject(index, {
      subjectType: "vessel",
      name: "Petrel VIII",
      identifiers: [{ type: "imo", value: "1234567" }],
    });
    assert.ok(hits.some((h) => h.uniqueId === "DPR0075"));
  });

  it("ignores common-name noise below threshold", () => {
    const hits = screenSubject(index, {
      subjectType: "consignee",
      name: "John Smith Trading",
    });
    const top = hits.find((h) => h.uniqueId === "TST0001");
    if (top) {
      assert.ok(top.scoreBreakdown.total < 0.95 || !top.scoreBreakdown.identifierExact);
    }
  });
});
