// CDS DE 1/2 letter → WCO TypeCode (IMA, IMD, EXA, …).
// Does not accept category strings (H1/B1/C1/I1). Those are not DE 1/2.

export const CDS_DE_12_LETTERS = ["A", "B", "C", "D", "E", "F", "J", "K", "Y", "Z"] as const;

export function isCdsDe12Letter(value: string): boolean {
  return (CDS_DE_12_LETTERS as readonly string[]).includes(value);
}

/**
 * Resolve IMA/IMD/EXA/EXD from additionalDeclarationType (DE 1/2) and route.
 *
 * Empty letter: IM/EX + A. Stored H1 rows from createDeclaration omit
 * additionalDeclarationType; that path currently files as IMA and must not
 * become a hard failure. This is empty→A, not category "H1"→A.
 *
 * Present but not a DE 1/2 letter: throw. Do not manufacture IMA/EXA.
 */
export function resolveCdsTypeCode(
  additionalDeclarationType: string | undefined | null,
  route: string | undefined,
): string {
  const letter = String(additionalDeclarationType ?? "").trim().toUpperCase();
  const prefix = route === "export" ? "EX" : "IM";
  if (!letter) {
    return `${prefix}A`;
  }
  if (!isCdsDe12Letter(letter)) {
    throw new Error(
      `Invalid additional declaration type (DE 1/2) '${letter}'. Expected one of ${CDS_DE_12_LETTERS.join(", ")}.`,
    );
  }
  return `${prefix}${letter}`;
}
