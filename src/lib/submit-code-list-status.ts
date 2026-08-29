import type { CodeListLookup } from "./wco-mapper";

export type CodeListLookupOutcome = "checked" | "unseeded" | "unavailable";

export type CodeListDryRunStatus = {
  codeLists: "checked" | "skipped";
  skippedCodeLists?: string[];
  unavailableCodeLists?: string[];
};

const OUTCOME_RANK: Record<CodeListLookupOutcome, number> = {
  checked: 0,
  unseeded: 1,
  unavailable: 2,
};

export type CdsCodeListLookupDeps = {
  listCodes: (listName: string) => Promise<unknown[] | null | undefined>;
  validateCodes: (
    listName: string,
    values: string[],
  ) => Promise<{ missing?: string[] } | null | undefined>;
};

function recordOutcome(
  outcomes: Map<string, CodeListLookupOutcome>,
  listName: string,
  outcome: CodeListLookupOutcome,
) {
  const previous = outcomes.get(listName);
  if (previous === undefined || OUTCOME_RANK[outcome] > OUTCOME_RANK[previous]) {
    outcomes.set(listName, outcome);
  }
}

export function summarizeCodeListLookups(
  outcomes: Map<string, CodeListLookupOutcome>,
): CodeListDryRunStatus {
  const skippedCodeLists: string[] = [];
  const unavailableCodeLists: string[] = [];
  for (const [listName, outcome] of outcomes) {
    if (outcome === "unseeded" || outcome === "unavailable") {
      skippedCodeLists.push(listName);
    }
    if (outcome === "unavailable") {
      unavailableCodeLists.push(listName);
    }
  }
  skippedCodeLists.sort();
  unavailableCodeLists.sort();
  if (skippedCodeLists.length === 0) {
    return { codeLists: "checked" };
  }
  return {
    codeLists: "skipped",
    skippedCodeLists,
    ...(unavailableCodeLists.length > 0 ? { unavailableCodeLists } : {}),
  };
}

/**
 * Same fail-open lookup as the submit route: unseeded lists and lookup
 * exceptions return [] so filing continues. Outcomes are recorded so dry-run
 * can report whether validation actually ran.
 */
export function createTrackedCdsCodeListLookup(deps: CdsCodeListLookupDeps): {
  lookup: CodeListLookup;
  status: () => CodeListDryRunStatus;
} {
  const outcomes = new Map<string, CodeListLookupOutcome>();
  const lookup: CodeListLookup = async (listName, values) => {
    try {
      const seeded = await deps.listCodes(listName);
      if (!seeded || seeded.length === 0) {
        console.warn(
          `[SUBMIT] Code list '${listName}' is not seeded — skipping validation for ${values.length} value(s) (fail-open).`,
        );
        recordOutcome(outcomes, listName, "unseeded");
        return [];
      }
      const result = await deps.validateCodes(listName, values);
      recordOutcome(outcomes, listName, "checked");
      return result?.missing ?? [];
    } catch (lookupErr) {
      console.error(
        `[SUBMIT] Code-list lookup for '${listName}' failed — codes left unvalidated (fail-open):`,
        lookupErr,
      );
      recordOutcome(outcomes, listName, "unavailable");
      return [];
    }
  };
  return {
    lookup,
    status: () => summarizeCodeListLookups(outcomes),
  };
}
