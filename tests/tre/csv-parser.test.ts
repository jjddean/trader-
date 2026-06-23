import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  buildTreRowHash,
  parseCsvRecords,
  parseTreCsv,
  parseTreCsvRows,
  TRE_IMPORT_MAX_ROWS,
} from "../../src/lib/tre-csv-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../../test-evidence/fixtures/tre-sample-import-item-report.csv");

describe("TRE CSV parser", () => {
  const fixture = readFileSync(fixturePath, "utf8");

  it("parses quoted CSV fields with commas", () => {
    const rows = parseCsvRecords('"Entry Number","Commodity Code"\n"26GB1","8517130000"');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ["Entry Number", "Commodity Code"]);
    assert.deepEqual(rows[1], ["26GB1", "8517130000"]);
  });

  it("detects item report format from fixture", () => {
    const preview = parseTreCsv(fixture);
    assert.equal(preview.format, "item_report");
    assert.equal(preview.rowCount, 4);
    assert.equal(preview.storedRowCount, 4);
    assert.ok(preview.eoris.includes("GB553202734852"));
    assert.equal(preview.sampleRows.length, 4);
  });

  it("maps duty and VAT lines separately", () => {
    const rows = parseTreCsvRows(fixture);
    const duty = rows.find((r) => r.taxType === "A00" && r.entryIdentifierMrn === "26GB6S62E0DS8MEAR2");
    const vat = rows.find((r) => r.taxType === "B00" && r.entryIdentifierMrn === "26GB6S62E0DS8MEAR2");
    assert.equal(duty?.taxLineTotalAmount, 325);
    assert.equal(vat?.taxLineTotalAmount, 1000);
    assert.equal(duty?.commodityCode, "8517130000");
  });

  it("builds stable row hashes for dedupe", () => {
    const rows = parseTreCsvRows(fixture);
    const hashA = rows[0].sourceRowHash;
    const hashB = buildTreRowHash(rows[0]);
    assert.equal(hashA, hashB);
    assert.notEqual(rows[0].sourceRowHash, rows[1].sourceRowHash);
  });

  it("rejects storing more than the Convex row cap", () => {
    const header = '"Entry Number","Commodity Code","Country of Origin","Tax Type","Tax LineTotal Amount"\n';
    const line =
      '"MRN001","1234567890","CN","A00","10.00"\n';
    const huge = header + line.repeat(TRE_IMPORT_MAX_ROWS + 5);
    const preview = parseTreCsv(huge);
    assert.equal(preview.truncated, true);
    assert.equal(preview.storedRowCount, TRE_IMPORT_MAX_ROWS);
    assert.ok(preview.warnings.some((w) => w.message.includes(String(TRE_IMPORT_MAX_ROWS))));
  });

  it("warns on unknown format", () => {
    const preview = parseTreCsv("foo,bar\n1,2");
    assert.equal(preview.format, "unknown");
    assert.ok(preview.warnings.length > 0);
  });
});
