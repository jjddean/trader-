export interface SignedPartnerRequestInput {
  method: string;
  url: string;
  timestamp: number;
  requestId: string;
  body: string;
  keyId: string;
  signingKey: string;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    result += BASE64[(value >>> 18) & 63];
    result += BASE64[(value >>> 12) & 63];
    result += index + 1 < bytes.length ? BASE64[(value >>> 6) & 63] : "=";
    result += index + 2 < bytes.length ? BASE64[value & 63] : "=";
  }
  return result;
}

/** Build FreightCode's v1 HMAC headers over the exact outbound bytes. */
export async function signPartnerRequest(input: SignedPartnerRequestInput) {
  const target = new URL(input.url);
  if (target.protocol !== "https:" || target.username || target.password || target.hash) {
    throw new Error("Consultant partner status URL must be an exact HTTPS target");
  }
  const keyId = input.keyId.trim();
  const signingKeyBytes = new TextEncoder().encode(input.signingKey);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(keyId) ||
    signingKeyBytes.byteLength < 32
  ) {
    throw new Error("Consultant partner signing credentials are incomplete");
  }

  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(input.body);
  const digestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", bodyBytes));
  const contentDigest = `sha-256=:${base64(digestBytes)}:`;
  const canonical = [
    input.method.toUpperCase(),
    `${target.pathname}${target.search}`,
    String(input.timestamp),
    input.requestId,
    contentDigest,
    input.body,
  ].join("\n");

  const key = await crypto.subtle.importKey(
    "raw",
    signingKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(canonical)),
  );

  return {
    canonical,
    headers: {
      "x-fc-signature-version": "v1",
      "x-fc-key-id": keyId,
      "x-fc-request-id": input.requestId,
      "x-fc-timestamp": String(input.timestamp),
      "content-digest": contentDigest,
      "x-fc-signature": `sha256=${base64(signatureBytes)}`,
    },
  };
}
