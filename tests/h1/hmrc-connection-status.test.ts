import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatHmrcTokenExpiry,
  resolveHmrcConnectionStatus,
} from "../../src/lib/hmrc-connection-status";

describe("HMRC connection status", () => {
  const now = 1_750_000_000_000;

  it("is loading while the token query is unresolved", () => {
    assert.equal(resolveHmrcConnectionStatus(undefined, now), "loading");
  });

  it("is disconnected when no token exists", () => {
    assert.equal(resolveHmrcConnectionStatus(null, now), "disconnected");
  });

  it("is expired when token expiry has passed", () => {
    assert.equal(resolveHmrcConnectionStatus({ expiresAt: now - 1 }, now), "expired");
  });

  it("is expiring with less than 30 minutes remaining", () => {
    assert.equal(resolveHmrcConnectionStatus({ expiresAt: now + 29 * 60 * 1000 }, now), "expiring");
  });

  it("is connected with at least 30 minutes remaining", () => {
    assert.equal(resolveHmrcConnectionStatus({ expiresAt: now + 30 * 60 * 1000 }, now), "connected");
  });

  it("formats token expiry consistently for the UK dashboard", () => {
    assert.equal(formatHmrcTokenExpiry(Date.UTC(2026, 6, 13, 12)), "Expires 13 Jul 2026");
  });
});
