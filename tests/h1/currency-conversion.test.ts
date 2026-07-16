import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  convertToGbp,
  resolveCustomsValueGbp,
} from "../../convex/lib/currency_conversion";

const USD_FX = {
  base: "USD",
  rates: { USD: 1, GBP: 0.79, EUR: 0.92, CNY: 7.24 },
};

describe("currency conversion", () => {
  it("returns GBP unchanged", () => {
    assert.equal(convertToGbp(100, "GBP", USD_FX), 100);
  });

  it("converts USD base EUR to GBP", () => {
    const gbp = convertToGbp(920, "EUR", USD_FX);
    assert.ok(gbp != null);
    assert.ok(Math.abs(gbp - 790) < 0.02);
  });

  it("flags fx unavailable when rates missing for currency", () => {
    const result = resolveCustomsValueGbp(500, "JPY", USD_FX);
    assert.equal(result.fxUnavailable, true);
    assert.equal(result.fxApplied, false);
  });

  it("applies fx when cache present", () => {
    const result = resolveCustomsValueGbp(100, "EUR", USD_FX);
    assert.equal(result.fxApplied, true);
    assert.equal(result.fxUnavailable, false);
    assert.ok(result.customsValueGbp > 0);
  });
});
