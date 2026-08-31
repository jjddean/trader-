/**
 * DE 6/2 supplementary-unit requirement.
 *
 * HMRC requires TariffQuantity only when the commodity's UK IOT / NI tariff
 * measure instructs a supplementary unit. The Trade Tariff parser in this repo
 * does not currently expose that flag, so this module never infers the
 * requirement from a hard-coded HS list.
 */

export type SupplementaryUnitRequirement = "required" | "not_required" | "unknown";

export const SUPPLEMENTARY_UNIT_CODE_PST = "NAR";

export function resolveSupplementaryUnitRequirement(input?: {
  requiresSupplementaryUnit?: boolean | null;
}): SupplementaryUnitRequirement {
  if (input?.requiresSupplementaryUnit === true) return "required";
  if (input?.requiresSupplementaryUnit === false) return "not_required";
  return "unknown";
}

/** True only when tariff/item data has already resolved DE 6/2 as required. */
export function commodityRequiresSupplementaryUnit(
  _commodityCode?: unknown,
  item?: { requiresSupplementaryUnit?: boolean | null },
): boolean {
  return resolveSupplementaryUnitRequirement(item) === "required";
}

export function validateSupplementaryUnitRequirement(
  items: Array<{
    commodityCode?: unknown;
    supplementaryUnitQty?: unknown;
    requiresSupplementaryUnit?: boolean | null;
  }>,
): string[] {
  const errors: string[] = [];
  items.forEach((item, i) => {
    const requirement = resolveSupplementaryUnitRequirement(item);
    const code = String(item?.commodityCode ?? "").trim() || "unknown";
    if (requirement === "unknown") {
      errors.push(
        `Item ${i}: supplementary units (DE 6/2) requirement cannot be determined for commodity ${code}`,
      );
      return;
    }
    if (requirement !== "required") return;
    const su = parseFloat(String(item?.supplementaryUnitQty ?? ""));
    if (!Number.isFinite(su) || su <= 0) {
      errors.push(`Item ${i}: supplementary units (DE 6/2) required for commodity ${code}`);
    }
  });
  return errors;
}
