import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsultantReviewSnapshot,
  isConsultantReviewSnapshot,
  approvedControlEntries,
} from "../../convex/lib/consultant_review_snapshot";
import { licenceTypeForRoute } from "../../convex/lib/export_routing";
import {
  selectConsultantDispatch,
  dispatchIsOpen,
  CONSULTANT_DISPATCH_REASON,
} from "../../convex/compliance_consultant";
import { buildPartnerSubjectLabel } from "../../convex/lib/consultant_partner_outbox";

const FROZEN_AT = 1_760_000_000_000;
const EXPIRES_AT = FROZEN_AT + 14 * 24 * 60 * 60 * 1000;

function sourceAssessment(overrides: Record<string, unknown> = {}) {
  return {
    _id: "as_1",
    reference: "EC-2026-10001",
    status: "review_required",
    originJurisdiction: "GB",
    destinationCountry: "TR",
    consignee: { name: "Aselsan Ltd", address: "Ankara", country: "TR" },
    endUser: { name: "MoD Turkey", address: "Ankara", country: "TR" },
    intendedUse: "Ground surveillance",
    controlListVersion: "2026-06",
    sanctionsVersion: "2026-08-01",
    createdAt: FROZEN_AT - 5000,
    updatedAt: FROZEN_AT - 1000,
    ...overrides,
  };
}

function sourceProducts() {
  return [
    {
      _id: "pr_1",
      name: "Thermal imaging module",
      manufacturer: "Acme",
      modelNo: "TIM-9",
      quantity: 4,
      valueGbp: 18500,
      techDescription: "Uncooled microbolometer, 640x480",
      specs: [{ key: "resolution", valueRaw: "640x480" }],
      classificationRuns: [
        { requiresReview: false, finalControlEntry: "6A003", createdAt: FROZEN_AT - 2000 },
        { requiresReview: true, finalControlEntry: "6A993", createdAt: FROZEN_AT - 9000 },
      ],
    },
  ];
}

function buildFixture(overrides: Record<string, unknown> = {}) {
  return buildConsultantReviewSnapshot({
    assessment: sourceAssessment(overrides),
    products: sourceProducts() as never,
    screenings: [
      {
        _id: "sc_1",
        subjectType: "end_user",
        subjectName: "MoD Turkey",
        reviewStatus: "pending",
        score: 0.71,
        createdAt: FROZEN_AT - 3000,
      },
    ],
    licences: [],
    evidence: [
      {
        _id: "ev_1",
        kind: "datasheet",
        label: "TIM-9 datasheet",
        storageId: "storage_1",
        fileName: "tim9.pdf",
        fileSize: 40_000,
        addedAt: FROZEN_AT - 4000,
      },
    ] as never,
    senderNote: "Please check 6A003 against the cooled/uncooled distinction.",
    frozenAt: FROZEN_AT,
    expiresAt: EXPIRES_AT,
  });
}

describe("consultant review snapshot", () => {
  it("captures everything the consultant form renders", () => {
    const snapshot = buildFixture();

    assert.equal(snapshot.reference, "EC-2026-10001");
    assert.equal(snapshot.assessment.destinationCountry, "TR");
    assert.equal(snapshot.assessment.consignee?.name, "Aselsan Ltd");
    assert.equal(snapshot.assessment.endUser?.country, "TR");
    assert.equal(snapshot.assessment.intendedUse, "Ground surveillance");
    assert.equal(snapshot.products.length, 1);
    assert.equal(snapshot.screenings.length, 1);
    assert.equal(snapshot.evidence.length, 1);
    assert.equal(snapshot.expiresAt, EXPIRES_AT);
    assert.ok(isConsultantReviewSnapshot(snapshot));
  });

  it("orders classification runs newest first so the draft pack reads the current one", () => {
    const snapshot = buildFixture();
    assert.equal(snapshot.products[0].classificationRuns[0].finalControlEntry, "6A003");
    assert.equal(snapshot.products[0].classificationRuns[0].requiresReview, false);
  });

  /**
   * The defect this exists to prevent: a snapshot that aliases live documents
   * changes underneath a consultant while they are reading it.
   */
  it("does not change when the source assessment is edited afterwards", () => {
    const assessment = sourceAssessment();
    const products = sourceProducts();

    const snapshot = buildConsultantReviewSnapshot({
      assessment,
      products: products as never,
      screenings: [],
      licences: [],
      evidence: [],
      frozenAt: FROZEN_AT,
      expiresAt: EXPIRES_AT,
    });
    const before = JSON.stringify(snapshot);

    // Exporter edits the assessment after dispatch.
    (assessment.consignee as Record<string, unknown>).name = "Someone Else Ltd";
    assessment.destinationCountry = "RU";
    assessment.intendedUse = "Changed after review was requested";
    products[0].quantity = 999;
    products[0].classificationRuns[0].finalControlEntry = "TAMPERED";

    assert.equal(JSON.stringify(snapshot), before);
    assert.equal(snapshot.assessment.consignee?.name, "Aselsan Ltd");
    assert.equal(snapshot.assessment.destinationCountry, "TR");
    assert.equal(snapshot.products[0].quantity, 4);
    assert.equal(snapshot.products[0].classificationRuns[0].finalControlEntry, "6A003");
  });

  it("freezes routing from the frozen inputs", () => {
    const snapshot = buildFixture();
    assert.equal(snapshot.routing.route, "lite");

    const sanctioned = buildFixture({ destinationCountry: "RU" });
    assert.equal(sanctioned.routing.route, "spire");
  });

  it("counts only approved classifications as control entries", () => {
    const snapshot = buildFixture();
    assert.deepEqual(approvedControlEntries(snapshot.products), ["6A003"]);
  });

  /** Evidence travels as metadata. A storage URL must never be frozen into it. */
  it("carries evidence metadata but no download URL", () => {
    const snapshot = buildFixture();
    const item = snapshot.evidence[0];
    assert.equal(item.evidenceId, "ev_1");
    assert.equal(item.fileName, "tim9.pdf");
    assert.equal(item.hasFile, true);
    assert.equal("downloadUrl" in item, false);
    // Only the frozen routing may hold a URL, and those are public GOV.UK
    // guidance links. No evidence row may carry a storage URL.
    assert.equal(JSON.stringify(snapshot.evidence).includes("http"), false);
  });
});

describe("licence type derived from route", () => {
  it("maps LITE to SIEL", () => {
    assert.equal(licenceTypeForRoute("lite"), "siel");
  });

  it("maps OTSI to the OTSI licence type", () => {
    assert.equal(licenceTypeForRoute("otsi"), "otsi");
  });

  /**
   * The defect: sign-off hardcoded "siel", so a sanctioned-destination SPIRE
   * case recorded a SIEL that was never applied for.
   */
  it("does not claim SIEL for SPIRE or undecided routes", () => {
    assert.equal(licenceTypeForRoute("spire"), "other");
    assert.equal(licenceTypeForRoute("none"), "other");
  });
});

describe("consultant dispatch selection", () => {
  interface RequestRow {
    reasonCode: string;
    createdAt: number;
    completedAt?: number;
    _creationTime?: number;
  }

  const dispatch = (over: Partial<RequestRow> = {}): RequestRow => ({
    reasonCode: CONSULTANT_DISPATCH_REASON,
    createdAt: 100,
    ...over,
  });

  it("ignores expert_requests rows that are not consultant dispatches", () => {
    const selected = selectConsultantDispatch<RequestRow>([
      { reasonCode: "internal_flag", createdAt: 500 },
      dispatch({ createdAt: 100, completedAt: 200 }),
    ]);
    assert.equal(selected?.reasonCode, CONSULTANT_DISPATCH_REASON);
  });

  /**
   * The defect: a later unrelated expert_requests row displaced the completed
   * consultant review, so the card showed "pending" after sign-off.
   */
  it("keeps a completed review visible when a newer request exists", () => {
    const completed = dispatch({ createdAt: 100, completedAt: 150 });
    const selected = selectConsultantDispatch<RequestRow>([
      { reasonCode: "sanctions_review", createdAt: 900 },
      completed,
    ]);
    assert.equal(selected, completed);
    assert.equal(selected?.completedAt, 150);
  });

  it("selects the newest consultant dispatch even when an older one completed", () => {
    const older = dispatch({ createdAt: 100, completedAt: 150 });
    const newer = dispatch({ createdAt: 300 });
    assert.equal(selectConsultantDispatch<RequestRow>([older, newer]), newer);
  });

  it("uses database creation time when application timestamps tie", () => {
    const older = dispatch({ createdAt: 100, _creationTime: 101 });
    const newer = dispatch({ createdAt: 100, _creationTime: 102 });
    assert.equal(selectConsultantDispatch<RequestRow>([older, newer]), newer);
  });

  it("returns null when no dispatch exists", () => {
    assert.equal(selectConsultantDispatch<RequestRow>([{ reasonCode: "other", createdAt: 1 }]), null);
  });
});

describe("dispatch validity", () => {
  const now = 1_000;

  it("is open while pending and unexpired", () => {
    assert.equal(dispatchIsOpen({ expiresAt: now + 1 }, now), true);
  });

  it("closes on completion, revocation and expiry", () => {
    assert.equal(dispatchIsOpen({ completedAt: 5 }, now), false);
    assert.equal(dispatchIsOpen({ revokedAt: 5 }, now), false);
    assert.equal(dispatchIsOpen({ expiresAt: now }, now), false);
    assert.equal(dispatchIsOpen({ deliveryStatus: "revoked" }, now), false);
    assert.equal(dispatchIsOpen({ deliveryStatus: "expired" }, now), false);
  });
});

describe("partner subject label", () => {
  /**
   * The label is the only free text that reaches a partner inbox, so it must
   * never carry goods, parties or values. Built from the frozen snapshot, so
   * the assertions run against the same input the outbox uses.
   */
  it("describes the case without naming goods or parties", () => {
    const label = buildPartnerSubjectLabel(buildFixture());

    assert.equal(label, "Controlled goods · 1 item · destination TR");
    assert.equal(label.includes("Aselsan"), false);
    assert.equal(label.includes("Thermal"), false);
    assert.equal(label.includes("18500"), false);
  });

  it("omits destination when unknown", () => {
    const label = buildPartnerSubjectLabel({
      ...buildFixture({ destinationCountry: undefined }),
      products: [],
    });
    assert.equal(label, "Export assessment · 0 items");
  });
});
