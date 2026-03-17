import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const OUTPUT_JSON = path.join(ROOT, "data", "companies_hmrc.json");
const OUTPUT_META = path.join(ROOT, "data", "companies_hmrc.meta.json");

const STEPS = [
  { label: "Fetch HMRC bulk files", cmd: "node", args: ["scripts/fetch-hmrc-bulk.mjs"] },
  { label: "Parse HMRC bulk files", cmd: "node", args: ["scripts/parse-hmrc-data.mjs"] },
  { label: "Index HMRC companies in Typesense", cmd: "node", args: ["scripts/index-hmrc-companies.mjs"] },
];

function runStep(step) {
  console.log(`\n==> ${step.label}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${step.label} failed with exit code ${result.status}`);
  }
}

function writeMetadata() {
  if (!fs.existsSync(OUTPUT_JSON)) {
    throw new Error(`Missing output data file: ${OUTPUT_JSON}`);
  }
  const rows = JSON.parse(fs.readFileSync(OUTPUT_JSON, "utf8"));
  const metadata = {
    dataset: "companies_hmrc",
    source: "HMRC bulk importers/exporters files",
    sourceUrls: [
      "https://www.uktradeinfo.com/media/liraiahk/importers2512.zip",
      "https://www.uktradeinfo.com/media/bjllr0og/exporters2512.zip",
    ],
    recordCount: Array.isArray(rows) ? rows.length : 0,
    asOf: new Date().toISOString(),
    outputFile: "data/companies_hmrc.json",
  };
  fs.writeFileSync(OUTPUT_META, JSON.stringify(metadata, null, 2));
  console.log(`\nMetadata written to ${OUTPUT_META}`);
}

function main() {
  for (const step of STEPS) {
    runStep(step);
  }
  writeMetadata();
  console.log("\nHMRC companies refresh complete.");
}

main();
