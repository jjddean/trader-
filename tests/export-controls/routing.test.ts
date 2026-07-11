import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSpireOnlyEntry,
  resolveSubmissionRoute,
  SPIRE_DESTINATION_CODES,
} from "../../src/lib/export-controls/routing";

describe("submission routing", () => {
  it("defaults eligible GB case to LITE", () => {
    const result = resolveSubmissionRoute({
      originJurisdiction: "GB",
      destinationCountry: "US",
      approvedControlEntries: ["3A001"],
    });
    assert.equal(result.route, "lite");
    assert.equal(result.headline, "Open official GOV.UK SIEL service");
    assert.equal(result.niReviewRequired, false);
  });

  it("routes sanctioned destination to SPIRE with OTSI copy", () => {
    const result = resolveSubmissionRoute({
      originJurisdiction: "GB",
      destinationCountry: "RU",
      approvedControlEntries: ["3A001"],
    });
    assert.equal(result.route, "spire");
    assert.equal(
      result.headline,
      "This case may require OTSI/SPIRE handling (sanctioned destination)",
    );
    assert.ok(result.reasons.some((r) => r.includes("RU")));
  });

  it("routes SPIRE-only control entry to SPIRE", () => {
    const result = resolveSubmissionRoute({
      originJurisdiction: "GB",
      destinationCountry: "US",
      approvedControlEntries: ["8A002o4"],
    });
    assert.equal(result.route, "spire");
    assert.equal(result.headline, "This case must be submitted in SPIRE");
    assert.ok(isSpireOnlyEntry("8A002O4"));
  });

  it("flags NI origin for review", () => {
    const result = resolveSubmissionRoute({
      originJurisdiction: "NI",
      destinationCountry: "FR",
      approvedControlEntries: ["3A001"],
    });
    assert.equal(result.niReviewRequired, true);
    assert.ok(result.reasons.some((r) => r.includes("Northern Ireland")));
  });

  it("routes non-SIEL licence type to SPIRE", () => {
    const result = resolveSubmissionRoute({
      originJurisdiction: "GB",
      destinationCountry: "US",
      approvedControlEntries: ["3A001"],
      licenceType: "sitl",
    });
    assert.equal(result.route, "spire");
    assert.equal(result.headline, "This case must be submitted in SPIRE");
  });

  it("includes all 11 SPIRE exception destinations", () => {
    assert.equal(SPIRE_DESTINATION_CODES.size, 11);
    for (const code of ["BY", "MM", "IR", "IQ", "LB", "LY", "KP", "RU", "SY", "VE", "ZW"]) {
      assert.ok(SPIRE_DESTINATION_CODES.has(code), `missing ${code}`);
    }
  });
});
