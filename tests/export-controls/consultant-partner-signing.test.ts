import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { signPartnerRequest } from "../../convex/lib/consultant_partner_signing";

describe("Convex consultant partner request signing", () => {
  it("signs the exact path, digest and JSON bytes", async () => {
    const body = JSON.stringify({ source: "freightcode", externalCaseId: "case-1", status: "completed" });
    const timestamp = 1_787_310_000_123;
    const requestId = "req-123";
    const signingKey = "partner-signing-key-0123456789ab";
    const contentDigest = `sha-256=:${createHash("sha256").update(body).digest("base64")}:`;
    const canonical = [
      "POST",
      "/api/cases/status?tenant=uk",
      String(timestamp),
      requestId,
      contentDigest,
      body,
    ].join("\n");

    const signed = await signPartnerRequest({
      method: "POST",
      url: "https://partner.example/api/cases/status?tenant=uk",
      timestamp,
      requestId,
      body,
      keyId: "fc-key-1",
      signingKey,
    });

    assert.equal(signed.canonical, canonical);
    assert.equal(signed.headers["content-digest"], contentDigest);
    assert.equal(
      signed.headers["x-fc-signature"],
      `sha256=${createHmac("sha256", signingKey).update(canonical).digest("base64")}`,
    );
    assert.equal(signed.headers["x-fc-signature-version"], "v1");
    assert.equal(signed.headers["x-fc-key-id"], "fc-key-1");
    assert.equal(signed.headers["x-fc-request-id"], requestId);
    assert.equal(signed.headers["x-fc-timestamp"], String(timestamp));
  });

  it("rejects non-HTTPS and fragment-bearing targets", async () => {
    const base = {
      method: "POST",
      timestamp: Date.now(),
      requestId: "req-1",
      body: "{}",
      keyId: "key-1",
      signingKey: "s".repeat(32),
    };
    await assert.rejects(signPartnerRequest({ ...base, url: "http://partner.example/status" }));
    await assert.rejects(
      signPartnerRequest({ ...base, url: "https://partner.example/status#fragment" }),
    );
  });
});
