import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyCnsDeclarationResponse } from "../../src/lib/cns/declarations";

describe("CNS declaration response correlation", () => {
  it("accepts a 202 only when X-CSP-ID is present", () => {
    const result = classifyCnsDeclarationResponse({
      status: 202,
      ok: true,
      body: "",
      headers: new Headers({ "X-CSP-ID": "RKA-1234567890123" }),
    });
    assert.deepEqual(result, {
      status: "accepted",
      httpStatus: 202,
      cspId: "RKA-1234567890123",
    });
  });

  it("marks a 202 without X-CSP-ID as an unknown outcome", () => {
    const result = classifyCnsDeclarationResponse({
      status: 202,
      ok: true,
      body: "accepted without correlation",
      headers: new Headers(),
    });
    assert.equal(result.status, "failed");
    if (result.status === "failed") {
      assert.equal(result.error.code, "MISSING_CSP_ID");
      assert.equal(result.error.disposition, "outcome_unknown");
    }
  });
});
