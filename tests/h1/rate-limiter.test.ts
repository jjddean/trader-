import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HmrcRateLimiter } from "../../src/lib/rate-limiter";

describe("HmrcRateLimiter", () => {
  it("spaces requests when exceeding maxRequests in window", async () => {
    const limiter = new HmrcRateLimiter(2, 200);
    const start = Date.now();
    await limiter.waitForSlot();
    await limiter.waitForSlot();
    await limiter.waitForSlot();
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 150, `expected wait >= 150ms, got ${elapsed}ms`);
  });
});
