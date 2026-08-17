import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  managedServiceBindingConflict,
  managedServiceClientToReuse,
} from "../convex/lib/managed_service_binding";

const MANAGED = "org_managed";
const BROKER = "org_broker";

describe("managed service portal binding", () => {
  it("allows a first-time sign-up with no existing client", () => {
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk: null, byEmail: null }),
      null,
    );
    assert.equal(managedServiceClientToReuse(null, null), null);
  });

  it("reuses the row already bound to this Clerk user", () => {
    const byClerk = { _id: "c1", orgId: MANAGED };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk, byEmail: null }),
      null,
    );
    assert.equal(managedServiceClientToReuse(byClerk, null), byClerk);
  });

  // The production lock-out: user re-signed up on a new Clerk account with the
  // same email, so portalClerkId pointed at their old Clerk id.
  it("re-binds a managed row matched by the caller's own email to the new Clerk user", () => {
    const byEmail = { _id: "c1", orgId: MANAGED };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk: null, byEmail }),
      null,
    );
    assert.equal(managedServiceClientToReuse(null, byEmail), byEmail);
  });

  // Same shape, after a broker revoked portal access and cleared the binding.
  it("re-binds a managed row that has no orgId recorded", () => {
    const byEmail = { _id: "c1", orgId: undefined };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk: null, byEmail }),
      null,
    );
    assert.equal(managedServiceClientToReuse(null, byEmail), byEmail);
  });

  it("refuses to pull a broker-owned client into the managed org via Clerk id", () => {
    assert.equal(
      managedServiceBindingConflict({
        managedOrgId: MANAGED,
        byClerk: { _id: "c1", orgId: BROKER },
        byEmail: null,
      }),
      "portal_linked_to_broker",
    );
  });

  it("refuses to pull a broker-owned client into the managed org via email", () => {
    assert.equal(
      managedServiceBindingConflict({
        managedOrgId: MANAGED,
        byClerk: null,
        byEmail: { _id: "c1", orgId: BROKER },
      }),
      "email_belongs_to_broker_client",
    );
  });

  // The 2026-08-17 production lock-out. FREIGHTCODE_MANAGED_ORG_ID was changed,
  // so every client created under the previous value compared unequal to the
  // configured org and read as broker-owned. Existing customers were told their
  // address "is already registered as a broker's client".
  it("recognises a managed row created under a previous managed org id", () => {
    const byEmail = { _id: "c1", orgId: "org_previous_managed", managedService: true };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk: null, byEmail }),
      null,
    );
    assert.equal(managedServiceClientToReuse(null, byEmail), byEmail);
  });

  it("recognises a managed row matched by Clerk id under a previous org id", () => {
    const byClerk = { _id: "c1", orgId: "org_previous_managed", managedService: true };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk, byEmail: null }),
      null,
    );
  });

  // The flag must not become a way into a broker's client.
  it("still refuses a broker-owned row that is not flagged", () => {
    assert.equal(
      managedServiceBindingConflict({
        managedOrgId: MANAGED,
        byClerk: null,
        byEmail: { _id: "c1", orgId: BROKER, managedService: false },
      }),
      "email_belongs_to_broker_client",
    );
  });

  it("does not double-report when both lookups hit the same broker row", () => {
    const row = { _id: "c1", orgId: BROKER };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk: row, byEmail: row }),
      "portal_linked_to_broker",
    );
  });

  it("prefers the Clerk-bound row when the email points at a different managed row", () => {
    const byClerk = { _id: "c1", orgId: MANAGED };
    const byEmail = { _id: "c2", orgId: MANAGED };
    assert.equal(
      managedServiceBindingConflict({ managedOrgId: MANAGED, byClerk, byEmail }),
      null,
    );
    assert.equal(managedServiceClientToReuse(byClerk, byEmail), byClerk);
  });
});
