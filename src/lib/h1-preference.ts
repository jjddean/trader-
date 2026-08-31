/**
 * DE 4/17 Preference (DutyRegimeCode).
 *
 * Appendix 12 codes are 3-digit. `100` is Erga Omnes third-country duty and is
 * valid only when supplied for an MFN item. Missing preference is not defaulted.
 */

export function normalizeH1PreferenceCode(value: unknown): string {
  return String(value ?? "").trim();
}

export function isValidH1PreferenceCode(value: unknown): boolean {
  return /^\d{3}$/.test(normalizeH1PreferenceCode(value));
}

export function validateH1PreferenceCodes(
  items: Array<{ preferenceCode?: unknown }>,
): string[] {
  const errors: string[] = [];
  items.forEach((item, i) => {
    const code = normalizeH1PreferenceCode(item?.preferenceCode);
    if (!code) {
      errors.push(`Item ${i}: missing preference (DE 4/17)`);
      return;
    }
    if (!isValidH1PreferenceCode(code)) {
      errors.push(`Item ${i}: invalid preference '${code}' (DE 4/17)`);
    }
  });
  return errors;
}

export function resolveH1PreferenceCode(item: { preferenceCode?: unknown }, index = 0): string {
  const errors = validateH1PreferenceCodes([item]);
  if (errors.length) {
    throw new Error(errors[0]?.replace("Item 0:", `Item ${index}:`) ?? `Item ${index}: missing preference (DE 4/17)`);
  }
  return normalizeH1PreferenceCode(item.preferenceCode);
}
