import type { ExportProduct } from "../extraction";

export interface PredicateHit {
  entryCode: string;
  predicateId: string;
  label: string;
  outcome: "threshold_met" | "threshold_not_met" | "insufficient_data";
  detail: string;
  evidence: string[];
}

export interface PredicateContext {
  product: ExportProduct;
}

export type PredicateEvaluator = (ctx: PredicateContext) => PredicateHit[];
