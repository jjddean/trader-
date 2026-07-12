import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { DualUseCandidateRecord, CandidateExtractedSpec } from "../../src/lib/export-controls/candidate-dataset";
import { validateCandidateForAcceptance } from "../../src/lib/export-controls/candidate-dataset";
import type { ControlListSnapshot } from "../../src/lib/export-controls/control-list";
import { extract6A003A4Requirement } from "../../src/lib/export-controls/control-requirements";
import { evaluate6A003A4 } from "../../src/lib/export-controls/predicates/camera-6a003";

const snapshot = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/export-controls/v2025-12-16.json"), "utf8"),
) as ControlListSnapshot;
const entry = snapshot.entries.find((item) => item.entryCode === "6A003");
assert.ok(entry);
const requirement = extract6A003A4Requirement(entry, snapshot.version);
const manufacturerUrl = "https://manufacturer.example/camera/model-a-datasheet.pdf";

function specs(frameRate: number): CandidateExtractedSpec[] {
  return [
    {
      field: "cameraType",
      originalValue: "Electronic framing camera",
      originalUnit: null,
      normalisedValue: "electronic framing camera",
      normalisedUnit: null,
      evidenceQuote: "Electronic framing camera",
      sourceUrl: manufacturerUrl,
      documentTitle: "Model A datasheet",
      documentRevision: "1",
      pageOrSection: "1",
      extractionConfidence: 0.99,
      decisive: true,
    },
    {
      field: "maximumFrameRate",
      originalValue: `${frameRate} frames/s`,
      originalUnit: "frames/s",
      normalisedValue: frameRate,
      normalisedUnit: "frames/s",
      evidenceQuote: `Maximum framing rate ${frameRate} frames/s`,
      sourceUrl: manufacturerUrl,
      documentTitle: "Model A datasheet",
      documentRevision: "1",
      pageOrSection: "2",
      extractionConfidence: 0.99,
      decisive: true,
    },
  ];
}

describe("6A003.a.4 source-derived requirement", () => {
  it("extracts the threshold and modular-camera note from the official snapshot", () => {
    assert.equal(requirement.controlEntry, "6A003.a.4");
    assert.equal(requirement.conditions[1].operator, ">");
    assert.equal(requirement.conditions[1].thresholdValue, 1_000_000);
    assert.equal(requirement.conditions[1].thresholdUnit, "frames/s");
    assert.match(requirement.source.exactQuote, /Electronic framing cameras/i);
    assert.equal(requirement.technicalNotes.length, 1);
  });

  it("treats the strict boundary as EQUAL_TO_BOUNDARY", () => {
    const results = evaluate6A003A4(requirement, specs(1_000_000));
    assert.equal(results.find((result) => result.conditionId === "C2")?.comparisonResult, "EQUAL_TO_BOUNDARY");
  });

  it("detects values exceeding the parsed threshold", () => {
    const results = evaluate6A003A4(requirement, specs(1_200_000));
    assert.ok(results.every((result) => result.comparisonResult === "MET"));
  });
});

describe("candidate evidence acceptance", () => {
  it("rejects a decisive fact without its manufacturer quotation", () => {
    const extractedSpecs = specs(1_200_000);
    extractedSpecs[1].evidenceQuote = null;
    const record = {
      recordId: "gb-dualuse-0001",
      datasetVersion: "0.1-candidate",
      jurisdiction: "GB",
      controlListVersion: snapshot.version,
      compositionRole: "APPEARS_TO_MEET",
      controlRequirement: requirement,
      product: { manufacturer: "Example", productName: "Model A", model: "A", partNumber: null, productType: "camera", productDescription: "Test fixture" },
      sourceDocuments: [{ sourceType: "MANUFACTURER_PRIMARY", url: manufacturerUrl, title: "Model A datasheet", publisher: "Example", revision: "1", publicationDate: null, retrievedAt: "2026-07-11T00:00:00Z", sha256: null, localArchivePath: null }],
      extractedSpecs,
      conditionResults: evaluate6A003A4(requirement, extractedSpecs),
      candidateAssessment: { aiSuggestedControlEntry: "6A003.a.4", aiSuggestedStatus: "POSSIBLY_LISTED", modelConfidence: 0.9, reasoning: "Test", decisiveFacts: [], failedRequirements: [], possibleExclusions: [], unresolvedQuestions: [], neighbourEntriesConsidered: [] },
      review: { reviewState: "UNREVIEWED", reviewerId: null, reviewDate: null, finalControlEntry: null, finalStatus: null, reviewerReasoning: null, reviewerCorrections: [] },
      quality: { exactModelConfirmed: true, officialControlTextCited: true, primaryProductSourceUsed: true, allDecisiveFactsCited: false, controlLogicPreserved: true, notesAndExclusionsChecked: true, unsupportedClaimsFound: false },
    } satisfies DualUseCandidateRecord;

    const validation = validateCandidateForAcceptance(record);
    assert.equal(validation.accepted, false);
    assert.ok(validation.errors.some((error) => error.includes("lacks an evidence quotation")));
  });
});
