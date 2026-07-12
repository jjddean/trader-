import type { PredicateEvaluator } from "./types";

/** 5A002 — symmetric key length > 56 bits (simplified deterministic check). */
export const evaluate5A002: PredicateEvaluator = ({ product }) => {
  const evidence: string[] = [];
  const text = [
    product.productName,
    product.technicalDescription,
    ...product.specs.map((s) => `${s.key} ${s.valueRaw}`),
  ].join(" ").toLowerCase();

  const cryptoKeywords = ["encrypt", "cryptograph", "cipher", "aes", "rsa", "ssl", "tls", "vpn", "security module"];
  const hasCryptoSignal = cryptoKeywords.some((k) => text.includes(k));
  if (!hasCryptoSignal) {
    return [{
      entryCode: "5A002",
      predicateId: "5A002_crypto_presence",
      label: "Cryptography functionality signal",
      outcome: "insufficient_data",
      detail: "No encryption/cryptography keywords detected in product facts.",
      evidence: [],
    }];
  }
  evidence.push("Cryptography-related terms present in product description or specs.");

  const bitPatterns = [
    /\b(\d{2,4})\s*-?\s*bit\b/i,
    /\bkey\s*length[:\s]+(\d{2,4})\b/i,
    /\baes\s*-?\s*(\d{3})\b/i,
  ];

  let keyBits: number | null = null;
  for (const spec of product.specs) {
    for (const re of bitPatterns) {
      const m = spec.valueRaw.match(re);
      if (m) {
        keyBits = Number(m[1]);
        evidence.push(`Spec "${spec.key}": ${spec.valueRaw}`);
        break;
      }
    }
    if (keyBits != null) break;
  }

  if (keyBits == null) {
    for (const re of bitPatterns) {
      const m = text.match(re);
      if (m) {
        keyBits = Number(m[1]);
        evidence.push(`Description match: ${m[0]}`);
        break;
      }
    }
  }

  if (keyBits == null) {
    return [{
      entryCode: "5A002",
      predicateId: "5A002_key_length",
      label: "Symmetric key length > 56 bits",
      outcome: "insufficient_data",
      detail: "Cryptography indicated but key length not found — human must confirm algorithm and key size.",
      evidence,
    }];
  }

  if (keyBits > 56) {
    return [{
      entryCode: "5A002",
      predicateId: "5A002_key_length",
      label: "Symmetric key length > 56 bits",
      outcome: "threshold_met",
      detail: `Detected key length ${keyBits} bits exceeds 56-bit symmetric threshold (simplified 5A002 check).`,
      evidence,
    }];
  }

  return [{
    entryCode: "5A002",
    predicateId: "5A002_key_length",
    label: "Symmetric key length > 56 bits",
    outcome: "threshold_not_met",
    detail: `Detected key length ${keyBits} bits is at or below 56-bit threshold (simplified check; verify algorithm type).`,
    evidence,
  }];
};
