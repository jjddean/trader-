/** Normalise user/OCR input to a 10-digit UK commodity code, or null. */
export function normalizeHsCode(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** Pull the first plausible 10-digit HS code from invoice OCR text. */
export function extractHsCodeFromOcr(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const labeled = [
    /\b(?:HS|H\.S\.|commodity|tariff|CN|customs)\s*(?:code|no\.?|number|#)?\s*[:#]?\s*(\d[\d\s.\-/]{8,14}\d)/gi,
    /\b(?:DE\s*6\s*\/\s*14)\s*[:#]?\s*(\d[\d\s.\-/]{8,14}\d)/gi,
  ];

  for (const pattern of labeled) {
    for (const match of trimmed.matchAll(pattern)) {
      const normalized = normalizeHsCode(match[1]);
      if (normalized) return normalized;
    }
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const formatted = line.match(/\b(\d{4}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{2})\b/);
    if (formatted) {
      const normalized = normalizeHsCode(formatted[1]);
      if (normalized) return normalized;
    }
    const plain = line.match(/\b(\d{10})\b/);
    if (plain) {
      const normalized = normalizeHsCode(plain[1]);
      if (normalized) return normalized;
    }
  }

  return null;
}

export function resolveDeclaredHsCode(options: {
  ocrText?: string;
  declarationItemCodes?: string[];
  manualOverride?: string;
}): string | null {
  const manual = normalizeHsCode(options.manualOverride);
  if (manual) return manual;

  const fromOcr = options.ocrText ? extractHsCodeFromOcr(options.ocrText) : null;
  if (fromOcr) return fromOcr;

  for (const code of options.declarationItemCodes ?? []) {
    const normalized = normalizeHsCode(code);
    if (normalized) return normalized;
  }

  return null;
}
