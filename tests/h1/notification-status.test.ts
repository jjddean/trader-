import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shouldApplyNotificationStatus,
  statusFromNotificationType,
} from "../../convex/lib/notification_status";

describe("notification status precedence", () => {
  it("DMSCLE clears after Accepted", () => {
    assert.equal(statusFromNotificationType("DMSCLE", true), "Cleared");
    assert.equal(
      shouldApplyNotificationStatus("Accepted", "Cleared"),
      true,
    );
  });

  it("DMSACC does not downgrade Cleared", () => {
    assert.equal(
      shouldApplyNotificationStatus("Cleared", "Accepted"),
      false,
    );
  });

  it("DMSREJ overrides Accepted", () => {
    assert.equal(
      shouldApplyNotificationStatus("Accepted", "Rejected"),
      true,
    );
  });

  it("DMSTAX does not downgrade Accepted", () => {
    assert.equal(
      shouldApplyNotificationStatus("Accepted", "Accepted"),
      true,
    );
    const taxStatus = statusFromNotificationType("DMSTAX", true);
    assert.equal(taxStatus, "Accepted");
    assert.equal(
      shouldApplyNotificationStatus("Accepted", taxStatus),
      true,
    );
  });
});
