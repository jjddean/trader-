/** Max goods items per declaration submit (CDS practical limit guard). */
export const MAX_SUBMIT_GOODS_ITEMS = 99;

/**
 * Validate goods items before submit. SequenceNumeric in XML is always 1..n in
 * array order (see wco-mapper) — stored sequenceNumber is not used for CDS.
 */
export function validateGoodsItemSequences(
  items: Array<{ sequenceNumber?: number | string; sequence?: number | string; [key: string]: unknown }>,
): string[] {
  const errors: string[] = [];
  if (items.length === 0) {
    errors.push("No goods items");
    return errors;
  }
  if (items.length > MAX_SUBMIT_GOODS_ITEMS) {
    errors.push(`Too many goods items (max ${MAX_SUBMIT_GOODS_ITEMS})`);
  }
  return errors;
}
