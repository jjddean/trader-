import type { ComparisonResult } from "./candidate-dataset";

export type PilotCandidateStatus = "POSSIBLY_LISTED" | "POSSIBLY_NOT_LISTED" | "INSUFFICIENT_EVIDENCE" | "CHECK_NEIGHBOUR_ENTRY";
export const CONTROLLED_RESULTS: readonly ComparisonResult[] = ["MET", "NOT_MET", "EQUAL_TO_BOUNDARY", "CANNOT_DETERMINE", "NOT_APPLICABLE"];
export const PILOT_STATUSES: readonly PilotCandidateStatus[] = ["POSSIBLY_LISTED", "POSSIBLY_NOT_LISTED", "INSUFFICIENT_EVIDENCE", "CHECK_NEIGHBOUR_ENTRY"];

export function deriveTestedEntryResult(results: ComparisonResult[]): ComparisonResult {
  if (results.some((result) => result === "NOT_MET" || result === "EQUAL_TO_BOUNDARY")) return "NOT_MET";
  if (results.some((result) => result === "CANNOT_DETERMINE")) return "CANNOT_DETERMINE";
  if (results.every((result) => result === "MET")) return "MET";
  return "NOT_APPLICABLE";
}

export function validatePilotCandidate(record: unknown): string[] {
  if (!record || typeof record !== "object") return ["record must be an object"];
  const value = record as Record<string, unknown>;
  const errors: string[] = [];
  for (const field of ["cameraTypeResult", "frameRateResult", "testedEntryResult"]) {
    if (!CONTROLLED_RESULTS.includes(value[field] as ComparisonResult)) errors.push(`${field} must contain an allowed controlled enum`);
  }
  if (!PILOT_STATUSES.includes(value.candidateStatus as PilotCandidateStatus)) errors.push("candidateStatus must contain an allowed controlled enum");
  if (errors.length) return errors;
  const derived = deriveTestedEntryResult([value.cameraTypeResult, value.frameRateResult] as ComparisonResult[]);
  if (value.testedEntryResult !== derived) errors.push(`testedEntryResult must be derived as ${derived}`);
  const neighbours = Array.isArray(value.neighbourEntries) ? value.neighbourEntries.map(String) : [];
  if (value.candidateStatus === "POSSIBLY_LISTED" && value.testedEntryResult !== "MET") errors.push("POSSIBLY_LISTED requires testedEntryResult=MET");
  if (value.candidateStatus === "INSUFFICIENT_EVIDENCE" && value.testedEntryResult !== "CANNOT_DETERMINE") errors.push("INSUFFICIENT_EVIDENCE requires testedEntryResult=CANNOT_DETERMINE");
  if (value.candidateStatus === "CHECK_NEIGHBOUR_ENTRY" && (value.testedEntryResult !== "NOT_MET" || neighbours.length === 0)) errors.push("CHECK_NEIGHBOUR_ENTRY requires NOT_MET and a plausible neighbour");
  if (value.candidateStatus === "POSSIBLY_NOT_LISTED" && value.neighbourEntryCheckCompleted !== true) errors.push("POSSIBLY_NOT_LISTED requires a completed neighbour-entry check");
  if (value.testedEntryResult === "NOT_MET" && neighbours.length > 0 && value.candidateStatus !== "CHECK_NEIGHBOUR_ENTRY") errors.push("failed tested entry with a plausible neighbour must use CHECK_NEIGHBOUR_ENTRY");
  for (const field of ["finalControlEntry", "finalStatus", "reviewerReasoning"]) if (field in value && value[field] !== null) errors.push(`${field} must remain null`);
  return errors;
}
