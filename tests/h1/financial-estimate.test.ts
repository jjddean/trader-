import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFinancialEstimateDisplay } from "../../src/lib/financial-estimate";

describe("financial estimate display", () => {
  it("shows HMRC confirmed copy when financialSource is hmrc_confirmed", () => {
    const display = buildFinancialEstimateDisplay({
      dutyAmount: 120,
      vatAmount: 240,
      customsValue: 1000,
      financialSource: "hmrc_confirmed",
    });

    assert.equal(display.badgeTone, "confirmed");
    assert.match(display.headline, /HMRC assessed/i);
    assert.equal(display.preferenceHint, null);
  });

  it("shows tariff-based estimate badge for derived tariff measures", () => {
    const display = buildFinancialEstimateDisplay({
      dutyAmount: 135,
      vatAmount: 227,
      customsValue: 1000,
      financialSource: "derived",
      estimateMethod: "tariff_measures",
    });

    assert.equal(display.badge, "Estimate only");
    assert.match(display.footnote, /Trade Tariff measures/i);
  });

  it("warns when estimate is incomplete", () => {
    const display = buildFinancialEstimateDisplay({
      dutyAmount: 0,
      vatAmount: 200,
      customsValue: 1000,
      financialSource: "derived",
      estimateMethod: "tariff_measures",
      estimateIncomplete: true,
    });

    assert.equal(display.badgeTone, "warning");
    assert.match(display.footnote, /net weight/i);
  });

  it("shows optional preference saving hint separately from main total", () => {
    const display = buildFinancialEstimateDisplay({
      dutyAmount: 135,
      vatAmount: 227,
      customsValue: 1000,
      financialSource: "derived",
      estimateMethod: "tariff_measures",
      potentialPreferenceSaving: 135,
    });

    assert.ok(display.preferenceHint);
    assert.match(display.preferenceHint!, /£135\.00 lower/);
  });

  it("shows variance copy when HMRC differs from estimate", () => {
    const display = buildFinancialEstimateDisplay({
      dutyAmount: 100,
      vatAmount: 20,
      customsValue: 1000,
      financialSource: "hmrc_confirmed",
      varianceAlert: true,
      varianceKinds: ["duty_lower_than_hmrc"],
      dutyVarianceAmount: -25,
      vatVarianceAmount: 0,
    });

    assert.equal(display.badgeTone, "warning");
    assert.ok(display.varianceLines.length > 0);
    assert.match(display.varianceLines[0], /A00/i);
  });
});
