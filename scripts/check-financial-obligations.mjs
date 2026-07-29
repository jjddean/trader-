/**
 * FO integration check against deployed Convex (stored financial_obligations rows).
 *
 * Run: node scripts/check-financial-obligations.mjs
 */

import { spawnSync } from "node:child_process";

function main() {
  const run = spawnSync(
    "npx",
    ["convex", "run", "financial_obligations:debugListRecent", JSON.stringify({ limit: 25 })],
    { encoding: "utf8", shell: true, cwd: process.cwd() },
  );

  if (run.status !== 0) {
    console.error(run.stderr || run.stdout || "convex run failed");
    console.error("Hint: npx convex dev --once");
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(run.stdout.trim());
  } catch {
    console.error("FAIL: could not parse convex output:");
    console.error(run.stdout);
    process.exit(1);
  }

  console.log(`FO stored rows (sample): ${parsed.count}`);
  if (parsed.count === 0) {
    console.error(
      "FAIL: financial_obligations is empty. Open a declaration with MRN (not Draft) and Save core/goods to sync preview.",
    );
    process.exit(1);
  }

  for (const row of parsed.rows) {
    console.log(
      `  ${row.mrn ?? "?"}  ${row.obligationType}  £${Number(row.amount).toFixed(2)}  ${row.authority}/${row.status}`,
    );
  }
  console.log("OK: FO rows exist in Convex.");
}

main();
