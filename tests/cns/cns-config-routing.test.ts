import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCnsUserAgent,
  describeCnsConfig,
  validateCnsConfig,
  type CnsConfig,
} from "../../src/lib/cns/config";
import { resolveCnsUrl } from "../../src/lib/cns/client";
import {
  CnsRoutingError,
  isCnsInventoryLocation,
  selectDeclarationTransport,
  transportForFollowUp,
} from "../../src/lib/cns/routing";
import {
  cnsTransportFailure,
  isOutcomeUnknown,
  isRetryable,
  normalizeCnsError,
} from "../../src/lib/cns/errors";

/** Valid EUAT configuration, matching the values CNS supplied for FreightCode. */
function euatConfig(overrides: Partial<CnsConfig> = {}): CnsConfig {
  return {
    enabled: true,
    environment: "euat",
    baseUrl: "https://www.euat.cnsonline.co.uk/api",
    username: "SOTFRECCMI",
    password: "not-a-real-password",
    badgeId: "RKA",
    topic: "SOTFRETOP",
    gatewayEpu: "155",
    goodsLocationCode: "GBAULGPLGPLGP1",
    submitterEori: "",
    declarationAccept: "application/vnd.hmrc.1.0+xml",
    notificationAccept: "application/vnd.csp.1.0+xml",
    userAgent: {
      vendor: "Freightcode",
      application: "Freightcode",
      version: "1.0.0",
      clientId: "Freightcode",
    },
    notificationMode: "pull",
    batchMax: 20,
    pollIntervalSeconds: 30,
    pollLeaseSeconds: 90,
    requestTimeoutMs: 30000,
    unknownOutcomeObservationSeconds: 300,
    maxConsecutivePollFailuresBeforeAlert: 3,
    compassUrl: "https://www.euat.cnsonline.co.uk",
    ...overrides,
  };
}

describe("validateCnsConfig", () => {
  it("accepts the supplied EUAT configuration", () => {
    assert.deepEqual(validateCnsConfig(euatConfig()), []);
  });

  it("skips all checks when the integration is disabled", () => {
    assert.deepEqual(validateCnsConfig(euatConfig({ enabled: false, password: "" })), []);
  });

  it("refuses to enable without each required credential", () => {
    for (const field of ["baseUrl", "username", "password", "badgeId", "topic"] as const) {
      const errors = validateCnsConfig(euatConfig({ [field]: "" } as Partial<CnsConfig>));
      assert.ok(errors.length > 0, `expected an error when ${field} is missing`);
    }
  });

  it("never echoes the password in an error message", () => {
    const errors = validateCnsConfig(
      euatConfig({ password: "SUPER-SECRET-VALUE", baseUrl: "http://insecure.example" }),
    );
    assert.ok(errors.length > 0);
    assert.ok(!errors.join(" ").includes("SUPER-SECRET-VALUE"));
  });

  it("requires https", () => {
    const errors = validateCnsConfig(euatConfig({ baseUrl: "http://www.euat.cnsonline.co.uk/api" }));
    assert.ok(errors.some((e) => e.includes("https")));
  });

  it("pins the declaration and notification media types", () => {
    assert.ok(
      validateCnsConfig(euatConfig({ declarationAccept: "application/vnd.hmrc.2.0+xml" })).length > 0,
    );
    assert.ok(
      validateCnsConfig(euatConfig({ notificationAccept: "application/vnd.csp.2.0+xml" })).length > 0,
    );
  });

  it("enforces the 30 second minimum poll interval", () => {
    const errors = validateCnsConfig(euatConfig({ pollIntervalSeconds: 5 }));
    assert.ok(errors.some((e) => e.includes("30")));
  });

  it("rejects a batch size outside 1..100", () => {
    assert.ok(validateCnsConfig(euatConfig({ batchMax: 0 })).length > 0);
    assert.ok(validateCnsConfig(euatConfig({ batchMax: 101 })).length > 0);
  });

  it("requires the lease to outlast the poll interval", () => {
    const errors = validateCnsConfig(euatConfig({ pollLeaseSeconds: 30, pollIntervalSeconds: 30 }));
    assert.ok(errors.some((e) => e.includes("LEASE")));
  });

  it("blocks the production host on a non-production deployment", () => {
    const errors = validateCnsConfig(
      euatConfig({ baseUrl: "https://www.cnsonline.co.uk/api" }),
    );
    assert.ok(errors.some((e) => e.toLowerCase().includes("production")));
  });
});

describe("describeCnsConfig", () => {
  it("reports whether a password exists without revealing it", () => {
    const described = describeCnsConfig(euatConfig({ password: "SUPER-SECRET-VALUE" }));
    assert.equal(described.passwordConfigured, true);
    assert.ok(!JSON.stringify(described).includes("SUPER-SECRET-VALUE"));
  });
});

describe("buildCnsUserAgent", () => {
  it("emits the documented five-field format including the badge", () => {
    assert.equal(
      buildCnsUserAgent(euatConfig()),
      "Vendor=Freightcode, Application=Freightcode, Version=1.0.0, Badge=RKA, ClientID=Freightcode",
    );
  });
});

describe("resolveCnsUrl — SSRF guard", () => {
  const config = euatConfig();

  it("resolves a relative path under the configured base", () => {
    assert.equal(
      resolveCnsUrl(config, "/cds/customs/declarations/"),
      "https://www.euat.cnsonline.co.uk/api/cds/customs/declarations/",
    );
  });

  it("refuses an absolute URL to another origin", () => {
    assert.throws(() => resolveCnsUrl(config, "https://evil.example/api/x"), /unexpected origin/i);
  });

  it("refuses traversal outside the base path", () => {
    assert.throws(() => resolveCnsUrl(config, "/../../etc/passwd"), /base path|unexpected origin/i);
  });
});

describe("selectDeclarationTransport", () => {
  const config = euatConfig();
  const importAtCns = { route: "import", locationId: "GBAULGPLGPLGP1", cnsUcn: "LGP100DPS00100" };
  const entitledOrg = { cnsClearanceEnabled: true };

  it("routes an eligible inventory-linked import to CNS", () => {
    const decision = selectDeclarationTransport(importAtCns, entitledOrg, {}, config);
    assert.equal(decision.transport, "cns_inventory");
  });

  it("routes a non-CNS location direct to HMRC", () => {
    const decision = selectDeclarationTransport(
      { ...importAtCns, locationId: "GBAUFXTFXTFXT" },
      entitledOrg,
      {},
      config,
    );
    assert.equal(decision.transport, "hmrc_direct");
  });

  it("records the decision inputs for audit", () => {
    const decision = selectDeclarationTransport(importAtCns, entitledOrg, {}, config);
    assert.ok(decision.reasons.length > 0);
    assert.ok(decision.reasons.some((r) => r.includes("GBAULGPLGPLGP1")));
  });

  it("refuses rather than silently falling back when the UCN is missing", () => {
    // Falling back to the direct route would send a frontier declaration for an
    // inventory-linked port to CDS with no CSP pre-check.
    assert.throws(
      () => selectDeclarationTransport({ ...importAtCns, cnsUcn: "" }, entitledOrg, {}, config),
      CnsRoutingError,
    );
  });

  it("refuses when the organisation is not entitled", () => {
    assert.throws(
      () => selectDeclarationTransport(importAtCns, { cnsClearanceEnabled: false }, {}, config),
      /not enabled/i,
    );
  });

  it("refuses when the client holds their own CNS badge", () => {
    // CNS compliance rule: the declarant must use the badge the inventory is
    // assigned to, and a badge must not be shared across client logins.
    assert.throws(
      () => selectDeclarationTransport(importAtCns, entitledOrg, { cnsBadgeHolder: true }, config),
      /own CNS badge/i,
    );
  });

  it("refuses exports — a separate phase", () => {
    assert.throws(
      () =>
        selectDeclarationTransport({ ...importAtCns, route: "export" }, entitledOrg, {}, config),
      /imports only/i,
    );
  });

  it("refuses when CNS is disabled but the location demands it", () => {
    assert.throws(
      () => selectDeclarationTransport(importAtCns, entitledOrg, {}, euatConfig({ enabled: false })),
      /disabled or misconfigured/i,
    );
  });
});

describe("isCnsInventoryLocation", () => {
  it("matches case-insensitively and ignores surrounding space", () => {
    assert.equal(isCnsInventoryLocation("  gbaulgplgplgp1 ", euatConfig()), true);
  });

  it("is false for a blank location", () => {
    assert.equal(isCnsInventoryLocation("", euatConfig()), false);
  });
});

describe("transportForFollowUp", () => {
  it("keeps a CNS declaration on the CNS route for amend and cancel", () => {
    assert.equal(transportForFollowUp("cns_inventory"), "cns_inventory");
  });

  it("defaults to direct for anything else, including legacy rows", () => {
    assert.equal(transportForFollowUp(undefined), "hmrc_direct");
    assert.equal(transportForFollowUp("hmrc_direct"), "hmrc_direct");
  });
});

describe("normalizeCnsError", () => {
  it("parses the MCP <errorResponse> shape", () => {
    const error = normalizeCnsError(
      403,
      "<errorResponse><code>INVALID_BADGE_ID</code><message>Badge ID not associated with user account</message></errorResponse>",
    );
    assert.equal(error.code, "INVALID_BADGE_ID");
    assert.equal(error.disposition, "stop_configuration");
    assert.equal(error.alert, true);
  });

  it("parses the CNS <error> shape", () => {
    const error = normalizeCnsError(
      403,
      "<error><code>INVALID_BADGE_ID</code><message>Badge ID not associated with user account</message></error>",
    );
    assert.equal(error.code, "INVALID_BADGE_ID");
  });

  it("extracts nested errorDetail schema failures from a 400", () => {
    const error = normalizeCnsError(
      400,
      `<?xml version="1.0" encoding="UTF-8"?>
<errorResponse>
<code>400</code>
<message>Bad Request - Payload is not valid according to schema</message>
<errorDetail>
<errors>
<error>
<code>xml_validation_error</code>
<message>cvc-complex-type.2.4.a: Invalid content was found starting with element 'TypeCode'.</message>
</error>
</errors>
</errorDetail>
</errorResponse>`,
    );
    assert.equal(error.details.length, 1);
    assert.equal(error.details[0].code, "xml_validation_error");
    assert.match(error.details[0].message, /cvc-complex-type/);
  });

  it("never retries a payload defect", () => {
    const error = normalizeCnsError(400, "<error><code>MALFORMED_XML</code></error>");
    assert.equal(error.disposition, "stop_payload");
    assert.equal(isRetryable(error), false);
  });

  it("treats 429 as retryable backoff, not failure", () => {
    const error = normalizeCnsError(429, "");
    assert.equal(isRetryable(error), true);
    assert.equal(isOutcomeUnknown(error), false);
  });

  it("treats 5xx and gateway timeouts as unknown outcome, never as rejection", () => {
    for (const status of [500, 502, 503, 504]) {
      const error = normalizeCnsError(status, "");
      assert.equal(isOutcomeUnknown(error), true, `status ${status}`);
    }
  });

  it("treats 423 LOCKED_PUSH_MESSAGING_ACTIVE as a configuration stop", () => {
    const error = normalizeCnsError(
      423,
      "<errorResponse><code>LOCKED_PUSH_MESSAGING_ACTIVE</code><message>The topic is locked</message></errorResponse>",
    );
    assert.equal(error.disposition, "stop_configuration");
  });

  it("treats a transport failure as unknown outcome", () => {
    const error = cnsTransportFailure(new Error("socket hang up"));
    assert.equal(isOutcomeUnknown(error), true);
    assert.equal(error.httpStatus, 0);
  });
});
