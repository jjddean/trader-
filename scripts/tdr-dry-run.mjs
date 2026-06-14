import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "test-evidence", "run-hmrc-scenarios.js");

const result = spawnSync(process.execPath, [runner], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_HMRC_ENV: "tdr",
    HMRC_ENVIRONMENT: "sandbox",
    DRY_RUN_ONLY: "true",
  },
});

process.exit(result.status ?? 1);
