import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redact } from "../src/lib/logger";

describe("log redaction", () => {
  it("redacts sensitive keys at the top level", () => {
    assert.deepEqual(redact({ mrn: "26GB123456789", eori: "GB123456789012", note: "keep" }), {
      mrn: "[redacted]",
      eori: "[redacted]",
      note: "keep",
    });
  });

  it("redacts nested keys", () => {
    assert.deepEqual(
      redact({ declaration: { mrn: "26GB1", items: [{ eori: "GB1", qty: 3 }] } }),
      { declaration: { mrn: "[redacted]", items: [{ eori: "[redacted]", qty: 3 }] } },
    );
  });

  it("matches key names case-insensitively and as substrings", () => {
    const out = redact({
      Authorization: "Bearer x",
      access_token: "x",
      clientSecret: "x",
      HMRC_CLIENT_SECRET: "x",
      refreshToken: "x",
    }) as Record<string, unknown>;
    for (const key of Object.keys(out)) {
      assert.equal(out[key], "[redacted]", key);
    }
  });

  it("keeps non-sensitive values intact", () => {
    const input = { status: "Accepted", count: 3, ok: true, at: null };
    assert.deepEqual(redact(input), input);
  });

  it("passes primitives through", () => {
    assert.equal(redact("plain"), "plain");
    assert.equal(redact(42), 42);
    assert.equal(redact(null), null);
    assert.equal(redact(undefined), undefined);
  });

  it("reduces an Error to name and message, dropping the stack", () => {
    const err = new Error("boom");
    assert.deepEqual(redact(err), { name: "Error", message: "boom" });
  });

  it("survives circular references", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    assert.deepEqual(redact(a), { name: "a", self: "[circular]" });
  });

  it("caps very deep nesting", () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };
    assert.match(JSON.stringify(redact(deep)), /max-depth/);
  });

  it("caps very long arrays", () => {
    const out = redact(Array.from({ length: 120 }, (_, i) => i)) as unknown[];
    assert.equal(out.length, 51);
    assert.equal(out[50], "[+70 more]");
  });
});
