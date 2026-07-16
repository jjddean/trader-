/** Deterministic FX conversion for pre-clearance estimates (Open Exchange Rates USD base). */

export interface FxRatesSnapshot {
  base: string;
  rates: Record<string, number>;
}

export function normalizeCurrencyCode(code: string | undefined | null): string {
  return String(code ?? "GBP")
    .trim()
    .toUpperCase();
}

/**
 * Convert an amount in `currency` to GBP using Open Exchange Rates-style data.
 * Returns null when the currency pair cannot be resolved.
 */
export function convertToGbp(
  amount: number,
  currency: string,
  fx: FxRatesSnapshot,
): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;

  const code = normalizeCurrencyCode(currency);
  if (code === "GBP") return round2(amount);

  const base = normalizeCurrencyCode(fx.base);
  const rates = fx.rates;
  if (!rates || typeof rates !== "object") return null;

  const gbpPerBase = rates.GBP;
  if (!Number.isFinite(gbpPerBase) || gbpPerBase <= 0) return null;

  if (base === "USD") {
    const foreignPerUsd = rates[code];
    if (!Number.isFinite(foreignPerUsd) || foreignPerUsd <= 0) return null;
    const usd = amount / foreignPerUsd;
    return round2(usd * gbpPerBase);
  }

  if (base === "GBP") {
    const gbpPerForeign = rates[code];
    if (!Number.isFinite(gbpPerForeign) || gbpPerForeign <= 0) return null;
    return round2(amount / gbpPerForeign);
  }

  const amountInBase = rates[code];
  if (!Number.isFinite(amountInBase) || amountInBase <= 0) return null;
  const inBase = amount / amountInBase;
  return round2(inBase * gbpPerBase);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function itemValueCurrency(
  item: { valueCurrency?: unknown },
  declarationCurrency?: string | null,
): string {
  const itemCurrency = normalizeCurrencyCode(
    item.valueCurrency != null ? String(item.valueCurrency) : "",
  );
  if (itemCurrency && itemCurrency !== "") return itemCurrency;
  const declCurrency = normalizeCurrencyCode(declarationCurrency);
  return declCurrency || "GBP";
}

export function resolveCustomsValueGbp(
  rawAmount: number,
  currency: string,
  fx: FxRatesSnapshot | null | undefined,
): { customsValueGbp: number; fxApplied: boolean; fxUnavailable: boolean } {
  const code = normalizeCurrencyCode(currency);
  if (code === "GBP") {
    return { customsValueGbp: round2(rawAmount), fxApplied: false, fxUnavailable: false };
  }
  if (!fx) {
    return { customsValueGbp: rawAmount, fxApplied: false, fxUnavailable: true };
  }
  const converted = convertToGbp(rawAmount, code, fx);
  if (converted == null) {
    return { customsValueGbp: rawAmount, fxApplied: false, fxUnavailable: true };
  }
  return { customsValueGbp: converted, fxApplied: true, fxUnavailable: false };
}
