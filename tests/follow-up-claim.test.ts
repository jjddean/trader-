import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { followUpClaim, mayReleaseClaim } from "../convex/lib/follow_up_claim";

describe("amend/cancel claim", () => {
  it("claims a live declaration for amendment", () => {
    assert.deepEqual(followUpClaim("Accepted", "amend"), {
      ok: true,
      nextStatus: "Amendment Processing",
    });
    assert.deepEqual(followUpClaim("Amended", "amend"), {
      ok: true,
      nextStatus: "Amendment Processing",
    });
  });

  it("claims a live declaration for cancellation", () => {
    assert.deepEqual(followUpClaim("Accepted", "cancel"), {
      ok: true,
      nextStatus: "Cancellation Requested",
    });
  });

  // The duplicate-filing case: a second click while the first request is in
  // flight. Previously both passed, because status was only set after HMRC replied.
  it("rejects a second amendment while one is in flight", () => {
    assert.deepEqual(followUpClaim("Amendment Processing", "amend"), {
      ok: false,
      reason: "in_flight",
    });
  });

  it("rejects a follow-up while the initial submission is in flight", () => {
    assert.deepEqual(followUpClaim("Processing", "amend"), { ok: false, reason: "in_flight" });
    assert.deepEqual(followUpClaim("Processing", "cancel"), { ok: false, reason: "in_flight" });
  });

  it("rejects a second cancellation", () => {
    assert.deepEqual(followUpClaim("Cancellation Requested", "cancel"), {
      ok: false,
      reason: "in_flight",
    });
  });

  it("rejects amendments on declarations that are not live", () => {
    for (const status of ["Draft", "Rejected", "Invalidated", "Cleared", "", "unknown"]) {
      assert.equal(followUpClaim(status, "amend").ok, false, status);
    }
    assert.deepEqual(followUpClaim("Draft", "amend"), { ok: false, reason: "not_live" });
  });

  // The cancel route never restricted by status. Which states CDS allows an
  // invalidation from is an AGENT-SPEC question, so the claim does not decide it.
  it("does not restrict cancellation by status", () => {
    for (const status of ["Draft", "Rejected", "Cleared", "Tax Calculated", "unknown"]) {
      assert.deepEqual(
        followUpClaim(status, "cancel"),
        { ok: true, nextStatus: "Cancellation Requested" },
        status,
      );
    }
  });

  it("releases the claim only when the outcome is known", () => {
    assert.equal(mayReleaseClaim("rejected"), true);
    assert.equal(mayReleaseClaim("outcome_unknown"), false);
  });
});
