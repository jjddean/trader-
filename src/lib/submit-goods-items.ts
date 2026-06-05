/** Max goods items per declaration submit (CDS practical limit guard). */
export const MAX_SUBMIT_GOODS_ITEMS = 99;

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
    return errors;
  }

  const sequences = items.map((item, index) => {
    const raw = item.sequenceNumber ?? item.sequence ?? index + 1;
    const parsed = parseInt(String(raw), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
  });

  const unique = new Set(sequences);
  if (unique.size !== sequences.length) {
    errors.push("Goods item sequence numbers must be unique");
  }

  const sorted = [...sequences].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      errors.push("Goods item sequence numbers must be contiguous starting at 1");
      break;
    }
  }

  return errors;
}
