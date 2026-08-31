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

import { evaluateRules, scenarioInputFromRecords, type RuleDefinition } from "./rule_engine";

export interface CompletenessIssue {
  field: string;
  reason: string;
  ruleId: string;
}

export interface CompletenessResult {
  ready: boolean;
  missing: CompletenessIssue[];
}

export function evaluateCompleteness(args: {
  rules: RuleDefinition[];
  declaration: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}): CompletenessResult {
  const scenarioInput = scenarioInputFromRecords(args.declaration, args.items);
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
