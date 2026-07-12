#!/usr/bin/env node
/**
 * Fetch UK Sanctions List XML → slim normalized JSON.
 *
 * Usage:
 *   node scripts/export-controls/ingest-sanctions-list.mjs
 *   node scripts/export-controls/ingest-sanctions-list.mjs --out data/export-controls/sanctions-2026-06-26.json
 *   node scripts/export-controls/ingest-sanctions-list.mjs --file cached.xml
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";
import {
  parseSanctionsXml,
  summariseDataset,
  GOLDEN_UNIQUE_IDS,
} from "./lib/sanctions-list-parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const UKSL_XML_URL = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml";

function parseArgs() {
  const args = process.argv.slice(2);
  let out = null;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) out = path.resolve(args[++i]);
    if (args[i] === "--file" && args[i + 1]) file = path.resolve(args[++i]);
  }

  return { out, file };
}

async function loadXml(file) {
  if (file) {
    console.log(`Reading cached XML: ${file}`);
    return fs.readFileSync(file, "utf8");
  }

  console.log(`Fetching: ${UKSL_XML_URL}`);
  const res = await fetch(UKSL_XML_URL);
  if (!res.ok) throw new Error(`UKSL fetch failed: ${res.status} ${res.statusText}`);
  return await res.text();
}

async function main() {
  const { out, file } = parseArgs();
  const xmlText = await loadXml(file);
  const sourceHash = crypto.createHash("sha256").update(xmlText).digest("hex");

  const parser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
    isArray: (name) =>
      name === "Designation" ||
      name === "Name" ||
      name === "NonLatinName" ||
      name === "Address" ||
      name === "DOB" ||
      name === "Passport" ||
      name === "IMONumber" ||
      name === "BusinessRegistrationNumber",
  });

  const parsed = parser.parse(xmlText);
  const dataset = parseSanctionsXml(parsed);
  dataset.sourceHash = sourceHash;
  dataset.parsedAt = new Date().toISOString();

  const version = dataset.dateGenerated || new Date().toISOString().slice(0, 10);
  const outputPath =
    out ?? path.join(ROOT, "data/export-controls", `sanctions-${version}.json`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

  const summary = summariseDataset(dataset);
  const jsonBytes = fs.statSync(outputPath).size;

  console.log(`\n✅ Wrote ${dataset.entityCount} designations → ${outputPath}`);
  console.log(`   Date generated: ${dataset.dateGenerated}`);
  console.log(`   JSON size: ${(jsonBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   SHA-256 (XML): ${sourceHash.slice(0, 16)}…`);
  console.log(
    `   Types: individual=${summary.byType.individual}, entity=${summary.byType.entity}, ship=${summary.byType.ship}`,
  );
  console.log(
    `   Screening fields: asset_freeze=${summary.withAssetFreeze}, aliases=${summary.withAliases}, identifiers=${summary.withIdentifiers}`,
  );

  const byId = new Map(dataset.entities.map((e) => [e.uniqueId, e]));
  const failed = GOLDEN_UNIQUE_IDS.filter((id) => !byId.has(id));
  if (failed.length > 0) {
    console.warn(`\n⚠️  Golden IDs missing: ${failed.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✅ Golden IDs present: ${GOLDEN_UNIQUE_IDS.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
