import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CORRELATION_HEADER, correlationIdFrom, withCorrelation } from "../src/lib/correlation";

function req(headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/hmrc/submit", { method: "POST", headers });
}

describe("correlation id", () => {
  it("mints a uuid when the caller sends none", () => {
    const id = correlationIdFrom(req());
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("reuses an inbound id so one id spans the call chain", () => {
    assert.equal(correlationIdFrom(req({ [CORRELATION_HEADER]: "req-abc-123" })), "req-abc-123");
  });

  it("rejects ids that are too short, too long, or contain junk", () => {
    for (const bad of ["short", "x".repeat(129), "has spaces", "semi;colon", "<script>"]) {
      const id = correlationIdFrom(req({ [CORRELATION_HEADER]: bad }));
      assert.notEqual(id, bad);
      assert.match(id, /^[0-9a-f-]{36}$/);
    }
  });

  it("trims surrounding whitespace on an inbound id", () => {
    assert.equal(correlationIdFrom(req({ [CORRELATION_HEADER]: "  req-abc-123  " })), "req-abc-123");
  });

  it("mints unique ids per request", () => {
    const ids = new Set(Array.from({ length: 50 }, () => correlationIdFrom(req())));
    assert.equal(ids.size, 50);
  });

  it("puts the id on the response so support can be quoted it", () => {
    const res = withCorrelation(new Response(null, { status: 500 }), "req-abc-123");
    assert.equal(res.headers.get(CORRELATION_HEADER), "req-abc-123");
  });
});
