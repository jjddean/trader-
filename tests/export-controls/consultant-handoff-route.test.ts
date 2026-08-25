import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST } from "../../src/app/api/consultant-partner/handoff/route";
import { createPartnerSignatureHeaders } from "../../src/lib/export-controls/partner-signature";

const URL = "https://freightcode.example/api/consultant-partner/handoff";
const INBOUND_KEY = "bec-inbound-bearer-key-for-route-tests";
const SIGNING_KEY = "bec-inbound-signing-key-with-at-least-32-bytes";
const KEY_ID = "bec-2026-01";
const PARTNER_SECRET = "next-to-convex-partner-secret-for-tests";

const previousPartners = process.env.CONSULTANT_PARTNER_INBOUND;
const previousPartnerSecret = process.env.CONSULTANT_PARTNER_SECRET;
const previousLegacy = process.env.CONSULTANT_ALLOW_LEGACY_BEARER;

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  process.env.CONSULTANT_PARTNER_INBOUND = JSON.stringify([
    {
      slug: "bec",
      name: "British Export Control",
      inboundKey: INBOUND_KEY,
      inboundSigningKey: SIGNING_KEY,
      keyId: KEY_ID,
    },
  ]);
  process.env.CONSULTANT_PARTNER_SECRET = PARTNER_SECRET;
  delete process.env.CONSULTANT_ALLOW_LEGACY_BEARER;
});

afterEach(() => {
  restore("CONSULTANT_PARTNER_INBOUND", previousPartners);
  restore("CONSULTANT_PARTNER_SECRET", previousPartnerSecret);
  restore("CONSULTANT_ALLOW_LEGACY_BEARER", previousLegacy);
});

function request(rawBody: string, options?: { signed?: boolean; timestamp?: number; contentType?: string }) {
  const signatureHeaders = options?.signed
    ? createPartnerSignatureHeaders({
        method: "POST",
        url: URL,
        rawBody,
        signingKey: SIGNING_KEY,
        keyId: KEY_ID,
        requestId: "308d101f-f2bb-4f97-9bb0-a5662909d377",
        timestamp: options.timestamp,
      })
    : {};
  return new Request(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INBOUND_KEY}`,
      "Content-Type": options?.contentType ?? "application/json",
      ...signatureHeaders,
    },
    body: rawBody,
  });
}

describe("consultant handoff route boundary", () => {
  it("requires HMAC even when the bearer credential is valid", async () => {
    const response = await POST(request("{}"));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  });

  it("rejects stale signed requests", async () => {
    const response = await POST(
      request("{}", { signed: true, timestamp: Date.now() - 5 * 60 * 1000 - 1 }),
    );
    assert.equal(response.status, 401);
  });

  it("rejects non-JSON content before parsing", async () => {
    const response = await POST(request("externalCaseId=x", { contentType: "text/plain" }));
    assert.equal(response.status, 415);
  });

  it("rejects an oversized body before signature verification", async () => {
    const response = await POST(request("x".repeat(16 * 1024 + 1)));
    assert.equal(response.status, 413);
  });

  it("rejects unknown signed fields without calling Convex", async () => {
    const rawBody = JSON.stringify({
      externalCaseId: "dispatch_123",
      consultant: { id: "consultant_456" },
      unexpected: true,
    });
    const response = await POST(request(rawBody, { signed: true }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid request" });
  });
});
