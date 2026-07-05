const CORP_SUFFIX_RE =
  /\b(LTD|LIMITED|LLC|INC|CORP|CORPORATION|PLC|GMBH|SA|BV|AG|CO|COMPANY|GROUP|HOLDINGS)\b/gi;

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Uppercase, transliteration, punctuation strip, corporate-suffix removal, token sort. */
export function canonicaliseName(name: string): string {
  return stripDiacritics(name)
    .toUpperCase()
    .replace(/[^\w\s]/g, " ")
    .replace(CORP_SUFFIX_RE, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .sort()
    .join(" ")
    .trim();
}

export function canonicaliseIdentifier(value: string): string {
  return stripDiacritics(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function canonicaliseCountry(value: string | undefined): string | null {
  if (!value) return null;
  const t = value.trim().toUpperCase();
  return t.length >= 2 ? t.slice(0, 2) : null;
}

export function canonicaliseDob(value: string | undefined): string | null {
  if (!value) return null;
  const uk = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  return null;
}

export function trigrams(value: string): Set<string> {
  const padded = `  ${value}  `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}

export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter++;
  }
  return (2 * inter) / (ta.size + tb.size);
}

export function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter++;
  }
  return inter / Math.max(ta.size, tb.size);
}

export function bestNameSimilarity(queryName: string, candidateNames: string[]): number {
  const query = canonicaliseName(queryName);
  if (!query) return 0;
  let best = 0;
  for (const raw of candidateNames) {
    const candidate = canonicaliseName(raw);
    if (!candidate) continue;
    const score = Math.max(trigramSimilarity(query, candidate), tokenOverlapScore(query, candidate));
    if (score > best) best = score;
  }
  return best;
}
