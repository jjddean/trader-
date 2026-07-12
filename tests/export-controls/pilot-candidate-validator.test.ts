import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePilotCandidate } from "../../src/lib/export-controls/pilot-candidate-validator";

const base = {
  manufacturer: "Example",
  controlEntry: "6A003.a.4",
  compositionRole: "APPEARS_TO_MEET",
  frameRateValue: 1_000_001,
  reasoning: "Candidate only",
  evidenceQuotes: ["Primary quotation"],
  sourceUrl: "https://manufacturer.example/data.pdf",
  unresolvedQuestions: [],
  neighbourEntries: [],
  finalControlEntry: null,
  finalStatus: null,
  reviewerReasoning: null,
};

describe("pilot candidate controlled validation", () => {
  it("rejects descriptive phrases in enum fields", () => {
    const errors = validatePilotCandidate({ ...base, recordId: "x", model: "x", cameraTypeResult: "appears electronic", frameRateResult: "MET", testedEntryResult: "MET", candidateStatus: "POSSIBLY_LISTED" });
    assert.ok(errors.some((error) => error.includes("cameraTypeResult")));
  });

  it("accepts the normalized SIMX result", () => {
    const errors = validatePilotCandidate({ ...base, recordId: "gb-dualuse-0001", model: "SIMX", cameraTypeResult: "MET", frameRateResult: "MET", testedEntryResult: "MET", candidateStatus: "POSSIBLY_LISTED" });
    assert.deepEqual(errors, []);
  });

  it("requires a 6A203.b.1 neighbour check for Cordin 560", () => {
    const errors = validatePilotCandidate({ ...base, recordId: "gb-dualuse-0002", model: "560", compositionRole: "HARD_NEGATIVE", cameraTypeResult: "NOT_MET", frameRateResult: "MET", testedEntryResult: "NOT_MET", candidateStatus: "CHECK_NEIGHBOUR_ENTRY", neighbourEntries: ["6A203.b.1"], neighbourEntryCheckCompleted: false });
    assert.deepEqual(errors, []);
  });

  it("keeps SIR3 indeterminate", () => {
    const errors = validatePilotCandidate({ ...base, recordId: "gb-dualuse-0003", model: "SIR3", compositionRole: "INSUFFICIENT_PUBLIC_EVIDENCE", cameraTypeResult: "CANNOT_DETERMINE", frameRateResult: "CANNOT_DETERMINE", testedEntryResult: "CANNOT_DETERMINE", candidateStatus: "INSUFFICIENT_EVIDENCE", frameRateValue: null });
    assert.deepEqual(errors, []);
  });

  it("rejects POSSIBLY_NOT_LISTED without completed neighbour checking", () => {
    const errors = validatePilotCandidate({ ...base, recordId: "x", model: "x", cameraTypeResult: "NOT_MET", frameRateResult: "MET", testedEntryResult: "NOT_MET", candidateStatus: "POSSIBLY_NOT_LISTED", neighbourEntryCheckCompleted: false });
    assert.ok(errors.some((error) => error.includes("completed neighbour-entry check")));
  });

  it("rejects a tested-entry result not derived from mandatory conditions", () => {
    const errors = validatePilotCandidate({ ...base, recordId: "x", model: "x", cameraTypeResult: "NOT_MET", frameRateResult: "MET", testedEntryResult: "MET", candidateStatus: "POSSIBLY_LISTED" });
    assert.ok(errors.some((error) => error.includes("derived as NOT_MET")));
  });
});
