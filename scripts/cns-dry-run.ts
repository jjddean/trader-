/**
 * Offline CNS dry run.
 *
 * Runs the real mapper, renderer and CNS pre-send assertions against a stored
 * declaration and prints the XML that WOULD be sent. Makes no network call of
 * any kind — no CNS, no HMRC.
 *
 * Usage:
 *   npx convex run cns_euat_fixtures:getDeclarationForDryRun '{"declarationId":"<id>"}' > dry-run.json
 *   npx tsx scripts/cns-dry-run.ts dry-run.json
 */

import { readFileSync } from "node:fs";

import { mapToCDS_H1 } from "../src/lib/wco-mapper";
import { renderH1Xml, validateXmlPreflight } from "../src/lib/h1-xml-renderer";
import {
  assertInventoryFieldsPresent,
  assertNoGoodsPresentation,
  compareAgainstInventoryFixture,
} from "../src/lib/cns/inventory-xml";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/cns-dry-run.ts <declaration.json>");
  process.exit(1);
}

const { lane, items } = JSON.parse(readFileSync(path, "utf8")) as {
  lane: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
};

const ucn = String(lane.cnsUcn ?? "");
const goodsLocation = String(lane.locationId ?? "");

console.log("Declaration :", lane._id);
console.log("EORI        :", lane.eori);
console.log("Location    :", goodsLocation);
console.log("UCN         :", ucn || "(none)");
console.log("Container   :", lane.containerNumber ?? "(none)");
console.log("Items       :", items.length);
console.log("");

const payload = mapToCDS_H1(lane, items, ucn ? { cnsUcn: ucn } : {});
const xml = renderH1Xml(payload);

// Same gates the transport applies before anything leaves the building.
const checks: Array<[string, () => void]> = [
  ["No Goods Presentation (GPR)", () => assertNoGoodsPresentation(xml)],
  ["Inventory reference + location present", () => assertInventoryFieldsPresent(xml, ucn, goodsLocation)],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error instanceof Error ? error.message : String(error)}`);
  }
}

const preflight = validateXmlPreflight(xml, String(lane.eori ?? ""), {
  requireAdditionalDocument: true,
});
console.log(
  preflight.valid
    ? "  PASS  XML preflight"
    : `  FAIL  XML preflight — ${preflight.failed.join(", ")}`,
);
if (!preflight.valid) failed += 1;

// Consignment data the CSP inventory pre-check compares. Warnings only — CNS is
// the authority on what matches, and a false block here would be worse than a
// pre-check rejection.
const first = items[0] ?? {};
const warnings = compareAgainstInventoryFixture(
  {
    containerNumber: String(lane.containerNumber ?? ""),
    packageQuantity: Number(first.packageCount ?? NaN),
    grossWeightKg: Number(first.grossWeightKg ?? NaN),
  },
  {
    ucn,
    containerNumber: String(process.env.FIXTURE_CONTAINER ?? lane.containerNumber ?? ""),
    packageQuantity: Number(process.env.FIXTURE_PACKAGES ?? first.packageCount ?? NaN),
    grossWeightKg: Number(process.env.FIXTURE_WEIGHT ?? first.grossWeightKg ?? NaN),
  },
);
for (const warning of warnings) console.log(`  WARN  ${warning}`);

console.log("");
console.log(`XML (${new TextEncoder().encode(xml).length} bytes):`);
console.log(xml);

process.exit(failed > 0 ? 1 : 0);
