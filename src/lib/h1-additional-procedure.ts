/**
 * DE 1/11 Additional Procedure Code.
 *
 * `000` means no other APC applies. It is valid when explicitly declared
 * (including with DE 1/10 `4000`). It is not invented for a blank field.
 * Appendix 2B forbids `000` with a 53-series requested procedure.
 * No CPC↔APC matrix is stored in this repo; other combinations are not guessed.
 */

export function normalizeH1AdditionalProcedureCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeH1ProcedureCode(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "");
}

export function isValidH1AdditionalProcedureCode(value: unknown): boolean {
  return /^[A-Z0-9]{3}$/.test(normalizeH1AdditionalProcedureCode(value));
}

export function validateH1AdditionalProcedureCodes(
  items: Array<{ procedureCode?: unknown; additionalProcedureCode?: unknown }>,
): string[] {
  const errors: string[] = [];
  items.forEach((item, i) => {
    const apc = normalizeH1AdditionalProcedureCode(item?.additionalProcedureCode);
    const cpc = normalizeH1ProcedureCode(item?.procedureCode);
    if (!apc) {
      errors.push(`Item ${i}: missing additional procedure (DE 1/11)`);
      return;
    }
    if (!isValidH1AdditionalProcedureCode(apc)) {
      errors.push(`Item ${i}: invalid additional procedure '${apc}' (DE 1/11)`);
      return;
    }
    if (apc === "000" && /^53\d{2}$/.test(cpc)) {
      errors.push(`Item ${i}: APC 000 is not permitted with 53-series procedure (DE 1/10 / DE 1/11)`);
    }
  });
  return errors;
}

export function resolveH1AdditionalProcedureCode(
  item: { procedureCode?: unknown; additionalProcedureCode?: unknown },
  index = 0,
): string {
  const errors = validateH1AdditionalProcedureCodes([item]);
  if (errors.length) {
    throw new Error(errors[0]?.replace("Item 0:", `Item ${index}:`) ?? `Item ${index}: missing additional procedure (DE 1/11)`);
  }
  return normalizeH1AdditionalProcedureCode(item.additionalProcedureCode);
}
