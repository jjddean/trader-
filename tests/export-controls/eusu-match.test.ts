import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareEusuToProducts,
  type EusuItemLineInput,
  type ProductLineInput,
} from "../../src/lib/export-controls/eusu-match";

function product(overrides: Partial<ProductLineInput> & { name: string }): ProductLineInput {
  return { ...overrides };
}

function item(description: string, quantity?: string): EusuItemLineInput {
  return { description, quantity };
}

describe("compareEusuToProducts", () => {
  it("returns no findings when lists match", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Thermal imaging camera", quantity: 5 })],
      [item("Thermal imaging camera", "5")],
    );
    assert.deepEqual(findings, []);
  });

  it("returns no findings when the EUSU has no goods table (legacy statement)", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Radar module", quantity: 2 })],
      [],
    );
    assert.deepEqual(findings, []);
  });

  it("flags a product missing from the undertaking", () => {
    const findings = compareEusuToProducts(
      [
        product({ name: "Thermal imaging camera", quantity: 5 }),
        product({ name: "Laser rangefinder", quantity: 1 }),
      ],
      [item("Thermal imaging camera", "5")],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "missing_on_eusu");
    assert.equal(findings[0].severity, "warning");
    assert.match(findings[0].message, /Laser rangefinder/);
  });

  it("flags an undertaking line not on the application", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Thermal imaging camera", quantity: 5 })],
      [item("Thermal imaging camera", "5"), item("Night vision goggles", "3")],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "extra_on_eusu");
    assert.match(findings[0].message, /Night vision goggles/);
  });

  it("flags a quantity mismatch on a matched line", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Thermal imaging camera", quantity: 5 })],
      [item("Thermal imaging camera", "3 units")],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "quantity_mismatch");
    assert.match(findings[0].message, /application has 5/);
    assert.match(findings[0].message, /undertaking has 3/);
  });

  it("does not flag quantity when either side omits it", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Thermal imaging camera" })],
      [item("Thermal imaging camera", "3")],
    );
    assert.deepEqual(findings, []);
  });

  it("matches by model number even when descriptions differ", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Camera", modelNo: "TX-900", quantity: 2 })],
      [item("Imaging unit TX-900 with mounting kit", "2")],
    );
    assert.deepEqual(findings, []);
  });

  it("matches case- and punctuation-insensitively", () => {
    const findings = compareEusuToProducts(
      [product({ name: "Thermal Imaging Camera", quantity: 1 })],
      [item("THERMAL-IMAGING camera.", "1")],
    );
    assert.deepEqual(findings, []);
  });

  it("reports order differences as info", () => {
    const findings = compareEusuToProducts(
      [
        product({ name: "Thermal imaging camera", quantity: 5 }),
        product({ name: "Laser rangefinder", quantity: 1 }),
      ],
      [item("Laser rangefinder", "1"), item("Thermal imaging camera", "5")],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "order_mismatch");
    assert.equal(findings[0].severity, "info");
  });

  it("does not double-claim one undertaking line for two products", () => {
    const findings = compareEusuToProducts(
      [
        product({ name: "Thermal imaging camera", quantity: 5 }),
        product({ name: "Thermal imaging camera", quantity: 5 }),
      ],
      [item("Thermal imaging camera", "5")],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "missing_on_eusu");
  });
});
