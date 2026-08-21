/**
 * Declaration-category routing for the submit route.
 *
 * The route's original pre-mapper gate (`validateDeclaration`) is written
 * against the H1 full import data set. Running it on another category is wrong
 * in both directions — it demands elements the category does not have, and
 * misses the ones the category makes mandatory. Each category therefore gets
 * its own gate, and anything unrecognised stays on H1 so existing rows are
 * untouched.
 *
 * Obligations:
 *   H1  docs/hmrc/specs/cds-api/appendix-21a-h1-obligations.md
 *   I1  docs/hmrc/specs/cds-api/appendix-21f-i1-obligations.md
 *   B1  docs/hmrc/specs/cds-api/appendix-22a-b1-obligations.md
 */

import { validateB1Declaration } from "./b1-mapper";
import { validateI1Declaration } from "./i1-mapper";
import { validateGoodsLocationForSubmit } from "./goods-location";
import { validateGoodsItemSequences } from "./submit-goods-items";
import { commodityRequiresSupplementaryUnit } from "./wco-mapper";

export type DeclarationCategory = "B1" | "I1" | "H1";

/** Categories with their own mapper, renderer and gate. */
const ROUTED_CATEGORIES: readonly DeclarationCategory[] = ["B1", "I1"];

/**
 * Which data set a declaration files under. Anything that is not an explicitly
 * routed category stays on the H1 import family.
 */
export function resolveDeclarationCategory(lane: unknown): DeclarationCategory {
  const raw = (lane ?? {}) as Record<string, unknown>;
  const value = String(raw.declarationCategory ?? "").trim().toUpperCase();
  return (ROUTED_CATEGORIES as readonly string[]).includes(value)
    ? (value as DeclarationCategory)
    : "H1";
}

/** True when the submit route must take the export mapper and renderer. */
export function isB1ExportDeclaration(lane: unknown): boolean {
  return resolveDeclarationCategory(lane) === "B1";
}

/** True when the submit route must take the simplified import mapper and renderer. */
export function isI1ImportDeclaration(lane: unknown): boolean {
  return resolveDeclarationCategory(lane) === "I1";
}

/** Checks shared by every category: DE 5/23 resolution, sequences, DE 6/2. */
function sharedGate(
  lane: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  const errors: string[] = [];
  errors.push(...validateGoodsLocationForSubmit(lane ?? {}));

  if (!Array.isArray(items) || items.length === 0) return errors;

  errors.push(...validateGoodsItemSequences(items as never));
  items.forEach((item, i) => {
    // DE 6/2 — supplementary units, driven by the commodity, not the category.
    if (commodityRequiresSupplementaryUnit(item?.commodityCode)) {
      const su = parseFloat(String(item?.supplementaryUnitQty ?? ""));
      if (!Number.isFinite(su) || su <= 0) {
        errors.push(
          `Item ${i}: supplementary units (DE 6/2, p/st) required for commodity ${String(item.commodityCode)}`,
        );
      }
    }
  });
  return errors;
}

/**
 * Pre-mapper gate for B1. Mirrors the shape of the route's H1 gate — a flat
 * list of human-readable gaps returned before any XML is built — but asserts
 * the export obligation set.
 */
export function validateB1SubmitGate(
  lane: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  return [
    ...validateB1Declaration(lane ?? {}, items ?? []),
    ...sharedGate(lane, items),
  ];
}

/**
 * Pre-mapper gate for I1 C&F. The reduced form still carries mandatory
 * documents (DE 2/3) and an authorisation holder (DE 3/39) that the H1 gate
 * treats as optional, and drops DE 8/5 which the H1 gate requires.
 */
export function validateI1SubmitGate(
  lane: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  return [
    ...validateI1Declaration(lane ?? {}, items ?? []),
    ...sharedGate(lane, items),
  ];
}
