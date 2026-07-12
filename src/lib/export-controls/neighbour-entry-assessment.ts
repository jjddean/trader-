import type { ComparisonResult } from "./candidate-dataset";
import type { ControlListEntry } from "./control-list";

export interface EntryAssessment {
  controlEntry: string;
  controlText: string;
  conditionResults: Array<{ conditionId: string; attribute: string; comparisonResult: ComparisonResult; evidenceQuotes: string[]; explanation: string }>;
  testedEntryResult: ComparisonResult;
  decisiveFacts: string[];
  missingEvidence: string[];
  reasoning: string;
}

export function extract6A203B1(entry: ControlListEntry) {
  if (entry.entryCode !== "6A203") throw new Error("Expected 6A203");
  const text = entry.fullText.replace(/\s+/g, " ");
  const match = text.match(/1\. Framing cameras with recording rates greater than ([\d\s,]+) frames per second;/i);
  if (!match) throw new Error("6A203.b.1 threshold not found");
  return { controlEntry: "6A203.b.1", controlText: match[0], threshold: Number(match[1].replace(/[\s,]/g, "")), operator: ">" as const };
}

export function buildCordin560NeighbourAssessment(entry: ControlListEntry): EntryAssessment {
  const requirement = extract6A203B1(entry);
  const conditions: EntryAssessment["conditionResults"] = [
    { conditionId: "N1", attribute: "itemType", comparisonResult: "MET", evidenceQuotes: ["Model 560 HIGH SPEED ROTATING MIRROR CMOS CAMERA"], explanation: "The manufacturer identifies the Model 560 as a framing camera." },
    { conditionId: "N2", attribute: "recordingRate", comparisonResult: 4_000_000 > requirement.threshold ? "MET" : "NOT_MET", evidenceQuotes: ["Maximum Framing Rate 4 million fps (78 frames)"], explanation: `4,000,000 frames/s exceeds ${requirement.threshold.toLocaleString("en-GB")} frames/s.` },
    { conditionId: "N3", attribute: "otherThan6A003", comparisonResult: "MET", evidenceQuotes: ["Model 560 HIGH SPEED ROTATING MIRROR CMOS CAMERA", "The system uses a rotating mirror optical system"], explanation: "The preserved 6A003.a.4 assessment is NOT_MET because the camera is mechanical rotating-mirror rather than electronic; no other 6A003 provision is indicated by the supplied product evidence." },
  ];
  const testedEntryResult: ComparisonResult = conditions.every((condition) => condition.comparisonResult === "MET") ? "MET" : conditions.some((condition) => condition.comparisonResult === "NOT_MET") ? "NOT_MET" : "CANNOT_DETERMINE";
  return { controlEntry: requirement.controlEntry, controlText: requirement.controlText, conditionResults: conditions, testedEntryResult, decisiveFacts: ["Rotating-mirror framing camera", "Maximum framing rate 4,000,000 frames/s", "6A003.a.4 result NOT_MET"], missingEvidence: [], reasoning: "The supplied manufacturer evidence appears to meet the framing-camera and recording-rate conditions of 6A203.b.1. This is a candidate assessment for consultant review, not a final classification." };
}

export function deriveOverallStatus(assessments: EntryAssessment[], unresolvedNeighbours: string[]) {
  const met = assessments.find((assessment) => assessment.testedEntryResult === "MET");
  if (met) return { candidateStatus: "POSSIBLY_LISTED" as const, candidateControlEntry: met.controlEntry };
  if (assessments.some((assessment) => assessment.testedEntryResult === "CANNOT_DETERMINE")) return { candidateStatus: "INSUFFICIENT_EVIDENCE" as const, candidateControlEntry: null };
  if (unresolvedNeighbours.length) return { candidateStatus: "CHECK_NEIGHBOUR_ENTRY" as const, candidateControlEntry: null };
  return { candidateStatus: "POSSIBLY_NOT_LISTED" as const, candidateControlEntry: null };
}
