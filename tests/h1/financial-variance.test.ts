import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeFinancialVariance } from "../../convex/lib/financial_variance";

describe("financial variance", () => {
  it("returns null when HMRC amounts are not confirmed", () => {
    assert.equal(
      computeFinancialVariance({
        derivedDuty: 100,
        derivedVat: 20,
        confirmedDuty: 80,
        confirmedVat: 16,
        hasConfirmedFinancials: false,
      }),
      null,
    );
  });

  it("flags duty higher than HMRC", () => {
    const result = computeFinancialVariance({
      derivedDuty: 150,
      derivedVat: 20,
      confirmedDuty: 100,
      confirmedVat: 20,
      hasConfirmedFinancials: true,
    });
    assert.ok(result);
    assert.equal(result.varianceAlert, true);
    assert.ok(result.varianceKinds.includes("duty_higher_than_hmrc"));
    assert.equal(result.dutyVarianceAmount, 50);
  });

  it("flags duty lower than HMRC (underpayment risk)", () => {
    const result = computeFinancialVariance({
      derivedDuty: 50,
      derivedVat: 20,
      confirmedDuty: 100,
      confirmedVat: 20,
      hasConfirmedFinancials: true,
    });
    assert.ok(result);
    assert.ok(result.varianceKinds.includes("duty_lower_than_hmrc"));
    assert.equal(result.dutyVarianceAmount, -50);
  });

  it("ignores noise below threshold", () => {
    const result = computeFinancialVariance({
      derivedDuty: 100.5,
      derivedVat: 20,
      confirmedDuty: 100,
      confirmedVat: 20,
      hasConfirmedFinancials: true,
    });
    assert.ok(result);
    assert.equal(result.varianceAlert, false);
  });
});
