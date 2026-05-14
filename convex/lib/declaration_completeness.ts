// Thin derived view over the rule engine. The single source of truth is
// convex/lib/rule_engine.ts (evaluateRules). This module exists ONLY to
// translate the engine's ValidationResult[] into the {field, reason}[] shape
// the UI and submit gate already speak.
//
// No field rules live here. Adding a new completeness check = adding a row to
// the `rule_definitions` table (or to convex/rule_seed.ts for core/curated
// rules), NOT editing this file.
//
// Pure — no Convex, no I/O. Callers load rules from the db (or seed array)
// and pass them in.

import { evaluateRules, type RuleDefinition, type ScenarioInput } from "./rule_engine";

export interface CompletenessIssue {
  field: string;
  reason: string;
  ruleId: string;
}

export interface CompletenessResult {
  ready: boolean;
  missing: CompletenessIssue[];
}

// Build the scenario input shape the rule engine expects from raw declaration
// + items rows. Mirrors the conversion in submit/route.ts so all callers feed
// the engine the same shape.
function toScenarioInput(declaration: Record<string, unknown>, items: Array<Record<string, unknown>>): ScenarioInput {
  return {
    declaration: {
      declarationType: declaration.declarationType as string | undefined,
      route: declaration.route as string | undefined,
      dispatchCountry: declaration.dispatchCountry as string | undefined,
      transportMode: declaration.transportMode as string | undefined,
      transportId: declaration.transportId as string | undefined,
      transportIdType: declaration.transportIdType as string | undefined,
      valuationMethod: declaration.valuationMethod as string | undefined,
      mode: declaration.mode as string | undefined,
      invoiceTotal: declaration.invoiceTotal as number | string | undefined,
    },
    items: items.map((i) => ({
      commodityCode: i.commodityCode as string | undefined,
      hsCode: i.hsCode as string | undefined,
      originCountry: i.originCountry as string | undefined,
      procedureCode: i.procedureCode as string | undefined,
      additionalProcedureCode: i.additionalProcedureCode as string | undefined,
      valuationMethod: i.valuationMethod as string | undefined,
      preferenceCode: i.preferenceCode as string | undefined,
      additionalDocuments: Array.isArray(i.additionalDocuments) ? i.additionalDocuments : [],
    })),
  };
}

export function evaluateCompleteness(args: {
  rules: RuleDefinition[];
  declaration: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}): CompletenessResult {
  const scenarioInput = toScenarioInput(args.declaration, args.items);
  const results = evaluateRules(args.rules, scenarioInput);
  const blocking = results.filter((r) => r.status === "fail" && r.severity === "blocking");

  return {
    ready: blocking.length === 0,
    missing: blocking.map((r) => ({
      field: r.field || r.ruleId,
      reason: r.reason || r.ruleName,
      ruleId: r.ruleId,
    })),
  };
}
