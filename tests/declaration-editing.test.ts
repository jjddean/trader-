import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  editBlockedMessage,
  isEditableStatus,
  mayBeginInitialSubmission,
} from "../convex/lib/declaration_editing";

/** Everything HMRC has accepted. None of these may be edited or re-filed. */
const FILED = [
  "Processing",
  "Accepted",
  "Tax Calculated",
  "Amended",
  "Amendment Processing",
  "Cancellation Requested",
  "Cleared",
  "Invalidated",
];

describe("declaration editing gate", () => {
  it("allows editing a draft", () => {
    assert.equal(isEditableStatus("Draft"), true);
  });

  // AGENT-SPEC §5: on rejection, fix the category and resubmit.
  it("allows editing a rejected declaration", () => {
    assert.equal(isEditableStatus("Rejected"), true);
    assert.equal(mayBeginInitialSubmission("Rejected"), true);
  });

  it("treats a missing or blank status as Draft", () => {
    for (const status of [undefined, null, "", "   "]) {
      assert.equal(isEditableStatus(status), true, String(status));
      assert.equal(mayBeginInitialSubmission(status), true, String(status));
    }
  });

  it("refuses editing anything HMRC has accepted", () => {
    for (const status of FILED) {
      assert.equal(isEditableStatus(status), false, status);
    }
  });

  /**
   * The deny-list hole. Cleared was never listed, so a cleared declaration fell
   * through beginSubmission and was re-filed as a brand new declaration.
   */
  it("refuses an initial submission from Cleared", () => {
    assert.equal(mayBeginInitialSubmission("Cleared"), false);
  });

  it("refuses an initial submission from every filed status", () => {
    for (const status of FILED) {
      assert.equal(mayBeginInitialSubmission(status), false, status);
    }
  });

  /** Fail closed: a status nobody has seen before is refused, not allowed. */
  it("refuses unknown statuses rather than falling through", () => {
    for (const status of ["Whatever", "DRAFT", "draft", "Re-jected", "Accepted ", 42, {}, []]) {
      assert.equal(isEditableStatus(status), false, String(status));
      assert.equal(mayBeginInitialSubmission(status), false, String(status));
    }
  });

  it("names the status in the refusal and points at the right route", () => {
    const message = editBlockedMessage("Accepted");
    assert.match(message, /Accepted/);
    assert.match(message, /amend or cancel/);
  });
});
