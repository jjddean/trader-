import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FollowUpLrnUnavailableError,
  resolveFollowUpLrn,
  type FollowUpContext,
} from "../../src/lib/cns/follow-up";
import {
  assertNilAmendmentRequest,
  cnsEndpointPath,
  NIL_AMENDMENT_CHANGE_REASON_CODE,
} from "../../src/lib/cns/declarations";
import type { CnsConfig } from "../../src/lib/cns/config";

const CREATE_LRN = "FC-M9X2K1P";

function context(overrides: Partial<FollowUpContext> = {}): FollowUpContext {
  return {
    transport: "cns_inventory",
    createLrn: CREATE_LRN,
    cnsUcn: "LGP100DPS00100",
    config: {} as CnsConfig,
    ...overrides,
  };
}

describe("resolveFollowUpLrn — CNS route", () => {
  it("reuses the original create LRN for an amendment", () => {
    assert.equal(resolveFollowUpLrn(context(), "AM-abc-123", "amend"), CREATE_LRN);
  });

  it("reuses the original create LRN for a cancellation", () => {
    assert.equal(resolveFollowUpLrn(context(), "CX-abc", "cancel"), CREATE_LRN);
  });

  it("never uses the minted AM-/CX- reference on the CNS route", () => {
    // An inventory pre-check rejection carries no ConversationID and a blank
    // MRN, so a changed LRN makes the notification uncorrelatable.
    const resolved = resolveFollowUpLrn(context(), "AM-abc-123", "amend");
    assert.ok(!resolved.startsWith("AM-"));
    assert.ok(!resolved.startsWith("CX-"));
  });

  it("refuses rather than fabricating a reference when the create LRN is missing", () => {
    assert.throws(
      () => resolveFollowUpLrn(context({ createLrn: null }), "AM-abc-123", "amend"),
      FollowUpLrnUnavailableError,
    );
  });

  it("explains why in the refusal message", () => {
    try {
      resolveFollowUpLrn(context({ createLrn: null }), "CX-abc", "cancel");
      assert.fail("expected a refusal");
    } catch (error) {
      assert.ok(error instanceof FollowUpLrnUnavailableError);
      assert.match(error.message, /create LRN/i);
      assert.match(error.message, /correlate/i);
    }
  });
});

describe("resolveFollowUpLrn — direct HMRC route", () => {
  const direct = context({ transport: "hmrc_direct" });

  it("preserves the existing minted reference", () => {
    // The direct path correlates via X-Conversation-ID. Changing its LRN
    // behaviour is a separate decision with TDR evidence implications.
    assert.equal(resolveFollowUpLrn(direct, "AM-abc-123", "amend"), "AM-abc-123");
    assert.equal(resolveFollowUpLrn(direct, "CX-abc", "cancel"), "CX-abc");
  });

  it("does not require a create LRN to be present", () => {
    assert.doesNotThrow(() =>
      resolveFollowUpLrn(context({ transport: "hmrc_direct", createLrn: null }), "AM-x", "amend"),
    );
  });
});

describe("cnsEndpointPath", () => {
  it("matches the paths published in Declaration API v1.0.3 §5", () => {
    assert.equal(cnsEndpointPath("create"), "/cds/customs/declarations/");
    assert.equal(cnsEndpointPath("cancel"), "/cds/customs/declarations/cancellation-requests");
    assert.equal(cnsEndpointPath("amend"), "/cds/customs/declarations/amend");
  });
});

describe("nil/blank amendment", () => {
  it("uses ChangeReasonCode 31", () => {
    // 31 makes the amendment pass through the CSP without inventory pre-checks.
    assert.equal(NIL_AMENDMENT_CHANGE_REASON_CODE, "31");
  });

  it("requires the original LRN, MRN, UCN, requester and reason", () => {
    assert.throws(
      () =>
        assertNilAmendmentRequest({
          lrn: "",
          mrn: "19GBANTQHMM69FGVR7",
          ucn: "LGP100DPS00100",
          requestedBy: "op",
          reason: "inventory corrected",
        }),
      /original LRN/i,
    );
  });

  it("requires an audit trail — who asked and why", () => {
    // Spec §7.5: never trigger automatically on CDS20001; require operator
    // confirmation that the inventory record is now correct.
    assert.throws(
      () =>
        assertNilAmendmentRequest({
          lrn: CREATE_LRN,
          mrn: "19GBANTQHMM69FGVR7",
          ucn: "LGP100DPS00100",
          requestedBy: "",
          reason: "",
        }),
      /requesting operator|reason/i,
    );
  });

  it("accepts a fully specified request", () => {
    assert.doesNotThrow(() =>
      assertNilAmendmentRequest({
        lrn: CREATE_LRN,
        mrn: "19GBANTQHMM69FGVR7",
        ucn: "LGP100DPS00100",
        requestedBy: "user_123",
        reason: "Compass record corrected; retriggering inventory link",
      }),
    );
  });
});
