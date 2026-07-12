import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import {
  parseControlListPages,
  verifyGoldenEntries,
  GOLDEN_ENTRY_CODES,
} from "../../scripts/export-controls/lib/control-list-parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(
  __dirname,
  "../../docs/export-controls/sources/uk_export_control_list_2025-12-16.pdf",
);

describe("UK control list PDF parser", () => {
  it("parses golden entries with intact threshold text", async () => {
    if (!fs.existsSync(PDF_PATH)) {
      console.warn("Skipping: PDF not found at", PDF_PATH);
      return;
    }

    const buf = fs.readFileSync(PDF_PATH);
    const parser = new PDFParse({ data: buf });
    const textResult = await parser.getText();
    await parser.destroy();

    const entries = parseControlListPages(textResult.pages);
    assert.ok(entries.length >= 400, `expected ≥400 entries, got ${entries.length}`);

    const topLevelGolden = GOLDEN_ENTRY_CODES.filter((c) => !c.includes("."));
    const results = verifyGoldenEntries(entries, topLevelGolden);
    const failed = results.filter((r) => !r.ok);
    assert.equal(
      failed.length,
      0,
      `golden entries failed: ${failed.map((f) => `${f.code} (${f.reason})`).join(", ")}`,
    );

    const ml1 = entries.find((e) => e.entryCode === "ML1");
    assert.ok(ml1?.fullText.includes("Smooth-bore weapons"));
    assert.ok(ml1?.exclusions.length > 0 || ml1?.notes.length > 0);

    const fiveA002 = entries.find((e) => e.entryCode === "5A002");
    assert.ok(fiveA002?.title.toLowerCase().includes("information security"));
    assert.ok(fiveA002?.chunks.length >= 2, "5A002 should have clause chunks");

    const threeA001 = entries.find((e) => e.entryCode === "3A001");
    assert.ok(threeA001?.fullText.length > 200);

    const spireEntry = entries.find((e) => e.entryCode === "2D352");
    assert.ok(spireEntry, "SPIRE-exception entry 2D352 must parse");
  });
});
