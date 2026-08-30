/**
 * DE 6/11 Shipping marks.
 *
 * Use supplied marks, or the HMRC-prescribed packaging values from Group 6.
 * `N/A` is not a listed value. Omission is allowed only on GB supplementary
 * declarations (DE 1/2 Y or Z — reading note [12w]).
 */

export const HMRC_MARKS_UNPACKAGED = "Unpackaged";
export const HMRC_MARKS_LOOSE_BULK = "Loose Bulk";
export const HMRC_MARKS_BREAK_BULK = "Break Bulk";

const UNPACKAGED_PACKAGE_TYPES = new Set(["NE", "NF", "NG"]);
const PRESCRIBED_MARKS = new Set([
  HMRC_MARKS_UNPACKAGED.toLowerCase(),
  HMRC_MARKS_LOOSE_BULK.toLowerCase(),
  HMRC_MARKS_BREAK_BULK.toLowerCase(),
]);

export function isGbSupplementaryDeclaration(declaration: {
  additionalDeclarationType?: unknown;
}): boolean {
  const type = String(declaration.additionalDeclarationType ?? "").trim().toUpperCase();
  return type === "Y" || type === "Z";
}

export function normalizeH1ShippingMarks(value: unknown): string {
  const marks = String(value ?? "").trim();
  if (!marks || /^n\/a$/i.test(marks)) return "";
  return marks;
}

function prescribedMarks(value: string): string | undefined {
  const match = [...PRESCRIBED_MARKS].find((entry) => entry === value.toLowerCase());
  if (match === HMRC_MARKS_UNPACKAGED.toLowerCase()) return HMRC_MARKS_UNPACKAGED;
  if (match === HMRC_MARKS_LOOSE_BULK.toLowerCase()) return HMRC_MARKS_LOOSE_BULK;
  if (match === HMRC_MARKS_BREAK_BULK.toLowerCase()) return HMRC_MARKS_BREAK_BULK;
  return undefined;
}

export function resolveH1ShippingMarks(
  item: { shippingMarks?: unknown; packageType?: unknown },
  declaration: { additionalDeclarationType?: unknown } = {},
): string | undefined {
  const supplied = normalizeH1ShippingMarks(item.shippingMarks);
  if (supplied) {
    return prescribedMarks(supplied) ?? supplied;
  }
  const packageType = String(item.packageType ?? "").trim().toUpperCase();
  if (UNPACKAGED_PACKAGE_TYPES.has(packageType)) return HMRC_MARKS_UNPACKAGED;
  if (isGbSupplementaryDeclaration(declaration)) return undefined;
  return undefined;
}

export function validateH1ShippingMarks(
  declaration: { additionalDeclarationType?: unknown },
  items: Array<{ shippingMarks?: unknown; packageType?: unknown }>,
): string[] {
  if (isGbSupplementaryDeclaration(declaration)) return [];
  const errors: string[] = [];
  items.forEach((item, i) => {
    if (!resolveH1ShippingMarks(item, declaration)) {
      errors.push(`Item ${i}: missing shipping marks (DE 6/11)`);
    }
  });
  return errors;
}
