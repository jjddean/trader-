import { CDS_WCO_REFERENCES } from "../../convex/lib/cds_wco_references";

/**
 * Derives a CDS amendment pointer chain from the HMRC-generated WCO reference
 * table (cds_wco_references.ts). This is the no-guessing source of truth: every
 * DocumentSectionCode and the leaf TagID come straight from HMRC's spec rows.
 *
 * Convention (verified against HMRC sample TT_IM002b_Amendment.xml):
 * the pointer chain lists every ancestor container's WCO ID, and the final
 * pointer (the leaf's parent container) carries the leaf field's TagID.
 */
export interface DerivedHeaderAmendment {
  /** Ancestor container DocumentSectionCodes, e.g. ["42A","67A"]. */
  pointerSections: string[];
  /** Leaf field TagID carried on the final pointer, e.g. "103". */
  leafTagId: string;
  /** Element path below <Declaration>, e.g. ["GoodsShipment","TransactionNatureCode"]. */
  fragmentPath: string[];
  /** DE number from the spec row, e.g. "8/5". */
  dec: string;
  /** Amendment-column symbol from the spec row. */
  am: string;
}

const BY_PATH = new Map<string, (typeof CDS_WCO_REFERENCES)[number]>(
  CDS_WCO_REFERENCES.filter((r) => r.wcoPath).map((r) => [r.wcoPath, r]),
);

/**
 * @param wcoPath full WCO path, e.g. "Declaration/GoodsShipment/TransactionNatureCode"
 * @returns derived pointer chain, or null if the path or any ancestor wcoId is missing.
 */
export function deriveHeaderAmendment(wcoPath: string): DerivedHeaderAmendment | null {
  const leaf = BY_PATH.get(wcoPath);
  if (!leaf || !leaf.wcoId) return null;

  const parts = wcoPath.split("/");
  if (parts.length < 2) return null;

  const pointerSections: string[] = [];
  // Ancestors = every path prefix except the leaf itself.
  for (let i = 0; i < parts.length - 1; i++) {
    const prefix = parts.slice(0, i + 1).join("/");
    const entry = BY_PATH.get(prefix);
    if (!entry || !entry.wcoId) return null;
    pointerSections.push(entry.wcoId);
  }

  return {
    pointerSections,
    leafTagId: leaf.wcoId,
    fragmentPath: parts.slice(1),
    dec: leaf.dec,
    am: leaf.am,
  };
}
