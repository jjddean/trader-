import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPartnerSignatureHeaders,
  isAllowedPartnerUrl,
  partnerBodyDigest,
  readRequestBodyLimited,
  readResponseBodyLimited,
  verifyPartnerSignature,
} from "../../src/lib/export-controls/partner-signature";

const URL = "https://freightcode.example/api/consultant-partner/handoff?version=1";
const KEY = "a-32-byte-minimum-partner-signing-key-for-tests";
const KEY_ID = "bec-2026-01";
const REQUEST_ID = "a763578c-1c61-48b0-b809-7f8fb73151ee";
const TIMESTAMP = 1_787_308_200_000;
const BODY = JSON.stringify({
  externalCaseId: "dispatch_123",
  consultant: { id: "consultant_456" },
});

function signedRequest(overrides?: {
  body?: string;
  url?: string;
  timestamp?: number;
  signingKey?: string;
}) {
  const body = overrides?.body ?? BODY;
  const url = overrides?.url ?? URL;
  const headers = createPartnerSignatureHeaders({
    method: "POST",
    url,
    rawBody: body,
    signingKey: overrides?.signingKey ?? KEY,
    keyId: KEY_ID,
    requestId: REQUEST_ID,
    timestamp: overrides?.timestamp ?? TIMESTAMP,
  });
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("consultant partner request signatures", () => {
  it("verifies the exact method, target, timestamp, digest and raw body", () => {
    const request = signedRequest();
    assert.deepEqual(
      verifyPartnerSignature({
        request,
        rawBody: BODY,
        signingKey: KEY,
        keyId: KEY_ID,
        now: TIMESTAMP,
      }),
      {
        ok: true,
        bodyDigest: partnerBodyDigest(BODY),
        requestId: REQUEST_ID,
        timestamp: TIMESTAMP,
      },
    );
  });

  it("rejects a changed body", () => {
    const request = signedRequest();
    const result = verifyPartnerSignature({
      request,
      rawBody: `${BODY} `,
      signingKey: KEY,
      keyId: KEY_ID,
      now: TIMESTAMP,
    });
    assert.deepEqual(result, { ok: false, reason: "digest" });
  });

  it("rejects a signature copied to another path", () => {
    const signed = signedRequest();
    const request = new Request("https://freightcode.example/api/consultant-partner/other?version=1", {
      method: "POST",
      headers: signed.headers,
      body: BODY,
    });
    const result = verifyPartnerSignature({
      request,
      rawBody: BODY,
      signingKey: KEY,
      keyId: KEY_ID,
      now: TIMESTAMP,
    });
    assert.deepEqual(result, { ok: false, reason: "signature" });
  });

  it("rejects stale and future timestamps", () => {
    for (const timestamp of [TIMESTAMP - 300_001, TIMESTAMP + 60_001]) {
      const request = signedRequest({ timestamp });
      const result = verifyPartnerSignature({
        request,
        rawBody: BODY,
        signingKey: KEY,
        keyId: KEY_ID,
        now: TIMESTAMP,
      });
      assert.deepEqual(result, { ok: false, reason: "timestamp" });
    }
  });

  it("rejects the wrong verification key", () => {
    const request = signedRequest();
    const result = verifyPartnerSignature({
      request,
      rawBody: BODY,
      signingKey: `${KEY}-wrong`,
      keyId: KEY_ID,
      now: TIMESTAMP,
    });
    assert.deepEqual(result, { ok: false, reason: "signature" });
  });
});

describe("partner transport boundaries", () => {
  it("accepts HTTPS targets and rejects credentialed or non-HTTPS targets", () => {
    assert.equal(isAllowedPartnerUrl("https://bec.example/api/integrations/cases"), true);
    assert.equal(isAllowedPartnerUrl("https://user:secret@bec.example/cases"), false);
    assert.equal(isAllowedPartnerUrl("http://bec.example/cases"), false);
    assert.equal(isAllowedPartnerUrl("not a url"), false);
  });

  it("rejects an oversized streamed body", async () => {
    const request = new Request(URL, {
      method: "POST",
      body: "x".repeat(33),
    });
    assert.equal(await readRequestBodyLimited(request, 32), null);
  });

  it("stops buffering an oversized partner response", async () => {
    const response = new Response("x".repeat(33));
    assert.equal(await readResponseBodyLimited(response, 32), null);
  });
});
