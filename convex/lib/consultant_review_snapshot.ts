/**
 * The frozen consultant-review snapshot.
 *
 * `expert_requests.assessmentSnapshot` used to hold `{ frozenAt, reference }` —
 * not enough to reconstruct what a consultant was asked to review, so a later
 * exporter edit silently changed the subject of a review already in flight.
 * This module freezes the whole review subject at dispatch time: assessment,
 * parties, products and their classification runs, screenings, licences,
 * evidence metadata and the routing decision.
 *
 * Rules:
 *  - Plain JSON only. Every value is cloned, so nothing here aliases a live
 *    Convex document.
 *  - Evidence carries metadata and an id, never a storage URL. Access runs
 *    through the authenticated partner evidence route.
 *  - Additive changes only. Bump CONSULTANT_SNAPSHOT_VERSION when the shape
 *    changes so a consumer can tell what it is reading.
 *
 * The consultant UI (FreightCode's own review page and a partner consultant
 * workspace) rebuilds the draft pack from this snapshot, so both render the
 * same review from the same frozen facts.
 */

import { resolveSubmissionRoute, type RoutingResult } from "./export_routing";

export const CONSULTANT_SNAPSHOT_VERSION = 1;

export type SnapshotOriginJurisdiction = "GB" | "NI";

export type SnapshotEvidenceKind =
  | "technical_description"
  | "datasheet"
  | "brochure"
  | "web_page"
  | "commercial_invoice"
  | "eusu_signed"
  | "other";

export interface SnapshotParty {
  name?: string;
  address?: string;
  country?: string;
}

export interface SnapshotProductSpec {
  key: string;
  valueRaw: string;
  valueNum?: number;
  unit?: string;
  sourcePage?: number;
  sourceQuote?: string;
  confidence?: number;
}

export interface SnapshotClassificationRun {
  requiresReview: boolean;
  finalControlEntry?: string;
  confidence?: number;
  controlListVersion?: string;
  modelVersion?: string;
  createdAt: number;
}

export interface SnapshotProduct {
  productId: string;
  name: string;
  manufacturer?: string;
  modelNo?: string;
  partNo?: string;
  quantity?: number;
  valueGbp?: number;
  techDescription?: string;
  specs: SnapshotProductSpec[];
  /** Newest first — index 0 is the run the draft pack reads. */
  classificationRuns: SnapshotClassificationRun[];
}

export interface SnapshotScreening {
  screeningId: string;
  subjectType: string;
  subjectName: string;
  matchedUniqueId?: string;
  score?: number;
  matchReason?: string;
  sanctionsVersion?: string;
  reviewStatus: string;
  createdAt: number;
}

export interface SnapshotLicence {
  licenceId: string;
  licenceType: string;
  applicationRef?: string;
  licenceRef?: string;
  route?: string;
  recordedAt: number;
}

export interface SnapshotEvidence {
  evidenceId: string;
  kind: SnapshotEvidenceKind;
  label: string;
  note?: string;
  /** External link recorded by the exporter (product web page). Not a file. */
  url?: string;
  fileName?: string;
  fileSize?: number;
  /** True when a stored file backs this row and can be fetched by the partner. */
  hasFile: boolean;
  addedAt: number;
}

export interface SnapshotAssessment {
  assessmentId: string;
  reference: string;
  status: string;
  originJurisdiction?: SnapshotOriginJurisdiction;
  destinationCountry?: string;
  consignee?: SnapshotParty;
  endUser?: SnapshotParty;
  intendedUse?: string;
  endUserStatement?: Record<string, unknown>;
  submissionRoute?: string;
  controlListVersion?: string;
  sanctionsVersion?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConsultantReviewSnapshot {
  snapshotVersion: number;
  frozenAt: number;
  reference: string;
  senderNote?: string;
  expiresAt: number;
  assessment: SnapshotAssessment;
  products: SnapshotProduct[];
  screenings: SnapshotScreening[];
  licences: SnapshotLicence[];
  evidence: SnapshotEvidence[];
  /** Routing as decided at freeze time, from the frozen inputs. */
  routing: RoutingResult;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * JSON round-trip. `consignee`, `endUser` and `endUserStatement` are
 * `v.optional(v.any())` in the schema, so the only safe way to detach them from
 * the live document is to copy the value structurally.
 */
function cloneJson<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return undefined;
  }
}

function party(value: unknown): SnapshotParty | undefined {
  const copy = cloneJson<Record<string, unknown>>(value);
  if (!copy || typeof copy !== "object") return undefined;
  const result: SnapshotParty = {
    name: text(copy.name),
    address: text(copy.address),
    country: text(copy.country),
  };
  if (!result.name && !result.address && !result.country) return undefined;
  return result;
}

export interface SnapshotSourceProduct {
  _id: unknown;
  name: string;
  manufacturer?: string;
  modelNo?: string;
  partNo?: string;
  quantity?: number;
  valueGbp?: number;
  techDescription?: string;
  specs?: Array<Record<string, unknown>>;
  classificationRuns?: Array<Record<string, unknown>>;
}

export interface SnapshotSourceEvidence {
  _id: unknown;
  kind: string;
  label: string;
  note?: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  /** Set when the evidence row resolves to a stored file. See `hasFile`. */
  storageId?: unknown;
  addedAt: number;
}

export interface BuildSnapshotInput {
  assessment: Record<string, unknown>;
  products: SnapshotSourceProduct[];
  screenings: Array<Record<string, unknown>>;
  licences: Array<Record<string, unknown>>;
  evidence: SnapshotSourceEvidence[];
  senderNote?: string;
  frozenAt: number;
  expiresAt: number;
}

/**
 * Control entries the draft pack and routing treat as decided. A run still
 * flagged `requiresReview` contributes nothing — same rule the live UI applies.
 */
export function approvedControlEntries(products: SnapshotProduct[]): string[] {
  return products.flatMap((product) => {
    const run = product.classificationRuns[0];
    if (run && run.requiresReview === false) return [run.finalControlEntry ?? ""];
    return [];
  });
}

export function buildConsultantReviewSnapshot(
  input: BuildSnapshotInput,
): ConsultantReviewSnapshot {
  const assessment = input.assessment;
  const origin = text(assessment.originJurisdiction);

  const products: SnapshotProduct[] = input.products.map((product) => ({
    productId: String(product._id),
    name: product.name,
    manufacturer: text(product.manufacturer),
    modelNo: text(product.modelNo),
    partNo: text(product.partNo),
    quantity: num(product.quantity),
    valueGbp: num(product.valueGbp),
    techDescription: text(product.techDescription),
    specs: (product.specs ?? []).map((spec) => ({
      key: String(spec.key ?? ""),
      valueRaw: String(spec.valueRaw ?? ""),
      valueNum: num(spec.valueNum),
      unit: text(spec.unit),
      sourcePage: num(spec.sourcePage),
      sourceQuote: text(spec.sourceQuote),
      confidence: num(spec.confidence),
    })),
    classificationRuns: (product.classificationRuns ?? [])
      .map((run) => ({
        requiresReview: run.requiresReview === true,
        finalControlEntry: text(run.finalControlEntry),
        confidence: num(run.confidence),
        controlListVersion: text(run.controlListVersion),
        modelVersion: text(run.modelVersion),
        createdAt: num(run.createdAt) ?? input.frozenAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt),
  }));

  const snapshotAssessment: SnapshotAssessment = {
    assessmentId: String(assessment._id),
    reference: String(assessment.reference ?? ""),
    status: String(assessment.status ?? "draft"),
    originJurisdiction: origin === "NI" ? "NI" : origin === "GB" ? "GB" : undefined,
    destinationCountry: text(assessment.destinationCountry),
    consignee: party(assessment.consignee),
    endUser: party(assessment.endUser),
    intendedUse: text(assessment.intendedUse),
    endUserStatement: cloneJson<Record<string, unknown>>(assessment.endUserStatement),
    submissionRoute: text(assessment.submissionRoute),
    controlListVersion: text(assessment.controlListVersion),
    sanctionsVersion: text(assessment.sanctionsVersion),
    createdAt: num(assessment.createdAt) ?? input.frozenAt,
    updatedAt: num(assessment.updatedAt) ?? input.frozenAt,
  };

  const routing = resolveSubmissionRoute({
    originJurisdiction: snapshotAssessment.originJurisdiction,
    destinationCountry: snapshotAssessment.destinationCountry,
    approvedControlEntries: approvedControlEntries(products),
  });

  return {
    snapshotVersion: CONSULTANT_SNAPSHOT_VERSION,
    frozenAt: input.frozenAt,
    reference: snapshotAssessment.reference,
    senderNote: text(input.senderNote),
    expiresAt: input.expiresAt,
    assessment: snapshotAssessment,
    products,
    screenings: input.screenings.map((screening) => ({
      screeningId: String(screening._id),
      subjectType: String(screening.subjectType ?? ""),
      subjectName: String(screening.subjectName ?? ""),
      matchedUniqueId: text(screening.matchedUniqueId),
      score: num(screening.score),
      matchReason: text(screening.matchReason),
      sanctionsVersion: text(screening.sanctionsVersion),
      reviewStatus: String(screening.reviewStatus ?? "pending"),
      createdAt: num(screening.createdAt) ?? input.frozenAt,
    })),
    licences: input.licences.map((licence) => ({
      licenceId: String(licence._id),
      licenceType: String(licence.licenceType ?? "other"),
      applicationRef: text(licence.applicationRef),
      licenceRef: text(licence.licenceRef),
      route: text(licence.route),
      recordedAt: num(licence.recordedAt) ?? input.frozenAt,
    })),
    evidence: input.evidence.map((item) => ({
      evidenceId: String(item._id),
      kind: (item.kind as SnapshotEvidenceKind) ?? "other",
      label: item.label,
      note: text(item.note),
      url: text(item.url),
      fileName: text(item.fileName),
      fileSize: num(item.fileSize),
      hasFile: Boolean(item.storageId && text(item.fileName)),
      addedAt: num(item.addedAt) ?? input.frozenAt,
    })),
    routing,
  };
}

/** Type guard for a value read back out of `assessmentSnapshot`. */
export function isConsultantReviewSnapshot(value: unknown): value is ConsultantReviewSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConsultantReviewSnapshot>;
  return (
    typeof candidate.snapshotVersion === "number" &&
    typeof candidate.frozenAt === "number" &&
    typeof candidate.assessment === "object" &&
    Array.isArray(candidate.products)
  );
}

/**
 * Rebuild the legacy review-page shape from frozen data only.
 *
 * The `_id` aliases keep existing consumers compatible. File links point at
 * the token-gated proxy and are emitted only for evidence that was part of the
 * snapshot when the dispatch was created.
 */
export function renderConsultantReviewSnapshot(
  snapshot: ConsultantReviewSnapshot,
  reviewToken?: string,
) {
  return {
    assessment: {
      ...snapshot.assessment,
      _id: snapshot.assessment.assessmentId,
    },
    products: snapshot.products.map((product) => ({
      ...product,
      _id: product.productId,
    })),
    screenings: snapshot.screenings.map((screening) => ({
      ...screening,
      _id: screening.screeningId,
    })),
    licences: snapshot.licences.map((licence) => ({
      ...licence,
      _id: licence.licenceId,
    })),
    evidence: snapshot.evidence.map((item) => ({
      ...item,
      _id: item.evidenceId,
      downloadUrl: item.hasFile
        ? `/api/export-controls/review-evidence/${reviewToken ?? "session"}/${item.evidenceId}`
        : undefined,
    })),
  };
}
