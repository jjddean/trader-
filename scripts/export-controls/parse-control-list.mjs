#!/usr/bin/env node
/**
 * Parse UK export control list PDF → versioned JSON in data/export-controls/
 *
 * Usage:
 *   node scripts/export-controls/parse-control-list.mjs
 *   node scripts/export-controls/parse-control-list.mjs --pdf path/to/list.pdf --out data/export-controls/v2025-12-16.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import {
  parseControlListPages,
  buildControlListDataset,
  verifyGoldenEntries,
  GOLDEN_ENTRY_CODES,
} from "./lib/control-list-parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DEFAULT_PDF = path.join(
  ROOT,
  "docs/export-controls/sources/uk_export_control_list_2025-12-16.pdf",
);
const DEFAULT_OUT = path.join(ROOT, "data/export-controls/v2025-12-16.json");
const VERSION = "2025-12-16";

function parseArgs() {
  const args = process.argv.slice(2);
  let pdf = DEFAULT_PDF;
  let out = DEFAULT_OUT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pdf" && args[i + 1]) pdf = path.resolve(args[++i]);
    if (args[i] === "--out" && args[i + 1]) out = path.resolve(args[++i]);
  }

  return { pdf, out };
}

async function main() {
  const { pdf, out } = parseArgs();

  if (!fs.existsSync(pdf)) {
    console.error(`PDF not found: ${pdf}`);
    process.exit(1);
  }

  console.log(`Parsing: ${pdf}`);
  const pdfBuffer = fs.readFileSync(pdf);
  const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  const parser = new PDFParse({ data: pdfBuffer });
  const textResult = await parser.getText();
  await parser.destroy();

  console.log(`Pages: ${textResult.pages.length}, chars: ${textResult.text.length}`);

  const entries = parseControlListPages(textResult.pages);
  const dataset = buildControlListDataset(entries, {
    version: VERSION,
    sourceHash: sha256,
  });
  dataset.sourceHash = sha256;

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(dataset, null, 2));

  const goldenCodes = GOLDEN_ENTRY_CODES.filter((c) => !c.includes("."));
  const verification = verifyGoldenEntries(entries, goldenCodes);
  const failed = verification.filter((r) => !r.ok);

  console.log(`\n✅ Wrote ${entries.length} entries → ${out}`);
  console.log(`   SHA-256: ${sha256.slice(0, 16)}…`);
  console.log(
    `   By type: military=${entries.filter((e) => e.entryType === "military").length}, dual_use=${entries.filter((e) => e.entryType === "dual_use").length}, firearms=${entries.filter((e) => e.entryType === "firearms").length}, radioactive=${entries.filter((e) => e.entryType === "radioactive").length}`,
  );

  if (failed.length > 0) {
    console.warn("\n⚠️  Golden entry checks failed:");
    for (const f of failed) console.warn(`   - ${f.code}: ${f.reason}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✅ Golden entries verified (${goldenCodes.length} codes)`);
  }

  // Spot-check threshold text preservation
  const fiveA002 = entries.find((e) => e.entryCode === "5A002");
  if (fiveA002 && !fiveA002.fullText.toLowerCase().includes("information security")) {
    console.warn("⚠️  5A002 missing expected 'information security' text");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
