/**
 * EUSU ↔ application consistency check.
 *
 * ECJU guidance: the most common SIEL application error is an end-user
 * undertaking that does not match the application. Case officers also expect
 * the goods list in the same order on both. This module compares the goods
 * table submitted on the EUSU against the assessment's product lines and
 * reports discrepancies before the exporter applies.
 *
 * Deterministic, hardcoded logic — no AI involvement (workspace rule 2).
 */

export interface EusuItemLineInput {
  description: string;
  quantity?: string;
  unit?: string;
}

export interface ProductLineInput {
  name: string;
  techDescription?: string;
  modelNo?: string;
  partNo?: string;
  quantity?: number;
}

export interface EusuMatchFinding {
  severity: "warning" | "info";
  code:
    | "missing_on_eusu"
    | "extra_on_eusu"
    | "quantity_mismatch"
    | "order_mismatch";
  message: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  const normalized = normalize(value);
  return normalized ? normalized.split(" ") : [];
}

/** Fraction of product-name tokens present in the EUSU item description. */
function nameOverlapScore(productName: string, itemDescription: string): number {
  const nameTokens = tokens(productName);
  if (nameTokens.length === 0) return 0;
  const descriptionTokens = new Set(tokens(itemDescription));
  const hits = nameTokens.filter((t) => descriptionTokens.has(t)).length;
  return hits / nameTokens.length;
}

/** Exact model/part number appearing in the description (token-boundary safe). */
function identifierMatches(product: ProductLineInput, itemDescription: string): boolean {
  const description = ` ${normalize(itemDescription)} `;
  for (const id of [product.modelNo, product.partNo]) {
    const normalized = id ? normalize(id) : "";
    if (normalized && description.includes(` ${normalized} `)) return true;
  }
  return false;
}

const MATCH_THRESHOLD = 0.6;

function matchScore(product: ProductLineInput, item: EusuItemLineInput): number {
  if (identifierMatches(product, item.description)) return 1;
  const byName = nameOverlapScore(product.name, item.description);
  const byTech = product.techDescription
    ? nameOverlapScore(product.techDescription, item.description)
    : 0;
  return Math.max(byName, byTech);
}

/** First number in an EUSU quantity string, e.g. "5 units" -> 5. */
function parseQuantity(value?: string): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function compareEusuToProducts(
  products: ProductLineInput[],
  eusuItems: EusuItemLineInput[],
): EusuMatchFinding[] {
  // Nothing to compare against — the legacy statement form has no goods table
  // and the printable output mirrors the product list directly.
  if (eusuItems.length === 0) return [];

  const findings: EusuMatchFinding[] = [];
  const matchedItemIndexByProduct = new Map<number, number>();
  const takenItemIndexes = new Set<number>();

  // Greedy best-match: products in application order claim their strongest
  // unclaimed EUSU line.
  products.forEach((product, productIndex) => {
    let bestIndex = -1;
    let bestScore = 0;
    eusuItems.forEach((item, itemIndex) => {
      if (takenItemIndexes.has(itemIndex)) return;
      const score = matchScore(product, item);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = itemIndex;
      }
    });
    if (bestIndex >= 0 && bestScore >= MATCH_THRESHOLD) {
      matchedItemIndexByProduct.set(productIndex, bestIndex);
      takenItemIndexes.add(bestIndex);
    }
  });

  products.forEach((product, productIndex) => {
    const itemIndex = matchedItemIndexByProduct.get(productIndex);
    if (itemIndex === undefined) {
      findings.push({
        severity: "warning",
        code: "missing_on_eusu",
        message: `"${product.name}" is on the application but was not found on the undertaking's goods list.`,
      });
      return;
    }

    const eusuQuantity = parseQuantity(eusuItems[itemIndex].quantity);
    if (
      product.quantity != null &&
      eusuQuantity != null &&
      product.quantity !== eusuQuantity
    ) {
      findings.push({
        severity: "warning",
        code: "quantity_mismatch",
        message: `Quantity for "${product.name}" differs — application has ${product.quantity}, undertaking has ${eusuQuantity}.`,
      });
    }
  });

  eusuItems.forEach((item, itemIndex) => {
    if (!takenItemIndexes.has(itemIndex)) {
      findings.push({
        severity: "warning",
        code: "extra_on_eusu",
        message: `Undertaking lists "${item.description}" but it is not on the application's product list.`,
      });
    }
  });

  // ECJU case officers expect both lists in the same order.
  const matchedPairs = [...matchedItemIndexByProduct.entries()].sort((a, b) => a[0] - b[0]);
  const itemOrder = matchedPairs.map(([, itemIndex]) => itemIndex);
  const isOutOfOrder = itemOrder.some((v, i) => i > 0 && v < itemOrder[i - 1]);
  if (isOutOfOrder) {
    findings.push({
      severity: "info",
      code: "order_mismatch",
      message:
        "Goods appear in a different order on the undertaking than on the application. ECJU asks for the same order on both.",
    });
  }

  return findings;
}
