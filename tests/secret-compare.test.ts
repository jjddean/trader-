import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { secretsEqual } from "../convex/lib/secret_compare";

describe("constant-time secret compare", () => {
  it("accepts an exact match", () => {
    assert.equal(secretsEqual("s3cr3t-value", "s3cr3t-value"), true);
  });

  it("rejects a different value of the same length", () => {
    assert.equal(secretsEqual("s3cr3t-value", "s3cr3t-valuf"), false);
  });

  it("rejects a prefix", () => {
    assert.equal(secretsEqual("s3cr3t-value", "s3cr3t"), false);
  });

  it("rejects a longer value sharing a prefix", () => {
    assert.equal(secretsEqual("s3cr3t", "s3cr3t-value"), false);
  });

  it("rejects empty against non-empty both ways", () => {
    assert.equal(secretsEqual("", "s3cr3t"), false);
    assert.equal(secretsEqual("s3cr3t", ""), false);
  });

  it("treats two empty strings as equal", () => {
    assert.equal(secretsEqual("", ""), true);
  });

  it("compares by bytes, not code units", () => {
    assert.equal(secretsEqual("café", "café"), true);
    assert.equal(secretsEqual("café", "cafe"), false);
  });
});
