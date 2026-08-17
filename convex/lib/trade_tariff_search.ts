/**
 * Parsers for the public UK Trade Tariff search API.
 * https://www.trade-tariff.service.gov.uk/api/v2/search
 */
export const TRADE_TARIFF_BASE = "https://www.trade-tariff.service.gov.uk/api/v2";

export interface HsSearchResult {
  code: string;
  description: string;
  matchType: string;
}

export interface ExactEntry {
  endpoint: string;
  id: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

/** `{ endpoint, id }` when the search resolved to a single node, else null. */
export function readExactEntry(payload: unknown): ExactEntry | null {
  const attributes = asRecord(asRecord(asRecord(payload)?.data)?.attributes);
  const entry = asRecord(attributes?.entry);
  if (!entry) return null;
  const endpoint = asString(entry.endpoint);
  const id = asString(entry.id);
  return endpoint && id ? { endpoint, id } : null;
}

/**
 * Fuzzy hits from `goods_nomenclature_match` and `reference_match`, each of which
 * holds `chapters` / `headings` / `commodities` arrays of Elasticsearch hits.
 */
export function readFuzzyResults(payload: unknown, limit = 20): HsSearchResult[] {
  const attributes = asRecord(asRecord(asRecord(payload)?.data)?.attributes);
  if (!attributes) return [];

  const matchType = asString(attributes.type) || "fuzzy_match";
  const out: HsSearchResult[] = [];
  const seen = new Set<string>();

  for (const groupKey of ["goods_nomenclature_match", "reference_match"]) {
    const group = asRecord(attributes[groupKey]);
    if (!group) continue;

    for (const bucketKey of ["commodities", "headings", "chapters"]) {
      const bucket = group[bucketKey];
      if (!Array.isArray(bucket)) continue;

      for (const hit of bucket) {
        const source = asRecord(asRecord(hit)?._source);
        if (!source) continue;
        const reference = asRecord(source.reference) ?? source;

        const code = asString(
          reference.goods_nomenclature_item_id ?? reference.goods_nomenclature_sid ?? reference.id,
        );
        if (!code || seen.has(code)) continue;

        const description =
          asString(reference.formatted_description) ||
          asString(reference.description) ||
          asString(source.title);
        if (!description) continue;

        seen.add(code);
        out.push({ code, description, matchType });
        if (out.length >= limit) return out;
      }
    }
  }

  return out;
}

/** Description for a single chapter/heading/commodity detail payload. */
export function readEntryDescription(payload: unknown): string {
  const attributes = asRecord(asRecord(asRecord(payload)?.data)?.attributes);
  if (!attributes) return "";
  return (
    asString(attributes.formatted_description) ||
    asString(attributes.description) ||
    asString(attributes.description_plain)
  );
}
