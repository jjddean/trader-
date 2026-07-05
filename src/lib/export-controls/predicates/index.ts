import type { ExportProduct } from "../extraction";
import type { PredicateHit } from "./types";
import { evaluate5A002 } from "./crypto-5a002";

const EVALUATORS = [evaluate5A002];

export function runPredicates(product: ExportProduct, entryCodes?: string[]): PredicateHit[] {
  const hits = EVALUATORS.flatMap((fn) => fn({ product }));
  if (!entryCodes?.length) return hits;
  const allowed = new Set(entryCodes.map((c) => c.toUpperCase()));
  return hits.filter((h) => allowed.has(h.entryCode.toUpperCase()));
}

export function deterministicMatchScore(hits: PredicateHit[]): number {
  if (hits.some((h) => h.outcome === "threshold_met")) return 1;
  if (hits.some((h) => h.outcome === "insufficient_data")) return 0.45;
  if (hits.some((h) => h.outcome === "threshold_not_met")) return 0.15;
  return 0;
}
