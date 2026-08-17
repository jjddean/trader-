import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertInventoryPreconditions,
  classifyCnsDeclarationResponse,
} from "../../src/lib/cns/declarations";
import type { CnsConfig } from "../../src/lib/cns/config";

const config: CnsConfig = {
  enabled: true,
  environment: "euat",
  baseUrl: "https://www.euat.cnsonline.co.uk/api",
  username: "test",
  password: "test",
  badgeId: "RKA",
  topic: "SOTFRETOP",
  gatewayEpu: "155",
  goodsLocationCode: "GBAULGPLGPLGP1",
  submitterEori: "",
  declarationAccept: "application/vnd.hmrc.1.0+xml",
  notificationAccept: "application/vnd.csp.1.0+xml",
  userAgent: { vendor: "Freightcode", application: "Freightcode", version: "1", clientId: "Freightcode" },
  notificationMode: "pull",
  batchMax: 20,
  pollIntervalSeconds: 30,
  pollLeaseSeconds: 90,
  requestTimeoutMs: 30000,
  unknownOutcomeObservationSeconds: 300,
  maxConsecutivePollFailuresBeforeAlert: 3,
  compassUrl: "https://www.euat.cnsonline.co.uk",
};

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

describe("CNS operation-specific inventory preconditions", () => {
  const followUpXml = "<MetaData><Declaration><ID>26GB8SOB7DEPJNTAR2</ID></Declaration></MetaData>";

  it("does not require create-only inventory fields on amendments", () => {
    assert.doesNotThrow(() => assertInventoryPreconditions(config, {
      operation: "amend",
      xmlPayload: followUpXml,
      ucn: "LGP100DPT00100",
    }));
  });

  it("does not require create-only inventory fields on cancellations", () => {
    assert.doesNotThrow(() => assertInventoryPreconditions(config, {
      operation: "cancel",
      xmlPayload: followUpXml,
    }));
  });

  it("still blocks an incomplete create payload", () => {
    assert.throws(() => assertInventoryPreconditions(config, {
      operation: "create",
      xmlPayload: followUpXml,
      ucn: "LGP100DPT00100",
    }), /Inventory-linked XML is incomplete/);
  });
});
