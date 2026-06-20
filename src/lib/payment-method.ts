/**
 * CDS DE 4/8 method of payment + DE 2/6 deferment account helpers.
 * Source: Appendix 9 (MOP), Group 2 DE 2/6 (1DAN / 2DAN).
 */

/** MOP codes that require DE 2/6 deferment account number (Appendix 9 / CDS relation rules). */
export const DEFERMENT_MOP_CODES = new Set(["E", "R"]);

export const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Not declared — HMRC default assessment" },
  { value: "E", label: "E — Deferment account (CDS)" },
  { value: "R", label: "R — Deferment (repayment / postponed)" },
  { value: "G", label: "G — Immediate payment (guarantee)" },
  { value: "P", label: "P — Immediate payment (cash)" },
] as const;

export function normalizeDefermentAccountNumber(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 7 ? digits : "";
}

export function normalizePaymentMethodCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function requiresDefermentAccount(mop: string): boolean {
  return DEFERMENT_MOP_CODES.has(normalizePaymentMethodCode(mop));
}

export function validatePaymentFields(
  paymentMethodCode: unknown,
  defermentAccountNumber: unknown,
): string | null {
  const mop = normalizePaymentMethodCode(paymentMethodCode);
  const dan = normalizeDefermentAccountNumber(defermentAccountNumber);

  if (requiresDefermentAccount(mop) && !dan) {
    return "Deferment account number (DE 2/6) is required when method of payment is E or R.";
  }

  if (dan && !requiresDefermentAccount(mop)) {
    return "Method of payment must be E or R when a deferment account number is provided.";
  }

  if (String(defermentAccountNumber ?? "").trim() && !dan) {
    return "Deferment account number must be exactly 7 digits (DE 2/6).";
  }

  return null;
}

/** DE 2/6 — 1DAN header document (all charges to this account). */
export function buildDefermentAdditionalDocument(dan: string) {
  return {
    CategoryCode: "1",
    TypeCode: "DAN",
    ID: dan,
  };
}

export function resolveDeclarationPayment(declaration: {
  defermentAccountNumber?: unknown;
  paymentMethodCode?: unknown;
}) {
  const dan = normalizeDefermentAccountNumber(declaration.defermentAccountNumber);
  const mop = normalizePaymentMethodCode(declaration.paymentMethodCode);
  const effectiveMop = dan && !mop ? "E" : mop;
  return { dan, mop: effectiveMop };
}
