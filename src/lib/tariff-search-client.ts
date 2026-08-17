export interface TariffSearchResult {
  code: string;
  description: string;
  matchType?: string;
}

/** Commodity-code lookup through the rate-limited API route. */
export async function searchTariff(query: string): Promise<TariffSearchResult[]> {
  const response = await fetch("/api/tariff/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { results?: TariffSearchResult[] };
  return body.results ?? [];
}
