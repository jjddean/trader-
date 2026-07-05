import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractUnitFacts, normaliseUnitValue } from "../../src/lib/export-controls/units";
import { validateExportExtraction } from "../../src/lib/export-controls/extraction";
import { runDocumentAudit } from "../../src/lib/export-controls/document-audit";
import { sanitizeDocumentText } from "../../src/lib/export-controls/sanitize";

describe("export-controls units", () => {
  it("extracts GHz and normalises frequency", () => {
    const facts = extractUnitFacts("Operating frequency 2.4 GHz band");
    assert.ok(facts.some((f) => f.key === "frequency" && f.unit === "GHz"));
    assert.equal(normaliseUnitValue(2.4, "GHz", "frequency"), 2.4e9);
  });

  it("extracts power in mW", () => {
    const facts = extractUnitFacts("Peak output 100 mW");
    assert.ok(facts.some((f) => f.key === "power"));
  });
});

describe("export extraction validation", () => {
  it("parses minimal product payload", () => {
    const result = validateExportExtraction({
      document_summary: {},
      shipment: { consignee: {}, end_user: {} },
      products: [{
        product_name: "Industrial gateway",
        technical_description: "Encrypted gateway module",
        specs: [{ key: "frequency", value_raw: "2.4 GHz", unit: "GHz", source_quote: "2.4 GHz", confidence: 0.9 }],
      }],
    });
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0].productName, "Industrial gateway");
  });
});

describe("document audit heuristics", () => {
  it("flags dual-use keywords", () => {
    const audit = runDocumentAudit(
      "Commercial invoice for encryption software module shipped to UAE. Consignee: Acme Ltd. End user: research lab.",
      "commercial_invoice",
    );
    assert.equal(audit.status, "flagged");
    assert.ok(audit.riskChecklist.some((r) => r.type === "export_control"));
  });

  it("passes clean sample with parties", () => {
    const text = sanitizeDocumentText(
      "Commercial Invoice. Consignee: UK Logistics Ltd. End user: UK Logistics Ltd. Intended use: resale. Destination: United Kingdom. Description: Office chairs. Total value 500 GBP.",
    );
    const audit = runDocumentAudit(text, "commercial_invoice");
    assert.equal(audit.status, "passed");
  });
});
