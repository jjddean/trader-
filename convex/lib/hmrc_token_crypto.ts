/**
 * AES-256-GCM encryption for HMRC OAuth tokens at rest in Convex.
 * Set HMRC_TOKEN_ENCRYPTION_KEY in Convex env (openssl rand -base64 32).
 */

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importEncryptionKey(): Promise<CryptoKey> {
  const raw = process.env.HMRC_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("HMRC_TOKEN_ENCRYPTION_KEY is not configured in Convex environment");
  }
  const keyBytes = base64ToBytes(raw);
  if (keyBytes.length !== 32) {
    throw new Error("HMRC_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (use: openssl rand -base64 32)");
  }
  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: ALGORITHM, length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Ciphertext format: base64(iv).base64(ciphertext+tag) */
export async function encryptHmrcSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importEncryptionKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptHmrcSecret(payload: string): Promise<string> {
  const [ivPart, cipherPart] = payload.split(".");
  if (!ivPart || !cipherPart) {
    throw new Error("Invalid encrypted HMRC token payload");
  }
  const iv = base64ToBytes(ivPart);
  const ciphertext = base64ToBytes(cipherPart);
  const key = await importEncryptionKey();
  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  return new TextDecoder().decode(plainBuffer);
}

export function isHmrcTokenEncryptionConfigured(): boolean {
  return Boolean(process.env.HMRC_TOKEN_ENCRYPTION_KEY?.trim());
}
