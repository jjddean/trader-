import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDraftPackBundle, draftPackPrintableHtml } from "../../src/lib/export-controls/draft-pack.ts";

describe("buildDraftPackBundle", () => {
  it("flags missing mandatory fields and routes to LITE by default", () => {
    const bundle = buildDraftPackBundle({
      assessment: {
        reference: "EC-2026-00001",
        destinationCountry: "US",
        originJurisdiction: "GB",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      products: [
        {
          name: "Test widget",
          techDescription: "Dual-use test item",
          classificationRuns: [
            { requiresReview: false, finalControlEntry: "3A001", createdAt: Date.now() },
          ],
        },
      ],
      screenings: [],
      licences: [],
    });

    assert.ok(bundle.missingMandatory.includes("Consignee"));
    assert.equal(bundle.routing.route, "lite");
    assert.equal(bundle.fields.find((f) => f.id === "product_0_control_entry")?.value, "3A001");
  });

  it("marks timeline submitted when application ref recorded", () => {
    const now = Date.now();
    const bundle = buildDraftPackBundle({
      assessment: {
        reference: "EC-2026-00002",
        destinationCountry: "RU",
        consignee: { name: "Acme GmbH", address: "Berlin", country: "DE" },
        endUser: { name: "Acme GmbH", address: "Berlin", country: "DE" },
        intendedUse: "Industrial telemetry",
        createdAt: now,
        updatedAt: now,
      },
      products: [
        {
          name: "Gateway",
          quantity: 2,
          valueGbp: 1200,
          classificationRuns: [{ requiresReview: false, finalControlEntry: "5A002", createdAt: now }],
        },
      ],
      screenings: [{ subjectType: "consignee", subjectName: "Acme", reviewStatus: "dismissed", createdAt: now }],
      licences: [{ licenceType: "siel", applicationRef: "APP-123", recordedAt: now }],
    });

    assert.equal(bundle.routing.route, "spire");
    const submitted = bundle.timeline.find((s) => s.id === "submitted");
    assert.equal(submitted?.status, "done");
    assert.equal(bundle.missingMandatory.length, 0);
  });

  it("generates printable HTML with assessment reference", () => {
    const bundle = buildDraftPackBundle({
      assessment: {
        reference: "EC-2026-PRINT",
        destinationCountry: "DE",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      products: [],
      screenings: [],
      licences: [],
    });
    const html = draftPackPrintableHtml(bundle);
    assert.ok(html.includes("EC-2026-PRINT"));
    assert.ok(html.includes("Export control draft pack"));
  });
});
