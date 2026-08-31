// H1 DE 4/16 product policy: FreightCode files Method 1 only.
//
// One resolved value is used by the rule engine, H1 mapper, XML, and
// Method-1 document checks. Do not default "1" in those layers separately.
//
// Methods 2–6 are not implemented. A later item-level DE 4/16 field would
// be read here — not invented in the mapper or renderer.
//
// Sources:
//   Appendix 21A H1 — DE 4/16 A (mandatory) at item level
//   Group 4 completion guide — codes 1–6; Method 1 = transaction value;
//     N935; £20,000 assumption; self-representation evidence exception;
//     E01 / E02 / 1SV use Method 4
//   wco-dec valuation-method-types.json (seeded as valuation_methods)

export const H1_SUPPORTED_VALUATION_METHOD = "1" as const;

export const H1_METHOD1_ASSUMPTION_THRESHOLD_GBP = 20_000;

/** Additional procedures that require Method 4 (SPV / SIV). Group 4 DE 4/16. */
export const H1_METHOD4_ADDITIONAL_PROCEDURE_CODES = ["E01", "E02", "1SV"] as const;

export const H1_VALUATION_UNSUPPORTED_MESSAGE =
  "This declaration cannot currently be filed using FreightCode's supported Method 1 valuation path.";

export const H1_METHOD1_CONFIRMATION_MESSAGE =
  "Confirm that Method 1 (transaction value) conditions were checked. Required when consignment value exceeds £20,000 and the declaration is not self-represented.";

export interface H1ValuationDeclaration {
  declarationCategory?: unknown;
  representationType?: unknown;
  invoiceTotal?: unknown;
  invoiceCurrency?: unknown;
  h1Method1ConfirmedAt?: unknown;
}

export interface H1ValuationItem {
  additionalProcedureCode?: unknown;
  valueAmount?: unknown;
  valueCurrency?: unknown;
}

export type H1ValuationResolution =
  | {
      isH1: false;
      supported: true;
      methodCode: null;
      confirmationRequired: false;
      confirmationPresent: false;
    }
  | {
      isH1: true;
      supported: false;
      methodCode: null;
      unsupportedCodes: string[];
      confirmationRequired: false;
      confirmationPresent: boolean;
      reason: string;
    }
  | {
      isH1: true;
      supported: true;
      methodCode: typeof H1_SUPPORTED_VALUATION_METHOD;
      confirmationRequired: boolean;
      confirmationPresent: boolean;
      consignmentValue: number;
      valueCurrency: string;
      isSelfRepresentation: boolean;
      reason?: string;
    };

/** Same category rule as src/lib/submit-category.ts — absent/unknown is H1. */
export function isH1DeclarationCategory(declaration: H1ValuationDeclaration): boolean {
  const value = String(declaration.declarationCategory ?? "").trim().toUpperCase();
  return value !== "B1" && value !== "C1" && value !== "I1";
}

export function normalizeH1AdditionalProcedureCode(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

export function isH1Method4AdditionalProcedure(code: unknown): boolean {
  const apc = normalizeH1AdditionalProcedureCode(code);
  return (H1_METHOD4_ADDITIONAL_PROCEDURE_CODES as readonly string[]).includes(apc);
}

export function findH1UnsupportedValuationProcedures(items: H1ValuationItem[]): string[] {
  const found = new Set<string>();
  for (const item of items) {
    if (isH1Method4AdditionalProcedure(item.additionalProcedureCode)) {
      found.add(normalizeH1AdditionalProcedureCode(item.additionalProcedureCode));
    }
  }
  return [...found];
}

export function isH1SelfRepresentation(declaration: H1ValuationDeclaration): boolean {
  const type = String(declaration.representationType ?? "self").trim().toLowerCase();
  return type === "self" || type === "";
}

function parseAmount(value: unknown): number {
  const n = parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function hasH1Method1Confirmation(declaration: H1ValuationDeclaration): boolean {
  const at = declaration.h1Method1ConfirmedAt;
  return typeof at === "number" && Number.isFinite(at) && at > 0;
}

/**
 * Same consignment value the H1 mapper uses for DE 4/11:
 * declaration.invoiceTotal when numeric, otherwise the sum of item valueAmount.
 */
export function resolveH1ConsignmentValue(
  declaration: H1ValuationDeclaration,
  items: H1ValuationItem[],
): { amount: number; currency: string } {
  const itemSum = items.reduce((acc, item) => acc + parseAmount(item.valueAmount), 0);
  const invoice = parseFloat(String(declaration.invoiceTotal ?? ""));
  const amount = Number.isFinite(invoice) ? invoice : itemSum;
  const invoiceCurrency = String(declaration.invoiceCurrency ?? "").trim().toUpperCase();
  const itemCurrency = String(items[0]?.valueCurrency ?? "").trim().toUpperCase();
  const currency = invoiceCurrency || itemCurrency || "GBP";
  return { amount, currency };
}

export function resolveH1Valuation(
  declaration: H1ValuationDeclaration,
  items: H1ValuationItem[],
): H1ValuationResolution {
  if (!isH1DeclarationCategory(declaration)) {
    return {
      isH1: false,
      supported: true,
      methodCode: null,
      confirmationRequired: false,
      confirmationPresent: false,
    };
  }

  const unsupportedCodes = findH1UnsupportedValuationProcedures(items);
  if (unsupportedCodes.length > 0) {
    return {
      isH1: true,
      supported: false,
      methodCode: null,
      unsupportedCodes,
      confirmationRequired: false,
      confirmationPresent: hasH1Method1Confirmation(declaration),
      reason: `${H1_VALUATION_UNSUPPORTED_MESSAGE} Additional procedure ${unsupportedCodes.join(", ")} requires valuation Method 4.`,
    };
  }

  const { amount, currency } = resolveH1ConsignmentValue(declaration, items);
  const isSelf = isH1SelfRepresentation(declaration);
  const confirmationPresent = hasH1Method1Confirmation(declaration);
  const gbpComparable = currency === "GBP";
  const withinAssumption = gbpComparable && amount <= H1_METHOD1_ASSUMPTION_THRESHOLD_GBP;
  const confirmationRequired = !isSelf && !withinAssumption;

  return {
    isH1: true,
    supported: true,
    methodCode: H1_SUPPORTED_VALUATION_METHOD,
    confirmationRequired,
    confirmationPresent,
    consignmentValue: amount,
    valueCurrency: currency,
    isSelfRepresentation: isSelf,
    reason:
      confirmationRequired && !confirmationPresent
        ? H1_METHOD1_CONFIRMATION_MESSAGE
        : undefined,
  };
}

/** MethodCode the H1 mapper may emit. Throws instead of inventing Method 1 for an unfileable H1. */
export function resolveH1ValuationMethodCode(
  declaration: H1ValuationDeclaration,
  items: H1ValuationItem[],
): typeof H1_SUPPORTED_VALUATION_METHOD {
  const resolved = resolveH1Valuation(declaration, items);
  if (!resolved.isH1) {
    throw new Error("H1 valuation helper called for a non-H1 declaration.");
  }
  if (!resolved.supported || !resolved.methodCode) {
    throw new Error(resolved.reason || H1_VALUATION_UNSUPPORTED_MESSAGE);
  }
  if (resolved.confirmationRequired && !resolved.confirmationPresent) {
    throw new Error(resolved.reason || H1_METHOD1_CONFIRMATION_MESSAGE);
  }
  return resolved.methodCode;
}

export function assertH1ValuationMappable(
  declaration: H1ValuationDeclaration,
  items: H1ValuationItem[],
): void {
  resolveH1ValuationMethodCode(declaration, items);
}
