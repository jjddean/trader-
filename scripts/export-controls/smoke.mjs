#!/usr/bin/env node
/**
 * Export-controls smoke checks — no Groq/AWS required.
 * Run: npm run export-controls:smoke
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadJson(relativePath) {
  const full = path.join(root, relativePath);
  if (!existsSync(full)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return JSON.parse(readFileSync(full, "utf8"));
}

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, message });
    console.error(`  ✗ ${name}: ${message}`);
  }
}

console.log("Export-controls smoke checks\n");

check("Control list JSON present (480 entries)", () => {
  const data = loadJson("data/export-controls/v2025-12-16.json");
  if (data.entryCount !== 480) throw new Error(`expected 480 entries, got ${data.entryCount}`);
  if (!Array.isArray(data.entries) || data.entries.length !== 480) {
    throw new Error(`entries array length ${data.entries?.length}`);
  }
  const ml1 = data.entries.find((e) => e.entryCode === "ML1");
  if (!ml1) throw new Error("golden entry ML1 missing");
});

check("UK Sanctions List JSON present (6,263 designations)", () => {
  const data = loadJson("data/export-controls/sanctions-2026-06-26.json");
  if (data.entityCount !== 6263) throw new Error(`expected 6263, got ${data.entityCount}`);
  if (!Array.isArray(data.entities) || data.entities.length !== 6263) {
    throw new Error(`entities array length ${data.entities?.length}`);
  }
  const afg = data.entities.find((e) => e.uniqueId === "AFG0001");
  if (!afg) throw new Error("golden designation AFG0001 missing");
});

check("Control list source PDF present", () => {
  const pdf = path.join(root, "docs/export-controls/sources/uk_export_control_list_2025-12-16.pdf");
  if (!existsSync(pdf)) throw new Error("PDF not found");
});

check("API route files exist", () => {
  for (const rel of [
    "src/app/api/export-controls/audit/route.ts",
    "src/app/api/export-controls/extract/route.ts",
    "src/app/api/export-controls/classify/route.ts",
    "src/app/api/export-controls/screen/route.ts",
  ]) {
    if (!existsSync(path.join(root, rel))) throw new Error(`missing ${rel}`);
  }
});

check("UI panels exist", () => {
  for (const rel of [
    "src/components/trade-compliance/document-audit-panel.tsx",
    "src/components/trade-compliance/export-classification-panel.tsx",
    "src/components/trade-compliance/export-sanctions-panel.tsx",
  ]) {
    if (!existsSync(path.join(root, rel))) throw new Error(`missing ${rel}`);
  }
});

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} smoke checks passed`);

if (failed.length > 0) {
  process.exit(1);
}
