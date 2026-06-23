#!/usr/bin/env node
/**
 * Quick local check: parse the TRE fixture and print a preview summary.
 * Usage: node test-evidence/verify-tre-parser.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTreCsv } from "../src/lib/tre-csv-parser.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  join(__dirname, "fixtures/tre-sample-import-item-report.csv"),
  "utf8",
);

const preview = parseTreCsv(fixture);
console.log(JSON.stringify(preview, null, 2));
