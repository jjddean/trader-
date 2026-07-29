import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStaleStuckProcessingRow,
  isStuckHmrcStatus,
  STUCK_HMRC_STATUSES,
  STUCK_HMRC_STATUS_VALUES,
} from "../../convex/lib/stuck_declarations";

const NOW = 1_800_000_000_000;
const CUTOFF = NOW - 30 * 60 * 1000;

describe("stuck declaration recovery", () => {
  it("keeps the index lookup keys in parity with the status set", () => {
    // A status added to one and not the other means the recovery cron's indexed
    // query returns zero rows instead of failing — silent loss of the safety net.
    assert.equal(STUCK_HMRC_STATUS_VALUES.length, STUCK_HMRC_STATUSES.size);
    for (const value of STUCK_HMRC_STATUS_VALUES) {
      assert.ok(isStuckHmrcStatus(value), `${value} must be recognised as stuck`);
    }
  });

  it("treats terminal and draft states as not stuck", () => {
    for (const status of ["Draft", "Accepted", "Rejected", "Amended", "Cancelled"]) {
      assert.equal(isStuckHmrcStatus(status), false, status);
      assert.equal(isStaleStuckProcessingRow(status, CUTOFF - 1, undefined, CUTOFF), false, status);
    }
  });

  it("matches status regardless of casing", () => {
    assert.equal(isStuckHmrcStatus("PROCESSING"), true);
    assert.equal(isStuckHmrcStatus("processing"), true);
    assert.equal(isStuckHmrcStatus("Amendment Processing"), true);
  });

  it("ignores missing and empty statuses", () => {
    assert.equal(isStuckHmrcStatus(undefined), false);
    assert.equal(isStuckHmrcStatus(null), false);
    assert.equal(isStuckHmrcStatus(""), false);
  });

  it("only flags stuck rows older than the cutoff", () => {
    assert.equal(isStaleStuckProcessingRow("Processing", CUTOFF - 1, undefined, CUTOFF), true);
    assert.equal(isStaleStuckProcessingRow("Processing", CUTOFF, undefined, CUTOFF), false);
    assert.equal(isStaleStuckProcessingRow("Processing", NOW, undefined, CUTOFF), false);
  });

  it("falls back to created when lastUpdated is absent", () => {
    assert.equal(isStaleStuckProcessingRow("Processing", undefined, CUTOFF - 1, CUTOFF), true);
    assert.equal(isStaleStuckProcessingRow("Processing", undefined, NOW, CUTOFF), false);
  });

  it("treats rows with no timestamps as stale so they are re-checked", () => {
    assert.equal(isStaleStuckProcessingRow("Processing", undefined, undefined, CUTOFF), true);
  });

  it("flags cancellation and amendment states, not just Processing", () => {
    assert.equal(
      isStaleStuckProcessingRow("Cancellation Requested", CUTOFF - 1, undefined, CUTOFF),
      true,
    );
    assert.equal(
      isStaleStuckProcessingRow("Amendment Processing", CUTOFF - 1, undefined, CUTOFF),
      true,
    );
  });
});
