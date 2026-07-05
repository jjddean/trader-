import type { ControlListEntry, ControlListSnapshot } from "./control-list";
import type { ExportProduct, ExportProductSpec } from "./extraction";

export interface RetrievalHit {
  entryCode: string;
  entryType: ControlListEntry["entryType"];
  category: string;
  title: string;
  clausePath: string;
  chunkText: string;
  pageStart: number;
  score: number;
  matchedTerms: string[];
  matchKind: "entry_code" | "lexical" | "keyword_boost";
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with", "by", "is", "are",
  "be", "as", "at", "from", "that", "this", "not", "has", "have", "was", "were", "it", "its",
]);

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  crypto: ["encryption", "cryptographic", "cipher", "aes", "rsa", "ssl", "tls", "vpn", "cryptography"],
  electronics: ["semiconductor", "fpga", "asic", "microprocessor", "transistor", "microwave", "radar"],
  military: ["weapon", "armament", "munition", "rifle", "missile", "military"],
};

const ENTRY_CODE_RE = /\b(?:[0-9][A-Z]\d{3}[a-z]?(?:\.\d+)?|[A-Z]{2}\d{1,4}[a-z]?)\b/gi;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s/.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function buildSearchCorpus(product: ExportProduct): { tokens: string[]; raw: string } {
  const parts = [
    product.productName,
    product.technicalDescription,
    product.manufacturer ?? "",
    product.modelNo ?? "",
    product.partNo ?? "",
    ...product.specs.map((s) => `${s.key} ${s.valueRaw} ${s.unit ?? ""}`),
  ];
  const raw = parts.join(" ");
  return { tokens: unique(tokenize(raw)), raw };
}

function scoreChunk(tokens: string[], chunkText: string): { score: number; matchedTerms: string[] } {
  const chunkTokens = new Set(tokenize(chunkText));
  const matchedTerms = tokens.filter((t) => chunkTokens.has(t));
  if (matchedTerms.length === 0) return { score: 0, matchedTerms: [] };

  const overlap = matchedTerms.length / Math.sqrt(tokens.length * chunkTokens.size);
  return { score: overlap, matchedTerms };
}

function detectDomainBoosts(raw: string): string[] {
  const lower = raw.toLowerCase();
  const boosts: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) boosts.push(domain);
  }
  return boosts;
}

function categoryForDomain(domain: string): string[] {
  if (domain === "crypto") return ["5"];
  if (domain === "electronics") return ["3", "4"];
  if (domain === "military") return ["ML"];
  return [];
}

export function retrieveControlListCandidates(
  snapshot: ControlListSnapshot,
  product: ExportProduct,
  options?: { limit?: number },
): RetrievalHit[] {
  const limit = options?.limit ?? 12;
  const { tokens, raw } = buildSearchCorpus(product);
  const domainBoosts = detectDomainBoosts(raw);
  const boostedCategories = unique(domainBoosts.flatMap(categoryForDomain));

  const explicitCodes = unique(
    (raw.match(ENTRY_CODE_RE) ?? []).map((c) => c.toUpperCase()),
  );

  const hits: RetrievalHit[] = [];

  for (const entry of snapshot.entries) {
    let entryBoost = 0;
    if (explicitCodes.includes(entry.entryCode.toUpperCase())) entryBoost += 2;
    if (boostedCategories.some((c) => entry.category === c || entry.entryCode.startsWith(c))) {
      entryBoost += 0.35;
    }

    for (let i = 0; i < entry.chunks.length; i++) {
      const chunk = entry.chunks[i];
      const { score, matchedTerms } = scoreChunk(tokens, chunk.text);
      const lexicalScore = score + entryBoost;
      if (lexicalScore <= 0 && entryBoost === 0) continue;

      hits.push({
        entryCode: entry.entryCode,
        entryType: entry.entryType,
        category: entry.category,
        title: entry.title,
        clausePath: chunk.clausePath || "full",
        chunkText: chunk.text.slice(0, 1200),
        pageStart: chunk.pageStart,
        score: explicitCodes.includes(entry.entryCode.toUpperCase())
          ? lexicalScore + 3
          : lexicalScore,
        matchedTerms,
        matchKind: explicitCodes.includes(entry.entryCode.toUpperCase())
          ? "entry_code"
          : entryBoost > 0
            ? "keyword_boost"
            : "lexical",
      });
    }

    if (entry.chunks.length === 0 && entryBoost > 0) {
      const { score, matchedTerms } = scoreChunk(tokens, entry.fullText);
      hits.push({
        entryCode: entry.entryCode,
        entryType: entry.entryType,
        category: entry.category,
        title: entry.title,
        clausePath: "full",
        chunkText: entry.fullText.slice(0, 1200),
        pageStart: entry.pageStart,
        score: score + entryBoost,
        matchedTerms,
        matchKind: "keyword_boost",
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);

  const byEntry = new Map<string, RetrievalHit>();
  for (const hit of hits) {
    const existing = byEntry.get(hit.entryCode);
    if (!existing || hit.score > existing.score) {
      byEntry.set(hit.entryCode, hit);
    }
  }

  return [...byEntry.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function specsToProduct(input: {
  name: string;
  techDescription?: string;
  manufacturer?: string;
  modelNo?: string;
  specs?: Array<Partial<ExportProductSpec>>;
}): ExportProduct {
  return {
    lineItemRef: null,
    productName: input.name,
    manufacturer: input.manufacturer ?? null,
    modelNo: input.modelNo ?? null,
    partNo: null,
    quantity: null,
    unitValueGbp: null,
    technicalDescription: input.techDescription ?? input.name,
    specs: (input.specs ?? []).map((s) => ({
      key: s.key ?? "unknown",
      valueRaw: s.valueRaw ?? "",
      valueNum: s.valueNum ?? null,
      unit: s.unit ?? null,
      sourcePage: s.sourcePage ?? null,
      sourceQuote: s.sourceQuote ?? s.valueRaw ?? "",
      confidence: s.confidence ?? 0.7,
    })),
  };
}
