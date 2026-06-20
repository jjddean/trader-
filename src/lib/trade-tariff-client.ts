import type { TariffJsonApi } from "../../convex/lib/tariff_parser";

export const TARIFF_ACCEPT_HEADER = "application/vnd.hmrc.2.0+json";
export const TARIFF_COMMODITY_BASE_URL =
  "https://www.trade-tariff.service.gov.uk/uk/api/commodities";

/** Default cache TTL for tariff commodity snapshots (7 days). */
export const TARIFF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isTariffCacheStale(fetchedAt: number, now = Date.now()): boolean {
  return now - fetchedAt > TARIFF_CACHE_TTL_MS;
}

export async function fetchCommodityTariff(
  commodityCode: string,
  country?: string,
): Promise<TariffJsonApi> {
  const code = commodityCode.replace(/\s+/g, "");
  if (!/^\d{10}$/.test(code)) {
    throw new Error("Commodity code must be a valid 10-digit number.");
  }

  const url = new URL(`${TARIFF_COMMODITY_BASE_URL}/${code}`);
  if (country) url.searchParams.set("country", country.toUpperCase());

  const response = await fetch(url.toString(), {
    headers: { Accept: TARIFF_ACCEPT_HEADER },
  });

  if (!response.ok) {
    throw new Error(
      "Unable to fetch tariff data. Please check that the commodity code is a valid 10-digit number.",
    );
  }

  return (await response.json()) as TariffJsonApi;
}
