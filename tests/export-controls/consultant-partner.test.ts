import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  authenticatePartner,
  bearerToken,
  defaultConsultantPartner,
  getConsultantPartner,
  listConsultantPartners,
} from "../../src/lib/export-controls/partner-registry";
import { partnerEndpoint } from "../../convex/lib/partner_config";

/**
 * Inbound and outbound configuration are deliberately separate variables in
 * separate runtimes: Convex only ever calls out to a partner, so it never
 * reads a credential the partner presents to us.
 */
const BEC_INBOUND_KEY = "bec_inbound_key_0123456789_abcdefghij";
const OTHER_INBOUND_KEY = "other_inbound_key_abcdefghijklmnopqrs";
const BEC_OUTBOUND_KEY = "bec_outbound_key_9876543210_abcdefghij";

const INBOUND = JSON.stringify([
  {
    slug: "bec",
    name: "British Export Control",
    inboundKey: BEC_INBOUND_KEY,
    inboundSigningKey: "bec-inbound-signing-key-with-at-least-32-bytes",
    keyId: "bec-2026-01",
  },
  {
    slug: "other",
    name: "Other Consultancy",
    inboundKey: OTHER_INBOUND_KEY,
  },
]);

const OUTBOUND = JSON.stringify([
  {
    slug: "bec",
    name: "British Export Control",
    intakeUrl: "https://bec.example/api/integrations/cases",
    outboundKey: BEC_OUTBOUND_KEY,
    outboundSigningKey: "bec-outbound-signing-key-with-at-least-32-bytes",
    keyId: "bec-2026-01",
  },
]);

const originalInbound = process.env.CONSULTANT_PARTNER_INBOUND;
const originalOutbound = process.env.CONSULTANT_PARTNER_OUTBOUND;
const originalDefault = process.env.CONSULTANT_DEFAULT_PARTNER;

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("CONSULTANT_PARTNER_INBOUND", originalInbound);
  restore("CONSULTANT_PARTNER_OUTBOUND", originalOutbound);
  restore("CONSULTANT_DEFAULT_PARTNER", originalDefault);
});

function request(authorization?: string): Request {
  return new Request("https://freightcode.example/api/consultant-partner/handoff", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("partner registry", () => {
  it("parses configured partners", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    const partners = listConsultantPartners();
    assert.equal(partners.length, 2);
    assert.equal(partners[0].slug, "bec");
    assert.equal(partners[0].name, "British Export Control");
    assert.equal(partners[0].keyId, "bec-2026-01");
    assert.ok(partners[0].inboundSigningKey);
  });

  it("configures no partners when unset", () => {
    delete process.env.CONSULTANT_PARTNER_INBOUND;
    assert.deepEqual(listConsultantPartners(), []);
  });

  /** Bad config must fail closed, not throw at request time. */
  it("configures no partners when the JSON is malformed", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = "{not json";
    assert.deepEqual(listConsultantPartners(), []);
  });

  it("skips entries missing a slug, or whose credential is too weak", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = JSON.stringify([
      { slug: "nokey", name: "No key" },
      { inboundKey: OTHER_INBOUND_KEY, name: "No slug" },
      { slug: "weak", inboundKey: "k" },
      { slug: "good", inboundKey: OTHER_INBOUND_KEY },
    ]);
    const partners = listConsultantPartners();
    assert.equal(partners.length, 1);
    assert.equal(partners[0].slug, "good");
  });

  /** A signing key or key id that fails validation is dropped, not trusted. */
  it("drops a weak signing key and a malformed key id", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = JSON.stringify([
      {
        slug: "bec",
        inboundKey: BEC_INBOUND_KEY,
        inboundSigningKey: "short",
        keyId: "bad key id",
      },
    ]);
    const partner = getConsultantPartner("bec");
    assert.equal(partner?.inboundSigningKey, undefined);
    assert.equal(partner?.keyId, undefined);
  });

  it("defaults to the first partner, or the named one", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    delete process.env.CONSULTANT_DEFAULT_PARTNER;
    assert.equal(defaultConsultantPartner()?.slug, "bec");

    process.env.CONSULTANT_DEFAULT_PARTNER = "other";
    assert.equal(defaultConsultantPartner()?.slug, "other");
  });

  it("returns null for an unknown slug", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    assert.equal(getConsultantPartner("nobody"), null);
  });
});

describe("partner authentication", () => {
  it("rejects a missing credential", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    assert.equal(authenticatePartner(request()), null);
  });

  it("rejects a wrong credential", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    assert.equal(authenticatePartner(request("Bearer not-a-real-key")), null);
  });

  it("rejects a credential that is a prefix of a valid one", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    assert.equal(authenticatePartner(request("Bearer bec_inbound_key_012")), null);
  });

  it("accepts a valid credential and identifies the partner", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    const partner = authenticatePartner(request(`Bearer ${BEC_INBOUND_KEY}`));
    assert.equal(partner?.slug, "bec");
  });

  it("identifies the right partner when several are configured", () => {
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    const partner = authenticatePartner(request(`Bearer ${OTHER_INBOUND_KEY}`));
    assert.equal(partner?.slug, "other");
  });

  it("rejects everything when no partners are configured", () => {
    delete process.env.CONSULTANT_PARTNER_INBOUND;
    assert.equal(authenticatePartner(request(`Bearer ${BEC_INBOUND_KEY}`)), null);
  });

  it("parses the bearer scheme", () => {
    assert.equal(bearerToken("Bearer abc"), "abc");
    assert.equal(bearerToken("bearer abc"), "abc");
    assert.equal(bearerToken("Basic abc"), null);
  });
});

describe("convex-side partner endpoints", () => {
  it("reads the outbound configuration", () => {
    process.env.CONSULTANT_PARTNER_OUTBOUND = OUTBOUND;
    const endpoint = partnerEndpoint("bec");
    assert.equal(endpoint?.intakeUrl, "https://bec.example/api/integrations/cases");
    assert.equal(endpoint?.outboundKey, BEC_OUTBOUND_KEY);
    assert.equal(endpoint?.signingConfigurationInvalid, false);
  });

  /**
   * The two runtimes read separate variables on purpose. Inbound credentials
   * must never reach Convex, so the inbound variable configures nothing here.
   */
  it("ignores the inbound configuration", () => {
    delete process.env.CONSULTANT_PARTNER_OUTBOUND;
    process.env.CONSULTANT_PARTNER_INBOUND = INBOUND;
    assert.equal(partnerEndpoint("bec"), null);
  });

  it("returns null for an unknown or unconfigured partner", () => {
    process.env.CONSULTANT_PARTNER_OUTBOUND = OUTBOUND;
    assert.equal(partnerEndpoint("nobody"), null);
    delete process.env.CONSULTANT_PARTNER_OUTBOUND;
    assert.equal(partnerEndpoint("bec"), null);
  });

  it("accepts only strong signing keys and bounded safe key ids", () => {
    process.env.CONSULTANT_PARTNER_OUTBOUND = JSON.stringify([
      {
        slug: "valid",
        outboundKey: "o".repeat(32),
        outboundSigningKey: "s".repeat(32),
        keyId: "fc-key_2026.1",
      },
      {
        slug: "invalid",
        outboundKey: "o".repeat(32),
        outboundSigningKey: "short",
        keyId: "bad key id",
      },
    ]);
    const valid = partnerEndpoint("valid");
    assert.equal(valid?.outboundSigningKey, "s".repeat(32));
    assert.equal(valid?.keyId, "fc-key_2026.1");
    assert.equal(valid?.signingConfigurationInvalid, false);

    const invalid = partnerEndpoint("invalid");
    assert.equal(invalid?.outboundSigningKey, undefined);
    assert.equal(invalid?.keyId, undefined);
    assert.equal(invalid?.signingConfigurationInvalid, true);
  });

  /** A short outbound key is a misconfiguration, not a partner without signing. */
  it("flags an outbound key that is too weak", () => {
    process.env.CONSULTANT_PARTNER_OUTBOUND = JSON.stringify([
      { slug: "weak", outboundKey: "tooshort" },
    ]);
    const weak = partnerEndpoint("weak");
    assert.equal(weak?.outboundKey, undefined);
    assert.equal(weak?.signingConfigurationInvalid, true);
  });
});
