#!/usr/bin/env node
/**
 * One-command UK Sanctions List refresh.
 *
 * Chains the whole pipeline so a fresh deployment needs no manual database edits:
 *   1. fetch official UKSL XML + parse       (ingest-sanctions-list.mjs)
 *   2. validate the written snapshot
 *   3. upload versioned + latest.json to R2  (upload-sanctions-to-r2.mjs)
 *   4. record sanctions_versions             (sanctions_data:recordVersion)
 *   5. point the active sanctions_list row   (reference_data:updateDatasetVersion)
 *
 * Step 5 is the one the screening route depends on — without it
 * resolveSanctionsUrl() throws "Sanctions list dataset URL not configured".
 *
 * Usage:
 *   npm run export-controls:refresh-sanctions
 *   node scripts/export-controls/refresh-sanctions.mjs --dry-run
 *   node scripts/export-controls/refresh-sanctions.mjs --skip-ingest        # reuse local snapshot
 *   node scripts/export-controls/refresh-sanctions.mjs --file <snapshot.json>
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GOLDEN_UNIQUE_IDS } from "./lib/sanctions-list-parser.mjs";

dotenv.config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data/export-controls");
const LATEST_KEY = "/export-controls/sanctions/latest.json";
const DATASET_NAME = "sanctions_list";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, skipIngest: false, skipUpload: false, file: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--skip-ingest") opts.skipIngest = true;
    else if (args[i] === "--skip-upload") opts.skipUpload = true;
    else if (args[i] === "--file" && args[i + 1]) opts.file = path.resolve(args[++i]);
  }
  return opts;
}

function step(n, label) {
  console.log(`\n[${n}/5] ${label}`);
}

function fail(message, hint) {
  console.error(`\n✖ ${message}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(1);
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    stdio: "inherit",
    cwd: ROOT,
  });
  if (result.status !== 0) fail(`${script} exited with status ${result.status}`);
}

const CONVEX_CLI = path.join(ROOT, "node_modules/convex/bin/main.js");

/**
 * Invoke the Convex CLI directly through node.
 *
 * Not via `npx` + shell: cmd.exe strips the double quotes out of the JSON
 * argument (Convex then sees a bare 2026-08-18 and rejects it), and Node
 * refuses to spawn npx.cmd with shell:false at all (EINVAL). Running the
 * CLI entrypoint sidesteps both.
 */
function runConvex(fnRef, args) {
  if (!fs.existsSync(CONVEX_CLI)) {
    fail(`Convex CLI not found at ${CONVEX_CLI}`, "Hint: npm install");
  }

  const result = spawnSync(process.execPath, [CONVEX_CLI, "run", fnRef, JSON.stringify(args)], {
    encoding: "utf8",
    cwd: ROOT,
  });

  if (result.error) {
    fail(`convex run ${fnRef} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "(no output)");
    fail(`convex run ${fnRef} exited with status ${result.status}`, "Hint: npx convex dev --once");
  }
  return result.stdout.trim();
}

/** Newest sanctions-*.json on disk — never a hard-coded filename. */
function findLatestSnapshot() {
  if (!fs.existsSync(DATA_DIR)) return null;
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("sanctions-") && f.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? path.join(DATA_DIR, files[0]) : null;
}

function validateSnapshot(file) {
  const meta = JSON.parse(fs.readFileSync(file, "utf8"));

  const version = meta.dateGenerated || meta.version;
  if (!version) fail(`${path.basename(file)} has no dateGenerated/version`);
  if (!Array.isArray(meta.entities) || meta.entities.length === 0) {
    fail(`${path.basename(file)} contains no entities`);
  }
  if (meta.entityCount !== meta.entities.length) {
    fail(`entityCount ${meta.entityCount} disagrees with ${meta.entities.length} parsed entities`);
  }
  if (!meta.sourceHash) {
    fail(`${path.basename(file)} has no sourceHash`, "Re-run the ingest step to write one.");
  }

  const ids = new Set(meta.entities.map((e) => e.uniqueId));
  const missing = GOLDEN_UNIQUE_IDS.filter((id) => !ids.has(id));
  if (missing.length > 0) {
    fail(`Golden designations missing: ${missing.join(", ")}`, "Parser or source has regressed.");
  }

  return { meta, version };
}

async function main() {
  const opts = parseArgs();
  console.log(`UK Sanctions List refresh${opts.dryRun ? " (dry run)" : ""}`);

  step(1, opts.skipIngest ? "Ingest — skipped" : "Fetching and parsing UKSL XML");
  if (!opts.skipIngest && !opts.file) runNode("ingest-sanctions-list.mjs");

  step(2, "Validating snapshot");
  const file = opts.file ?? findLatestSnapshot();
  if (!file || !fs.existsSync(file)) {
    fail("No sanctions snapshot found in data/export-controls", "Run without --skip-ingest.");
  }
  const { meta, version } = validateSnapshot(file);
  console.log(`   ${path.basename(file)} — v${version}, ${meta.entityCount} designations`);
  console.log(`   XML SHA-256: ${meta.sourceHash.slice(0, 16)}…`);

  step(3, opts.skipUpload ? "R2 upload — skipped" : "Uploading to R2");
  if (!opts.skipUpload && !opts.dryRun) runNode("upload-sanctions-to-r2.mjs", ["--file", file]);

  // The XML hash, not the JSON hash: convex/actions/sanctions.ts compares this
  // against a fresh sha256 of the remote XML to detect list changes. Recording
  // the JSON hash here would make every daily check report hashChanged.
  const versionArgs = {
    publishedAt: String(version),
    sourceHash: meta.sourceHash,
    entityCount: meta.entityCount,
    storagePath: LATEST_KEY,
  };

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  const datasetArgs = {
    name: DATASET_NAME,
    version: `v${version}`,
    storagePath: LATEST_KEY,
    ...(publicBase ? { storageUrl: `${publicBase}${LATEST_KEY}` } : {}),
  };

  if (opts.dryRun) {
    step(4, "Would record sanctions_versions");
    console.log(`   ${JSON.stringify(versionArgs)}`);
    step(5, "Would update referenceDatasets");
    console.log(`   ${JSON.stringify(datasetArgs)}`);
    console.log("\nDry run complete — nothing written.");
    return;
  }

  step(4, "Recording sanctions_versions");
  runConvex("sanctions_data:recordVersion", versionArgs);
  console.log(`   Recorded v${version}`);

  step(5, `Pointing referenceDatasets "${DATASET_NAME}" at the new snapshot`);
  runConvex("reference_data:updateDatasetVersion", datasetArgs);
  console.log(`   ${datasetArgs.storageUrl ?? datasetArgs.storagePath}`);

  if (!publicBase) {
    console.warn(
      "\n⚠️  NEXT_PUBLIC_R2_PUBLIC_URL is unset — only storagePath was recorded.\n" +
        "   Screening will fall back to the local snapshot until it is configured.",
    );
  }

  console.log(`\n✅ Sanctions list v${version} is live (${meta.entityCount} designations).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
