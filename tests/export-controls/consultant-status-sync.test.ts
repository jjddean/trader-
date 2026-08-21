import assert from "node:assert/strict";
import { describe, it, afterEach, beforeEach } from "node:test";
import { pushCaseStatusToPartner } from "../../src/lib/export-controls/partner-dispatch";
import { sourceSlug } from "../../src/lib/export-controls/partner-registry";
import { verifyPartnerSignature } from "../../src/lib/export-controls/partner-signature";

/**
 * The outbound half of the status contract.
 *
 * Two defects lived here and neither unit suite caught them, because each side
 * was tested against its own idea of the payload:
 *
 *   1. `source` carried the PARTNER's slug ("bec") instead of ours
 *      ("freightcode"). The partner authenticates the sender by that field, so
 *      every status update was rejected as an unknown source.
 *   2. `externalCaseId` carried the id the PARTNER generated and returned,
 *      instead of the id we sent them at intake. The partner keys the case on
 *      what we sent, so the lookup missed even once the slug was right.
 *
 * Both are invisible to a test that only checks one side. These assert the
 * exact bytes we put on the wire, against the contract in BEC's
 * docs/INTEGRATION.md — and BEC's own suite asserts it accepts that shape.
 */

const PARTNER = {
  slug: "bec",
  name: "British Export Control",
  intakeUrl: "https://bec.example/api/integrations/cases",
  inboundKey: "in_key",
  outboundKey: "out_key",
  outboundSigningKey: "outbound-signing-key-with-at-least-32-bytes",
  keyId: "bec-2026-01",
};

/** The id WE generated and sent at intake — a Convex expert_requests id. */
const OUR_DISPATCH_ID = "qd7crc3mjnnspnypp639vd96618ctfb4";
/** The id the PARTNER generated and handed back. Must never be sent back. */
const PARTNER_CASE_UUID = "1a3881e0-816a-41aa-b64a-07d8e4ee7341";

const realFetch = globalThis.fetch;
let captured: {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  redirect?: RequestRedirect;
} | null;

beforeEach(() => {
  captured = null;
  delete process.env.CONSULTANT_ALLOW_LEGACY_BEARER;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = {
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? "{}")),
      redirect: init?.redirect,
    };
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.CONSULTANT_SOURCE_SLUG;
  delete process.env.CONSULTANT_ALLOW_LEGACY_BEARER;
});

describe("outbound status payload", () => {
  it("identifies us as the source, not the partner", async () => {
    await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "completed");

    assert.equal(captured?.body.source, "freightcode");
    assert.notEqual(captured?.body.source, PARTNER.slug);
  });

  it("sends the id we gave at intake, not the one the partner returned", async () => {
    await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "completed");

    assert.equal(captured?.body.externalCaseId, OUR_DISPATCH_ID);
    assert.notEqual(captured?.body.externalCaseId, PARTNER_CASE_UUID);
  });

  it("posts to the status endpoint with the partner's outbound key", async () => {
    await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "revoked");

    assert.equal(captured?.url, "https://bec.example/api/integrations/cases/status");
    assert.equal(
      (captured?.headers as Record<string, string>).Authorization,
      "Bearer out_key",
    );
    assert.equal(captured?.redirect, "manual");
    assert.equal(
      (captured?.headers as Record<string, string>)["x-fc-signature-version"],
      "v1",
    );
  });

  it("signs the exact status bytes and target", async () => {
    await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "revoked");
    assert.ok(captured);
    const body = JSON.stringify(captured.body);
    const request = new Request(captured.url, {
      method: "POST",
      headers: captured.headers,
      body,
    });
    const verified = verifyPartnerSignature({
      request,
      rawBody: body,
      signingKey: PARTNER.outboundSigningKey,
      keyId: PARTNER.keyId,
    });
    assert.equal(verified.ok, true);
  });

  it("carries the status verbatim", async () => {
    for (const status of ["in_review", "completed", "blocked", "revoked", "expired"] as const) {
      await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, status);
      assert.equal(captured?.body.status, status);
    }
  });

  /** The full payload, so an accidental extra field is noticed. */
  it("sends exactly source, externalCaseId and status", async () => {
    await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "completed");

    assert.deepEqual(captured?.body, {
      source: "freightcode",
      externalCaseId: OUR_DISPATCH_ID,
      status: "completed",
    });
  });

  it("honours an overridden source slug", async () => {
    process.env.CONSULTANT_SOURCE_SLUG = "freightcode-eu";
    await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "completed");
    assert.equal(captured?.body.source, "freightcode-eu");
  });

  it("reports a partner rejection rather than swallowing it", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })) as typeof fetch;

    const result = await pushCaseStatusToPartner(PARTNER, OUR_DISPATCH_ID, "completed");
    assert.equal(result.ok, false);
    assert.equal(result.error, "Unauthorized");
  });

  it("does not call out when no intake URL is configured", async () => {
    const result = await pushCaseStatusToPartner(
      { ...PARTNER, intakeUrl: undefined },
      OUR_DISPATCH_ID,
      "completed",
    );
    assert.equal(result.ok, false);
    assert.equal(captured, null);
  });

  it("fails closed when request signing is not configured", async () => {
    const result = await pushCaseStatusToPartner(
      { ...PARTNER, outboundSigningKey: undefined, keyId: undefined },
      OUR_DISPATCH_ID,
      "completed",
    );
    assert.equal(result.ok, false);
    assert.equal(captured, null);
  });
});

describe("source identity", () => {
  it("defaults to freightcode", () => {
    assert.equal(sourceSlug(), "freightcode");
  });
});
