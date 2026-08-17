import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasTenantAccess, isPersonalScopedRecord } from "../convex/lib/org_access";

const USER = "user_creator";
const OTHER = "user_other";
const ORG_A = "org_a";
const ORG_B = "org_b";

describe("tenant access", () => {
  it("lets the creator reach their own personal-scoped record", () => {
    assert.equal(hasTenantAccess({ userId: USER }, USER, null), true);
    assert.equal(hasTenantAccess({ userId: USER, orgId: "" }, USER, null), true);
    assert.equal(hasTenantAccess({ userId: USER, orgId: "   " }, USER, ORG_A), true);
  });

  it("refuses another user's personal-scoped record", () => {
    assert.equal(hasTenantAccess({ userId: USER }, OTHER, null), false);
    assert.equal(hasTenantAccess({ userId: USER }, OTHER, ORG_A), false);
  });

  it("lets a member of the owning org reach an org record", () => {
    assert.equal(hasTenantAccess({ userId: USER, orgId: ORG_A }, OTHER, ORG_A), true);
  });

  it("refuses a member of a different org", () => {
    assert.equal(hasTenantAccess({ userId: USER, orgId: ORG_A }, OTHER, ORG_B), false);
  });

  /**
   * The bypass. The creator shortcut ran before the org comparison and returned
   * unconditionally, so leaving Org A — or merely switching active org to B —
   * left the original creator with access to Org A's records.
   */
  it("refuses the creator once their active org is no longer the record's org", () => {
    assert.equal(hasTenantAccess({ userId: USER, orgId: ORG_A }, USER, ORG_B), false);
  });

  it("refuses the creator with no active org on an org-scoped record", () => {
    assert.equal(hasTenantAccess({ userId: USER, orgId: ORG_A }, USER, null), false);
    assert.equal(hasTenantAccess({ userId: USER, orgId: ORG_A }, USER, ""), false);
  });

  it("still allows the creator while their active org matches", () => {
    assert.equal(hasTenantAccess({ userId: USER, orgId: ORG_A }, USER, ORG_A), true);
  });

  it("treats whitespace and missing org ids as personal scope", () => {
    assert.equal(isPersonalScopedRecord(undefined), true);
    assert.equal(isPersonalScopedRecord(""), true);
    assert.equal(isPersonalScopedRecord("  "), true);
    assert.equal(isPersonalScopedRecord(ORG_A), false);
  });

  it("does not grant access on a missing userId matching a missing caller", () => {
    assert.equal(hasTenantAccess({}, "", null), true, "empty caller matches empty owner");
    assert.equal(hasTenantAccess({}, USER, null), false);
  });
});
