import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  buildTreRowHash,
  detectTreFormat,
  parseCsvRecords,
  parseTreCsv,
  parseTreCsvRows,
  TRE_IMPORT_MAX_ROWS,
} from "../../src/lib/tre-csv-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, "../../test-evidence/fixtures");

describe("TRE CSV parser", () => {
  const itemFixture = readFileSync(join(fixtures, "tre-sample-import-item-report.csv"), "utf8");
  const headerFixture = readFileSync(join(fixtures, "tre-sample-import-header-report.csv"), "utf8");
  const taxFixture = readFileSync(join(fixtures, "tre-sample-import-tax-lines-report.csv"), "utf8");
  const exportFixture = readFileSync(join(fixtures, "tre-sample-export-item-report.csv"), "utf8");

  it("parses quoted CSV fields with commas", () => {
    const rows = parseCsvRecords('"Entry Number","Commodity Code"\n"26GB1","8517130000"');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ["Entry Number", "Commodity Code"]);
    assert.deepEqual(rows[1], ["26GB1", "8517130000"]);
  });

  it("detects import item report from fixture", () => {
    const preview = parseTreCsv(itemFixture);
    assert.equal(preview.format, "import_item");
    assert.equal(preview.rowCount, 4);
    assert.ok(preview.eoris.includes("GB553202734852"));
    assert.equal(preview.sampleRows[0].goodsDescription, "Smartphone handsets");
    assert.equal(preview.sampleRows[0].countryOfDispatchCode, "NL");
    assert.equal(preview.sampleRows[0].documentCodes, "U110");
  });

  it("detects import header report", () => {
    const preview = parseTreCsv(headerFixture);
    assert.equal(preview.format, "import_header");
    assert.equal(preview.rowCount, 2);
    assert.equal(preview.sampleRows[0].invoiceTotalGbp, 5000);
    assert.equal(preview.sampleRows[0].totalDutyGbp, 325);
  });

  it("detects import tax lines report", () => {
    const preview = parseTreCsv(taxFixture);
    assert.equal(preview.format, "import_tax_lines");
    assert.equal(preview.rowCount, 4);
    assert.equal(preview.sampleRows[0].taxType, "A00");
  });

  it("detects export item report", () => {
    const preview = parseTreCsv(exportFixture);
    assert.equal(preview.format, "export_item");
    assert.equal(preview.rowCount, 2);
    assert.equal(preview.sampleRows[0].destinationCountryCode, "US");
    assert.equal(preview.sampleRows[0].goodsDepartureDate, "2026-05-10");
  });

  it("maps duty and VAT lines separately on item report", () => {
    const rows = parseTreCsvRows(itemFixture);
    const duty = rows.find((r) => r.taxType === "A00" && r.entryIdentifierMrn === "26GB6S62E0DS8MEAR2");
    const vat = rows.find((r) => r.taxType === "B00" && r.entryIdentifierMrn === "26GB6S62E0DS8MEAR2");
    assert.equal(duty?.taxLineTotalAmount, 325);
    assert.equal(vat?.taxLineTotalAmount, 1000);
    assert.equal(duty?.commodityCode, "8517130000");
  });

  it("builds stable row hashes for dedupe", () => {
    const rows = parseTreCsvRows(itemFixture);
    const hashA = rows[0].sourceRowHash;
    const hashB = buildTreRowHash(rows[0]);
    assert.equal(hashA, hashB);
    assert.notEqual(rows[0].sourceRowHash, rows[1].sourceRowHash);
  });

  it("does not deduplicate rows with different preference evidence", () => {
    const base = {
      reportKind: "import_item" as const,
      entryIdentifierMrn: "MRN001",
      itemNumber: "1",
      commodityCode: "8517130000",
      taxType: "A00",
      taxLineTotalAmount: 10,
      preferenceCode: "100",
      documentCodes: "U110",
    };
    const changed = { ...base, preferenceCode: "300", documentCodes: undefined };

    assert.notEqual(buildTreRowHash(base), buildTreRowHash(changed));
  });

  it("rejects storing more than the Convex row cap", () => {
    const header = '"Entry Number","Commodity Code","Country of Origin","Tax Type","Tax LineTotal Amount"\n';
    const line = '"MRN001","1234567890","CN","A00","10.00"\n';
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

  it("detectTreFormat identifies formats from headers", () => {
    assert.equal(
      detectTreFormat(["entry number", "commodity code", "country of origin"]),
      "import_item",
    );
    assert.equal(
      detectTreFormat(["entry number", "invoice total gbp", "total duty"]),
      "import_header",
    );
    assert.equal(
      detectTreFormat(["entry number", "tax type", "tax line total amount"]),
      "import_tax_lines",
    );
    assert.equal(
      detectTreFormat(["entry number", "commodity code", "goods departure date"]),
      "export_item",
    );
  });
});
