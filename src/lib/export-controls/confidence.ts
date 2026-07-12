import type { ExportProduct } from "./extraction";
import type { PredicateHit } from "./predicates/types";
import { deterministicMatchScore } from "./predicates";

export interface ConfidenceInputs {
  product: ExportProduct;
  predicateHits: PredicateHit[];
  missingFields: string[];
  /** 1.0 when sanctions not run yet; Phase 4 will supply real value. */
  sanctionsClearance?: number;
}

export function averageExtractionConfidence(product: ExportProduct): number {
  if (product.specs.length === 0) return 0.55;
  const sum = product.specs.reduce((acc, s) => acc + (s.confidence ?? 0.7), 0);
  return sum / product.specs.length;
}

export function completenessScore(missingFields: string[]): number {
  if (missingFields.length === 0) return 1;
  if (missingFields.length <= 2) return 0.7;
  if (missingFields.length <= 4) return 0.45;
  return 0.25;
}

/** Transparent weighted model from BUILD-PLAN Phase 3. */
export function computeClassificationConfidence(input: ConfidenceInputs): number {
  const extraction = averageExtractionConfidence(input.product);
  const deterministic = deterministicMatchScore(input.predicateHits);
  const sanctions = input.sanctionsClearance ?? 1;
  const completeness = completenessScore(input.missingFields);

  const score =
    0.35 * extraction +
    0.4 * deterministic +
    0.15 * sanctions +
    0.1 * completeness;

  return Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000;
}
