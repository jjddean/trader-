import type { StructuredControlRequirement } from "./control-requirements";

export type ComparisonResult =
  | "MET"
  | "NOT_MET"
  | "EQUAL_TO_BOUNDARY"
  | "CANNOT_DETERMINE"
  | "NOT_APPLICABLE";

export type CandidateStatus =
  | "POSSIBLY_LISTED"
  | "POSSIBLY_NOT_LISTED"
  | "AMBIGUOUS"
  | "INSUFFICIENT_EVIDENCE";

export type CompositionRole =
  | "APPEARS_TO_MEET"
  | "DECISIVE_THRESHOLD_NEGATIVE"
  | "POSSIBLE_EXCLUSION"
  | "INSUFFICIENT_PUBLIC_EVIDENCE"
  | "HARD_NEGATIVE";

export interface CandidateSourceDocument {
  sourceType: "OFFICIAL_CONTROL_LIST" | "MANUFACTURER_PRIMARY" | "AUTHORISED_DISTRIBUTOR_COPY";
  url: string;
  title: string;
  publisher: string;
  revision: string | null;
  publicationDate: string | null;
  retrievedAt: string;
  sha256: string | null;
  localArchivePath: string | null;
}

export interface CandidateExtractedSpec {
  field: string;
  originalValue: string | null;
  originalUnit: string | null;
  normalisedValue: number | string | boolean | null;
  normalisedUnit: string | null;
  evidenceQuote: string | null;
  sourceUrl: string | null;
  documentTitle: string | null;
  documentRevision: string | null;
  pageOrSection: string | null;
  extractionConfidence: number;
  decisive: boolean;
}

export interface CandidateConditionResult {
  conditionId: string;
  controlEntry: string;
  attribute: string;
  operator: string;
  thresholdValue: number | string | null;
  thresholdUnit: string | null;
  productValue: number | string | boolean | null;
  productUnit: string | null;
  comparisonResult: ComparisonResult;
  evidenceAvailable: boolean;
  evidenceSource: string | null;
  explanation: string;
}

export interface DualUseCandidateRecord {
  recordId: string;
  datasetVersion: "0.1-candidate";
  jurisdiction: "GB";
  controlListVersion: string;
  compositionRole: CompositionRole;
  controlRequirement: StructuredControlRequirement;
  product: {
    manufacturer: string;
    productName: string;
    model: string;
    partNumber: string | null;
    productType: string;
    productDescription: string;
  };
  sourceDocuments: CandidateSourceDocument[];
  extractedSpecs: CandidateExtractedSpec[];
  conditionResults: CandidateConditionResult[];
  candidateAssessment: {
    aiSuggestedControlEntry: string | null;
    aiSuggestedStatus: CandidateStatus;
    modelConfidence: number;
    reasoning: string;
    decisiveFacts: string[];
    failedRequirements: string[];
    possibleExclusions: string[];
    unresolvedQuestions: string[];
    neighbourEntriesConsidered: string[];
  };
  review: {
    reviewState: "UNREVIEWED";
    reviewerId: null;
    reviewDate: null;
    finalControlEntry: null;
    finalStatus: null;
    reviewerReasoning: null;
    reviewerCorrections: never[];
  };
  quality: {
    exactModelConfirmed: boolean;
    officialControlTextCited: boolean;
    primaryProductSourceUsed: boolean;
    allDecisiveFactsCited: boolean;
    controlLogicPreserved: boolean;
    notesAndExclusionsChecked: boolean;
    unsupportedClaimsFound: boolean;
  };
}

export interface CandidateValidationResult {
  accepted: boolean;
  readyForConsultantReview: boolean;
  errors: string[];
}

export function validateCandidateForAcceptance(record: DualUseCandidateRecord): CandidateValidationResult {
  const errors: string[] = [];
  if (!/^gb-dualuse-\d{4}$/.test(record.recordId)) errors.push("recordId is invalid");
  if (record.jurisdiction !== "GB") errors.push("jurisdiction must be GB");
  if (!record.controlRequirement.controlEntry.includes(".")) errors.push("exact control subparagraph is required");
  if (!record.controlRequirement.source.exactQuote.trim()) errors.push("official control quotation is required");
  if (!record.product.manufacturer.trim()) errors.push("manufacturer is required");
  if (!record.product.model.trim()) errors.push("exact product model is required");

  const primaryUrls = new Set(
    record.sourceDocuments
      .filter((doc) => doc.sourceType === "MANUFACTURER_PRIMARY")
      .map((doc) => doc.url),
  );
  if (primaryUrls.size === 0) errors.push("at least one primary manufacturer source is required");

  for (const spec of record.extractedSpecs.filter((item) => item.decisive)) {
    if (!spec.evidenceQuote?.trim()) errors.push(`decisive spec ${spec.field} lacks an evidence quotation`);
    if (!spec.sourceUrl?.trim()) errors.push(`decisive spec ${spec.field} lacks a source URL`);
    if (spec.sourceUrl && !primaryUrls.has(spec.sourceUrl)) {
      errors.push(`decisive spec ${spec.field} is not tied to a primary manufacturer source`);
    }
  }

  const resultIds = new Set(record.conditionResults.map((result) => result.conditionId));
  for (const condition of record.controlRequirement.conditions.filter((item) => item.mandatory)) {
    if (!resultIds.has(condition.conditionId)) errors.push(`mandatory condition ${condition.conditionId} was not evaluated`);
  }
  if (record.review.finalStatus !== null || record.review.finalControlEntry !== null) {
    errors.push("consultant final fields must remain null");
  }
  if (record.quality.unsupportedClaimsFound) errors.push("unsupported claims were found");

  const accepted = errors.length === 0;
  const readyForConsultantReview =
    accepted &&
    record.quality.exactModelConfirmed &&
    record.quality.officialControlTextCited &&
    record.quality.primaryProductSourceUsed &&
    record.quality.allDecisiveFactsCited &&
    record.quality.controlLogicPreserved &&
    record.quality.notesAndExclusionsChecked;
  return { accepted, readyForConsultantReview, errors };
}
