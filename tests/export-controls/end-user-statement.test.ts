import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanctionsOneLiner } from "../../src/lib/export-controls/sanctions-summary";
import { endUserStatementPrintableHtml } from "../../src/lib/export-controls/end-user-statement";

describe("sanctionsOneLiner", () => {
  it("reports when screening not run", () => {
    assert.match(sanctionsOneLiner([]), /not run/);
  });

  it("flags confirmed matches", () => {
    assert.match(sanctionsOneLiner([{ reviewStatus: "confirmed", score: 0.9 }]), /confirmed/);
  });

  it("reports clear when dismissed only", () => {
    assert.match(sanctionsOneLiner([{ reviewStatus: "dismissed", score: 0.7 }]), /No sanctions matches/);
  });
});

describe("endUserStatementPrintableHtml", () => {
  it("includes assessment reference and undertakings", () => {
    const html = endUserStatementPrintableHtml({
      assessmentReference: "EXP-001",
      destinationCountry: "DE",
      products: [{ name: "Sensor module", quantity: 2 }],
      endUserName: "Acme GmbH",
      endUserAddress: "Berlin",
      endUserCountry: "DE",
      contactName: "Jane Doe",
      intendedUse: "Industrial measurement",
      signedBy: "Jane Doe",
      signedAt: Date.UTC(2026, 6, 9),
    });
    assert.match(html, /EXP-001/);
    assert.match(html, /Acme GmbH/);
    assert.match(html, /prohibited end use/);
  });
});
