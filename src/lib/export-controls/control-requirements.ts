import type { ControlListEntry } from "./control-list";

export type RequirementOperator = ">" | ">=" | "<" | "<=" | "=";

export interface ControlCondition {
  conditionId: string;
  attribute: string;
  operator: RequirementOperator;
  thresholdValue: number | null;
  thresholdUnit: string | null;
  expectedValue: string | null;
  mandatory: boolean;
}

export interface StructuredControlRequirement {
  controlEntry: string;
  entryFamily: string;
  entryHeading: string;
  itemType: string;
  controlText: string;
  conditions: ControlCondition[];
  logic: "ALL" | "ANY";
  definitions: string[];
  technicalNotes: string[];
  exclusions: string[];
  crossReferences: string[];
  source: {
    document: "UK Strategic Export Control List";
    version: string;
    page: number;
    section: string;
    exactQuote: string;
  };
}

function normaliseSourceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseNumber(raw: string): number {
  return Number(raw.replace(/[\s,]/g, ""));
}

/**
 * Extract 6A003.a.4 from the parsed, versioned control-list entry.
 * The threshold and operator are parsed from source text; they are not encoded
 * in the evaluator.
 */
export function extract6A003A4Requirement(
  entry: ControlListEntry,
  version: string,
): StructuredControlRequirement {
  if (entry.entryCode.toUpperCase() !== "6A003") {
    throw new Error(`Expected control entry 6A003, received ${entry.entryCode}`);
  }

  const text = normaliseSourceText(entry.fullText);
  const clause = text.match(
    /4\.\s*Electronic framing cameras having a speed (exceeding|equal to or exceeding|less than|equal to or less than)\s*([\d\s,]+)\s*frames\/s\s*;/i,
  );
  if (!clause) {
    throw new Error("The exact 6A003.a.4 threshold text was not found in the supplied control-list entry");
  }

  const operatorByPhrase: Record<string, RequirementOperator> = {
    exceeding: ">",
    "equal to or exceeding": ">=",
    "less than": "<",
    "equal to or less than": "<=",
  };
  const phrase = clause[1].toLowerCase();
  const thresholdValue = parseNumber(clause[2]);
  if (!Number.isFinite(thresholdValue)) {
    throw new Error("The 6A003.a.4 threshold could not be parsed as a number");
  }

  const modularNote = text.match(
    /Note:\s*Instrumentation cameras, specified in 6A003\.a\.3\. to 6A003\.a\.5\., with modular structures should be evaluated by their maximum capability, using plug-ins available according to the camera manufacturer's specifications\./i,
  );

  const exactQuote = clause[0].trim();
  return {
    controlEntry: "6A003.a.4",
    entryFamily: "6A003",
    entryHeading: entry.title,
    itemType: "equipment",
    controlText: exactQuote,
    conditions: [
      {
        conditionId: "C1",
        attribute: "cameraType",
        operator: "=",
        thresholdValue: null,
        thresholdUnit: null,
        expectedValue: "electronic framing camera",
        mandatory: true,
      },
      {
        conditionId: "C2",
        attribute: "maximumFrameRate",
        operator: operatorByPhrase[phrase],
        thresholdValue,
        thresholdUnit: "frames/s",
        expectedValue: null,
        mandatory: true,
      },
    ],
    logic: "ALL",
    definitions: [],
    technicalNotes: modularNote ? [modularNote[0]] : [],
    exclusions: [],
    crossReferences: entry.crossRefs.map((ref) => ref.targetEntryCode),
    source: {
      document: "UK Strategic Export Control List",
      version,
      page: entry.pageStart,
      section: "6A003.a.4",
      exactQuote,
    },
  };
}
