import type { CandidateConditionResult, CandidateExtractedSpec } from "../candidate-dataset";
import type { ControlCondition, StructuredControlRequirement } from "../control-requirements";

function compareNumber(value: number, condition: ControlCondition): CandidateConditionResult["comparisonResult"] {
  const threshold = condition.thresholdValue;
  if (threshold == null) return "CANNOT_DETERMINE";
  if (value === threshold) return "EQUAL_TO_BOUNDARY";
  if (condition.operator === ">") return value > threshold ? "MET" : "NOT_MET";
  if (condition.operator === ">=") return value >= threshold ? "MET" : "NOT_MET";
  if (condition.operator === "<") return value < threshold ? "MET" : "NOT_MET";
  if (condition.operator === "<=") return value <= threshold ? "MET" : "NOT_MET";
  if (condition.operator === "=") return value === threshold ? "MET" : "NOT_MET";
  return "CANNOT_DETERMINE";
}

function findSpec(specs: CandidateExtractedSpec[], field: string): CandidateExtractedSpec | undefined {
  return specs.find((spec) => spec.field === field);
}

export function evaluate6A003A4(
  requirement: StructuredControlRequirement,
  specs: CandidateExtractedSpec[],
): CandidateConditionResult[] {
  if (requirement.controlEntry !== "6A003.a.4") {
    throw new Error(`Expected 6A003.a.4 requirement, received ${requirement.controlEntry}`);
  }

  return requirement.conditions.map((condition) => {
    const spec = findSpec(specs, condition.attribute);
    const common = {
      conditionId: condition.conditionId,
      controlEntry: requirement.controlEntry,
      attribute: condition.attribute,
      operator: condition.operator,
      thresholdValue: condition.thresholdValue ?? condition.expectedValue,
      thresholdUnit: condition.thresholdUnit,
      productValue: spec?.normalisedValue ?? null,
      productUnit: spec?.normalisedUnit ?? null,
      evidenceAvailable: Boolean(spec?.evidenceQuote && spec.sourceUrl),
      evidenceSource: spec?.sourceUrl ?? null,
    };

    if (!spec || spec.normalisedValue == null) {
      return { ...common, comparisonResult: "CANNOT_DETERMINE" as const, explanation: "Required product evidence is unavailable." };
    }

    if (condition.expectedValue != null) {
      const actual = String(spec.normalisedValue).toLowerCase();
      const expected = condition.expectedValue.toLowerCase();
      const met = actual === expected;
      return {
        ...common,
        comparisonResult: met ? "MET" as const : "NOT_MET" as const,
        explanation: met ? "The documented camera type matches the control requirement." : "The documented camera type does not match the control requirement.",
      };
    }

    if (typeof spec.normalisedValue !== "number") {
      return { ...common, comparisonResult: "CANNOT_DETERMINE" as const, explanation: "The product value is not numeric." };
    }
    const comparisonResult = compareNumber(spec.normalisedValue, condition);
    return {
      ...common,
      comparisonResult,
      explanation: `Compared ${spec.normalisedValue} ${spec.normalisedUnit ?? ""} ${condition.operator} ${condition.thresholdValue} ${condition.thresholdUnit ?? ""}.`.trim(),
    };
  });
}
