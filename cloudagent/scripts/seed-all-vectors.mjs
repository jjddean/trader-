/**
 * seed-all-vectors.mjs
 *
 * Master orchestration script that runs all data conversion, fetching,
 * and vector seeding steps in the correct order.
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID  – Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN   – API token with Workers AI + Vectorize edit
 *
 * Usage:  node cloudagent/scripts/seed-all-vectors.mjs
 *
 * Steps:
 *   1. Convert HMRC error codes ODS -> JSON
 *   2. Seed HMRC error codes into Vectorize (hmrc-cds-errors)
 *   3. Fetch UK tariff data from official API
 *   4. Seed UK tariff data into Vectorize (uk-global-tariff)
 */

import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";

const SCRIPTS_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPTS_DIR, "../..");

const steps = [
  {
    name: "Convert HMRC Error Codes (ODS -> JSON)",
    script: "convert-hmrc-errors.mjs",
    requiresCloudflare: false,
    outputCheck: path.join(REPO_ROOT, "cloudagent/data/hmrc-errors.json"),
  },
  {
    name: "Seed HMRC Error Codes into Vectorize",
    script: "seed-hmrc-errors.mjs",
    requiresCloudflare: true,
    outputCheck: null,
  },
  {
    name: "Fetch UK Tariff Data from Official API",
    script: "fetch-uk-tariff.mjs",
    requiresCloudflare: false,
    outputCheck: path.join(REPO_ROOT, "cloudagent/data/uk-tariff-comprehensive.json"),
  },
  {
    name: "Seed UK Tariff Data into Vectorize",
    script: "seed-uk-tariff.mjs",
    requiresCloudflare: true,
    outputCheck: null,
  },
];

function checkCloudflareEnv() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error("\nMissing required environment variables:");
    if (!accountId) console.error("  - CLOUDFLARE_ACCOUNT_ID");
    if (!apiToken) console.error("  - CLOUDFLARE_API_TOKEN");
    console.error("\nCreate an API token at https://dash.cloudflare.com/profile/api-tokens with:");
    console.error("  - Account > Cloudflare Workers AI > Edit");
    console.error("  - Account > Vectorize > Edit");
    return false;
  }

  return true;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     TradeDNA — Vector Database Seeding Suite     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const startTime = Date.now();
  const results = [];
  let hasCloudflareEnv = true;

  // Pre-check: verify Cloudflare env vars if any step needs them
  const needsCloudflare = steps.some((s) => s.requiresCloudflare);
  if (needsCloudflare) {
    hasCloudflareEnv = checkCloudflareEnv();
    if (!hasCloudflareEnv) {
      console.warn("\nWill skip Cloudflare-dependent steps (seeding).\n");
      console.warn("Data conversion and API fetching will still run.\n");
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = i + 1;

    console.log(`\n${"─".repeat(56)}`);
    console.log(`Step ${stepNum}/${steps.length}: ${step.name}`);
    console.log(`${"─".repeat(56)}\n`);

    // Skip Cloudflare-dependent steps if env vars are missing
    if (step.requiresCloudflare && !hasCloudflareEnv) {
      console.log("⏭  Skipped (missing Cloudflare credentials)\n");
      results.push({ step: step.name, status: "skipped", reason: "missing credentials" });
      continue;
    }

    // Skip data generation if output already exists (use --force to override)
    if (step.outputCheck && fs.existsSync(step.outputCheck) && !process.argv.includes("--force")) {
      console.log(`Output already exists: ${step.outputCheck}`);
      console.log("Use --force to regenerate. Proceeding to next step.\n");
      results.push({ step: step.name, status: "skipped", reason: "output exists" });
      continue;
    }

    const scriptPath = path.join(SCRIPTS_DIR, step.script);
    const stepStart = Date.now();

    try {
      execFileSync(process.execPath, [scriptPath], {
        stdio: "inherit",
        env: process.env,
        cwd: REPO_ROOT,
      });

      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
      console.log(`\nCompleted in ${elapsed}s`);
      results.push({ step: step.name, status: "success", elapsed: `${elapsed}s` });
    } catch (err) {
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
      console.error(`\nStep failed after ${elapsed}s: ${err.message}`);
      results.push({ step: step.name, status: "failed", elapsed: `${elapsed}s`, error: err.message });

      // Continue to next step rather than aborting entirely
      console.log("Continuing to next step...\n");
    }
  }

  // Summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(56)}`);
  console.log("SUMMARY");
  console.log(`${"═".repeat(56)}\n`);

  for (const r of results) {
    const icon = r.status === "success" ? "OK" : r.status === "skipped" ? "--" : "!!";
    const detail = r.status === "failed" ? ` (${r.error})` : r.status === "skipped" ? ` (${r.reason})` : "";
    console.log(`  [${icon}] ${r.step}${r.elapsed ? ` (${r.elapsed})` : ""}${detail}`);
  }

  console.log(`\nTotal time: ${totalElapsed}s`);

  const failures = results.filter((r) => r.status === "failed");
  if (failures.length > 0) {
    console.error(`\n${failures.length} step(s) failed. Check the logs above.`);
    process.exit(1);
  }

  console.log("\nAll steps completed successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
