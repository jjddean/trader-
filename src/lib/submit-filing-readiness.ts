/**
 * Customs filing readiness vs document checklist.
 *
 * Filing readiness is rule-engine completeness only.
 * document_requirements rows hydrated from REQUIRED_DOCS are checklist UX.
 * They must not independently disable Dry Run / Submit.
 */

export interface ChecklistRequirementRow {
  code?: string;
  status?: string;
  requirementLevel?: string;
}

export interface SubmitReadiness {
  isReady: boolean;
  completenessReady: boolean;
  missingBlockingChecklist: ChecklistRequirementRow[];
  missingAdvisoryChecklist: ChecklistRequirementRow[];
  missingBlockingCodes: string[];
  missingAdvisoryCodes: string[];
}

function missingAtLevel(
  requirements: ChecklistRequirementRow[] | undefined,
  level: "blocking" | "advisory",
): ChecklistRequirementRow[] {
  return (requirements || []).filter(
    (req) => req.status === "missing" && (req.requirementLevel || "blocking") === level,
  );
}

export function resolveSubmitReadiness(args: {
  completenessReady: boolean;
  requirements?: ChecklistRequirementRow[];
}): SubmitReadiness {
  const missingBlockingChecklist = missingAtLevel(args.requirements, "blocking");
  const missingAdvisoryChecklist = missingAtLevel(args.requirements, "advisory");
  return {
    isReady: args.completenessReady === true,
    completenessReady: args.completenessReady === true,
    missingBlockingChecklist,
    missingAdvisoryChecklist,
    missingBlockingCodes: missingBlockingChecklist.map((req) => String(req.code || "UNKNOWN")),
    missingAdvisoryCodes: missingAdvisoryChecklist.map((req) => String(req.code || "UNKNOWN")),
  };
}
