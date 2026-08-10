import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  basicAuthorization,
  readCnsNotificationConfig,
  validateCnsNotificationConfig,
  MIN_POLL_INTERVAL_SECONDS,
  type CnsNotificationConfig,
} from "../../convex/lib/cns_config";
import {
  notificationErrorCode,
  parseConsumerEndpoint,
} from "../../convex/lib/cns_notification_client";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function config(overrides: Partial<CnsNotificationConfig> = {}): CnsNotificationConfig {
  return {
    enabled: true,
    baseUrl: "https://www.euat.cnsonline.co.uk/api",
    username: "SOTFRECCMI",
    password: "not-a-real-password",
    topic: "SOTFRETOP",
    notificationAccept: "application/vnd.csp.1.0+xml",
    userAgent: "Vendor=Freightcode, Application=Freightcode, Version=1.0.0, Badge=RKA, ClientID=Freightcode",
    batchMax: 20,
    pollIntervalSeconds: 30,
    pollLeaseSeconds: 90,
    requestTimeoutMs: 30000,
    mode: "pull",
    maxConsecutiveFailuresBeforeAlert: 3,
    ...overrides,
  };
}

describe("basicAuthorization", () => {
  it("base64-encodes username:password", () => {
    assert.equal(basicAuthorization("joebloggs", "password"), "Basic am9lYmxvZ2dzOnBhc3N3b3Jk");
  });

  it("handles a non-ASCII password", () => {
    // btoa alone throws on any character above U+00FF, so the credential must be
    // UTF-8 encoded first. A CSP password is not guaranteed to be ASCII.
    const value = basicAuthorization("SOTFRECCMI", "pä55wörd–ü");
    assert.ok(value.startsWith("Basic "));
    const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
    assert.equal(decoded, "SOTFRECCMI:pä55wörd–ü");
  });
});

describe("readCnsNotificationConfig", () => {
  it("is disabled unless CNS_ENABLED is exactly 'true'", () => {
    assert.equal(withEnv({ CNS_ENABLED: undefined }, readCnsNotificationConfig).enabled, false);
    assert.equal(withEnv({ CNS_ENABLED: "yes" }, readCnsNotificationConfig).enabled, false);
    assert.equal(withEnv({ CNS_ENABLED: "true" }, readCnsNotificationConfig).enabled, true);
  });

  it("clamps the poll interval up to the 30s floor", () => {
    // The floor is a published implementation restriction, not a preference.
    const result = withEnv({ CNS_POLL_INTERVAL_SECONDS: "5" }, readCnsNotificationConfig);
    assert.equal(result.pollIntervalSeconds, MIN_POLL_INTERVAL_SECONDS);
  });

  it("clamps the batch size into 1..100", () => {
    assert.equal(withEnv({ CNS_NOTIFICATION_BATCH_MAX: "0" }, readCnsNotificationConfig).batchMax, 1);
    assert.equal(
      withEnv({ CNS_NOTIFICATION_BATCH_MAX: "500" }, readCnsNotificationConfig).batchMax,
      100,
    );
  });

  it("defaults to pull mode", () => {
    assert.equal(withEnv({ CNS_NOTIFICATION_MODE: undefined }, readCnsNotificationConfig).mode, "pull");
    assert.equal(withEnv({ CNS_NOTIFICATION_MODE: "push" }, readCnsNotificationConfig).mode, "push");
  });

  it("builds the User-Agent with the configured badge", () => {
    const result = withEnv(
      { CNS_BADGE_ID: "RKA", CNS_USER_AGENT_VERSION: "2.1.0" },
      readCnsNotificationConfig,
    );
    assert.match(result.userAgent, /Badge=RKA/);
    assert.match(result.userAgent, /Version=2\.1\.0/);
  });
});

describe("validateCnsNotificationConfig", () => {
  it("accepts a complete configuration", () => {
    assert.deepEqual(validateCnsNotificationConfig(config()), []);
  });

  it("skips validation when disabled", () => {
    assert.deepEqual(validateCnsNotificationConfig(config({ enabled: false, password: "" })), []);
  });

  it("requires https", () => {
    const errors = validateCnsNotificationConfig(config({ baseUrl: "http://x.example/api" }));
    assert.ok(errors.some((e) => e.includes("https")));
  });

  it("reports each missing credential", () => {
    for (const field of ["baseUrl", "username", "password", "topic"] as const) {
      assert.ok(
        validateCnsNotificationConfig(config({ [field]: "" } as Partial<CnsNotificationConfig>))
          .length > 0,
        `expected an error for ${field}`,
      );
    }
  });

  it("never echoes the password", () => {
    const errors = validateCnsNotificationConfig(
      config({ password: "SECRET-VALUE", baseUrl: "http://x.example" }),
    );
    assert.ok(!errors.join(" ").includes("SECRET-VALUE"));
  });
});

describe("notificationErrorCode", () => {
  it("extracts the machine-readable code", () => {
    assert.equal(
      notificationErrorCode(
        "<errorResponse><code>LOCKED_PUSH_MESSAGING_ACTIVE</code><message>The topic is locked</message></errorResponse>",
      ),
      "LOCKED_PUSH_MESSAGING_ACTIVE",
    );
  });

  it("returns empty for a body with no code", () => {
    assert.equal(notificationErrorCode(""), "");
  });
});

describe("parseConsumerEndpoint", () => {
  it("reads the ACTUAL EUAT response — element form, empty, capitalised", () => {
    // Verbatim from CNS EUAT on 2026-08-08. An empty endpointUrl means no push
    // consumer, so pull is available.
    assert.equal(
      parseConsumerEndpoint("<Consumer><endpointUrl/><authorization/></Consumer>"),
      "",
    );
  });

  it("reads a populated element form", () => {
    assert.equal(
      parseConsumerEndpoint(
        "<Consumer><endpointUrl>https://api.example.co.uk/cds/notifications</endpointUrl><authorization>Basic ABC</authorization></Consumer>",
      ),
      "https://api.example.co.uk/cds/notifications",
    );
  });

  it("reads the attribute form documented in v1.0.3", () => {
    assert.equal(
      parseConsumerEndpoint(
        '<consumer endpointUrl="https://api.abcenterprise.co.uk/cds/notifications" authorization="Basic ABC"></consumer>',
      ),
      "https://api.abcenterprise.co.uk/cds/notifications",
    );
  });

  it("treats an empty attribute as no consumer", () => {
    assert.equal(parseConsumerEndpoint('<consumer endpointUrl="" authorization=""></consumer>'), "");
  });

  it("returns empty for an unrecognised body rather than guessing", () => {
    assert.equal(parseConsumerEndpoint(""), "");
    assert.equal(parseConsumerEndpoint("<something/>"), "");
  });
});
