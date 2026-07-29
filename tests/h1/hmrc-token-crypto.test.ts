import { describe, it } from "node:test";
import assert from "node:assert/strict";

// 32-byte key for tests only
const TEST_KEY = Buffer.from("01234567890123456789012345678901").toString("base64");

describe("hmrc token crypto", () => {
  it("round-trips encrypt and decrypt", async () => {
    process.env.HMRC_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const { encryptHmrcSecret, decryptHmrcSecret } = await import("../../convex/lib/hmrc_token_crypto");

    const plain = "ya29.test-access-token-value";
    const encrypted = await encryptHmrcSecret(plain);
    assert.notEqual(encrypted, plain);
    assert.match(encrypted, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

    const decrypted = await decryptHmrcSecret(encrypted);
    assert.equal(decrypted, plain);
  });

  it("decryptHmrcTokensFromRow prefers encrypted columns", async () => {
    process.env.HMRC_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const { encryptHmrcTokensForStorage, decryptHmrcTokensFromRow } = await import(
      "../../convex/lib/hmrc_token_row"
    );

    const stored = await encryptHmrcTokensForStorage("access-plain", "refresh-plain");
    const secrets = await decryptHmrcTokensFromRow({
      accessToken: "legacy-should-not-win",
      refreshToken: "legacy-should-not-win",
      accessTokenEncrypted: stored.accessTokenEncrypted,
      refreshTokenEncrypted: stored.refreshTokenEncrypted,
      expiresAt: 123,
    });

    assert.equal(secrets.accessToken, "access-plain");
    assert.equal(secrets.refreshToken, "refresh-plain");
    assert.equal(secrets.expiresAt, 123);
  });
});
