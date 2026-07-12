import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const root = process.cwd();
const pilot = JSON.parse(fs.readFileSync(`${root}/data/export-controls/candidates/gb-dualuse-pilot-6a003.json`, "utf8"));
const manifest = JSON.parse(fs.readFileSync(`${root}/data/export-controls/candidates/pilot-source-archive-manifest.json`, "utf8"));

const normalize = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ")
  .replace(/&micro;|µ|μ/g, "u")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

test("every pilot manufacturer source is archived with its recorded hash", () => {
  for (const archived of manifest.records) {
    const bytes = fs.readFileSync(`${root}/${archived.archivePath}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex").toUpperCase(), archived.sha256);
  }
});

test("SIMX decisive quotations occur in the archived manufacturer page", () => {
  const record = pilot.records.find((item: { recordId: string }) => item.recordId === "gb-dualuse-0001");
  const source = normalize(fs.readFileSync(`${root}/${manifest.records[0].archivePath}`, "utf8"));
  for (const quotation of record.evidenceQuotes) assert.ok(source.includes(normalize(quotation)), quotation);
});

test("SIR3 quotations occur in the archived current manufacturer brochure", () => {
  const record = pilot.records.find((item: { recordId: string }) => item.recordId === "gb-dualuse-0003");
  const source = normalize(fs.readFileSync(`${root}/${manifest.records[2].extractedTextPath}`, "utf8"));
  for (const quotation of record.evidenceQuotes) assert.ok(source.includes(normalize(quotation)), quotation);
});

test("the unavailable SIR3 URL is preserved rather than silently replaced", () => {
  const record = pilot.records.find((item: { recordId: string }) => item.recordId === "gb-dualuse-0003");
  const archived = manifest.records.find((item: { recordId: string }) => item.recordId === record.recordId);
  assert.equal(record.sourceUrl, archived.originalSourceUrl);
  assert.equal(archived.originalSourceStatus, "HTTP_404_ON_2026-07-11");
  assert.ok(archived.successorSourceUrl);
});
