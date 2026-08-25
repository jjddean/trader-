import {
  createHash,
  createHmac,
  randomUUID,
} from "node:crypto";
import { secretsEqual } from "@/lib/secrets-equal";

export const PARTNER_SIGNATURE_VERSION = "v1";
export const PARTNER_REQUEST_MAX_BYTES = 16 * 1024;
export const PARTNER_RESPONSE_MAX_BYTES = 32 * 1024;

const DEFAULT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_FUTURE_SKEW_MS = 60 * 1000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

export interface PartnerSignatureHeaders {
  "content-digest": string;
  "x-fc-key-id": string;
  "x-fc-request-id": string;
  "x-fc-signature": string;
  "x-fc-signature-version": typeof PARTNER_SIGNATURE_VERSION;
  "x-fc-timestamp": string;
}

export type PartnerSignatureVerification =
  | {
      ok: true;
      bodyDigest: string;
      requestId: string;
      timestamp: number;
    }
  | {
      ok: false;
      reason:
        | "missing"
        | "version"
        | "key"
        | "request_id"
        | "timestamp"
        | "digest"
        | "signature";
    };

function digestHeader(rawBody: string): string {
  const digest = createHash("sha256").update(rawBody, "utf8").digest("base64");
  return `sha-256=:${digest}:`;
}

export function partnerBodyDigest(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

function requestTarget(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return `${parsed.pathname}${parsed.search}`;
}

function canonicalRequest(input: {
  method: string;
  url: string | URL;
  timestamp: string;
  requestId: string;
  contentDigest: string;
  rawBody: string;
}): string {
  return [
    input.method.toUpperCase(),
    requestTarget(input.url),
    input.timestamp,
    input.requestId,
    input.contentDigest,
    input.rawBody,
  ].join("\n");
}

function signatureFor(
  signingKey: string,
  input: Parameters<typeof canonicalRequest>[0],
): string {
  return createHmac("sha256", signingKey)
    .update(canonicalRequest(input), "utf8")
    .digest("base64");
}

export function createPartnerSignatureHeaders(input: {
  method: string;
  url: string | URL;
  rawBody: string;
  signingKey: string;
  keyId: string;
  requestId?: string;
  timestamp?: number;
}): PartnerSignatureHeaders {
  if (Buffer.byteLength(input.signingKey, "utf8") < 32) {
    throw new Error("Partner signing key must be at least 32 bytes");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(input.keyId)) {
    throw new Error("Partner signing key id is invalid");
  }
  const timestamp = String(input.timestamp ?? Date.now());
  const requestId = input.requestId ?? randomUUID();
  const contentDigest = digestHeader(input.rawBody);
  const signature = signatureFor(input.signingKey, {
    method: input.method,
    url: input.url,
    timestamp,
    requestId,
    contentDigest,
    rawBody: input.rawBody,
  });

  return {
    "content-digest": contentDigest,
    "x-fc-key-id": input.keyId,
    "x-fc-request-id": requestId,
    "x-fc-signature": `sha256=${signature}`,
    "x-fc-signature-version": PARTNER_SIGNATURE_VERSION,
    "x-fc-timestamp": timestamp,
  };
}

export function verifyPartnerSignature(input: {
  request: Request;
  rawBody: string;
  signingKey: string;
  keyId: string;
  now?: number;
  maxClockSkewMs?: number;
  maxFutureSkewMs?: number;
}): PartnerSignatureVerification {
  if (
    Buffer.byteLength(input.signingKey, "utf8") < 32 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(input.keyId)
  ) {
    return { ok: false, reason: "key" };
  }
  const version = input.request.headers.get("x-fc-signature-version")?.trim();
  const keyId = input.request.headers.get("x-fc-key-id")?.trim();
  const requestId = input.request.headers.get("x-fc-request-id")?.trim();
  const timestampText = input.request.headers.get("x-fc-timestamp")?.trim();
  const presentedDigest = input.request.headers.get("content-digest")?.trim();
  const presentedSignature = input.request.headers.get("x-fc-signature")?.trim();

  if (!version || !keyId || !requestId || !timestampText || !presentedDigest || !presentedSignature) {
    return { ok: false, reason: "missing" };
  }
  if (version !== PARTNER_SIGNATURE_VERSION) return { ok: false, reason: "version" };
  if (!secretsEqual(input.keyId, keyId)) return { ok: false, reason: "key" };
  if (!REQUEST_ID_PATTERN.test(requestId)) return { ok: false, reason: "request_id" };
  if (!/^\d{13}$/.test(timestampText)) return { ok: false, reason: "timestamp" };

  const timestamp = Number(timestampText);
  const now = input.now ?? Date.now();
  const maxClockSkewMs = input.maxClockSkewMs ?? DEFAULT_MAX_CLOCK_SKEW_MS;
  const maxFutureSkewMs = input.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < now - maxClockSkewMs ||
    timestamp > now + maxFutureSkewMs
  ) {
    return { ok: false, reason: "timestamp" };
  }

  const expectedDigest = digestHeader(input.rawBody);
  if (!secretsEqual(expectedDigest, presentedDigest)) {
    return { ok: false, reason: "digest" };
  }

  const expectedSignature = `sha256=${signatureFor(input.signingKey, {
    method: input.request.method,
    url: input.request.url,
    timestamp: timestampText,
    requestId,
    contentDigest: presentedDigest,
    rawBody: input.rawBody,
  })}`;
  if (!secretsEqual(expectedSignature, presentedSignature)) {
    return { ok: false, reason: "signature" };
  }

  return {
    ok: true,
    bodyDigest: partnerBodyDigest(input.rawBody),
    requestId,
    timestamp,
  };
}

export function isAllowedPartnerUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:") return true;
    return (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1")
    );
  } catch {
    return false;
  }
}

export async function readRequestBodyLimited(
  request: Request,
  maxBytes = PARTNER_REQUEST_MAX_BYTES,
): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(merged);
}

/** Read a partner response without ever buffering more than the protocol cap. */
export async function readResponseBodyLimited(
  response: Response,
  maxBytes = PARTNER_RESPONSE_MAX_BYTES,
): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(merged);
}
