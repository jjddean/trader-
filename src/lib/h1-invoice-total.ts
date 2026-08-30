/**
 * DE 4/11 Total amount invoiced.
 *
 * Optional. When supplied it must equal the sum of DE 4/14 item prices and use
 * the same currency. Numeric `0` is a supplied value, not a missing value.
 */

export type ParsedInvoiceTotal =
  | { kind: "omitted" }
  | { kind: "invalid" }
  | { kind: "present"; amount: number };

export function parseOptionalInvoiceTotal(value: unknown): ParsedInvoiceTotal {
  if (value == null) return { kind: "omitted" };
  if (typeof value === "string" && value.trim() === "") return { kind: "omitted" };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { kind: "present", amount: value } : { kind: "invalid" };
  }
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? { kind: "present", amount: n } : { kind: "invalid" };
}

export function sumItemPrices(items: Array<{ valueAmount?: unknown }>): number {
  return items.reduce((acc, item) => acc + (parseFloat(String(item.valueAmount ?? "")) || 0), 0);
}

export function amountsEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export function validateH1InvoiceTotal(
  declaration: { invoiceTotal?: unknown; invoiceCurrency?: unknown },
  items: Array<{ valueAmount?: unknown; valueCurrency?: unknown }>,
): string[] {
  const parsed = parseOptionalInvoiceTotal(declaration.invoiceTotal);
  if (parsed.kind === "omitted") return [];
  if (parsed.kind === "invalid") return ["Invalid invoice total (DE 4/11)"];

  const errors: string[] = [];
  const currency = String(declaration.invoiceCurrency ?? "").trim();
  if (!currency) {
    errors.push("Missing invoice currency (DE 4/11)");
  }
  const itemSum = sumItemPrices(items);
  if (!amountsEqual(parsed.amount, itemSum)) {
    errors.push("Invoice total (DE 4/11) must equal the sum of item prices (DE 4/14)");
  }
  if (currency) {
    items.forEach((item, i) => {
      const itemCurrency = String(item.valueCurrency ?? "").trim();
      if (itemCurrency && itemCurrency !== currency) {
        errors.push(`Item ${i}: invoice currency (DE 4/11) must match item price currency (DE 4/14)`);
      }
    });
  }
  return errors;
}

export function resolveH1InvoiceAmount(
  declaration: { invoiceTotal?: unknown; invoiceCurrency?: unknown },
  items: Array<{ valueAmount?: unknown; valueCurrency?: unknown }>,
): { currencyID: string; value: number } | undefined {
  const errors = validateH1InvoiceTotal(declaration, items);
  if (errors.length) throw new Error(errors.join("; "));
  const parsed = parseOptionalInvoiceTotal(declaration.invoiceTotal);
  if (parsed.kind !== "present") return undefined;
  return {
    currencyID: String(declaration.invoiceCurrency ?? "").trim(),
    value: parsed.amount,
  };
}
