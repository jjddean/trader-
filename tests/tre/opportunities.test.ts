import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateRowOpportunity,
  isPreferenceClaimed,
  isWithinRepaymentWindow,
  REPAYMENT_WINDOW_YEARS,
} from "../../convex/lib/tre_opportunity";

const baseRow = {
  countryOfOriginCode: "BD",
  commodityCode: "6109100010",
  itemCustomsValue: 1000,
  acceptanceDate: "2026-01-15",
  mfnDutyAmount: 120, // 12% MFN
  preferenceDutyAmount: 0, // GSP 0%
  mfnRateLabel: "12.00%",
  preferenceRateLabel: "0.00%",
  preferenceGeoDescription: "GSP (developing countries)",
  requiresProofOfOrigin: true,
  measureSource: "trade-tariff:6109100010@2026-06-23#measure-1",
};

describe("isPreferenceClaimed", () => {
  it("treats empty and 100 as not claimed", () => {
    assert.equal(isPreferenceClaimed(""), false);
    assert.equal(isPreferenceClaimed("100"), false);
    assert.equal(isPreferenceClaimed(undefined), false);
    assert.equal(isPreferenceClaimed(null), false);
  });

  it("treats other codes as claimed", () => {
    assert.equal(isPreferenceClaimed("300"), true);
    assert.equal(isPreferenceClaimed("200"), true);
  });
});

describe("isWithinRepaymentWindow", () => {
  const now = Date.parse("2026-06-23");

  it("flags a recent acceptance date inside the 3-year window", () => {
    assert.equal(isWithinRepaymentWindow("2025-06-23", now), true);
  });

  it("rejects an acceptance date older than the window", () => {
    const old = `${2026 - REPAYMENT_WINDOW_YEARS - 1}-01-01`;
    assert.equal(isWithinRepaymentWindow(old, now), false);
  });

  it("rejects empty / unparseable dates", () => {
    assert.equal(isWithinRepaymentWindow("", now), false);
    assert.equal(isWithinRepaymentWindow("not-a-date", now), false);
  });
});

describe("evaluateRowOpportunity", () => {
  it("flags preference-blank rows where a cheaper preferential measure exists", () => {
    const result = evaluateRowOpportunity({ ...baseRow, nowMs: Date.parse("2026-06-23") });
    assert.ok(result);
    assert.equal(result.flag, "potential_preference_opportunity");
    assert.equal(result.indicativeDelta, 120);
    assert.equal(result.requiresProofOfOrigin, true);
    assert.equal(result.withinRepaymentWindow, true);
  });

  it("does not flag when preference was already claimed", () => {
    assert.equal(evaluateRowOpportunity({ ...baseRow, preferenceCode: "300" }), null);
  });

  it("does not flag when preference is not cheaper than MFN", () => {
    assert.equal(
      evaluateRowOpportunity({ ...baseRow, preferenceDutyAmount: 120 }),
      null,
    );
  });

  it("does not flag when MFN duty cannot be quantified (specific duty, no weight)", () => {
    assert.equal(evaluateRowOpportunity({ ...baseRow, mfnDutyAmount: null }), null);
  });

  it("does not flag when preference duty cannot be quantified", () => {
    assert.equal(evaluateRowOpportunity({ ...baseRow, preferenceDutyAmount: null }), null);
  });

  it("does not flag an invalid origin", () => {
    assert.equal(evaluateRowOpportunity({ ...baseRow, countryOfOriginCode: "XXX" }), null);
  });

  it("does not flag a non-10-digit commodity code", () => {
    assert.equal(evaluateRowOpportunity({ ...baseRow, commodityCode: "6109" }), null);
  });

  it("does not flag a zero or missing customs value", () => {
    assert.equal(evaluateRowOpportunity({ ...baseRow, itemCustomsValue: 0 }), null);
    assert.equal(evaluateRowOpportunity({ ...baseRow, itemCustomsValue: null }), null);
  });

  it("rounds the indicative delta to 2 decimals", () => {
    const result = evaluateRowOpportunity({
      ...baseRow,
      mfnDutyAmount: 50.005,
      preferenceDutyAmount: 0,
    });
    assert.ok(result);
    assert.equal(result.indicativeDelta, 50.01);
  });
});
