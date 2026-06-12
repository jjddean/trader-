import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cloudagentDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(cloudagentDir, "..", ".env.local");
const useOauth = process.argv.includes("--oauth");

if (!useOauth) {
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
  process.env.CLOUDFLARE_API_TOKEN ||= process.env.CLOUDEFLARE_TOKEN;
} else {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDEFLARE_TOKEN;
  console.log("Using Wrangler OAuth (CLOUDFLARE_API_TOKEN ignored). Run `npx wrangler login` first if needed.\n");
}

process.env.CLOUDFLARE_ACCOUNT_ID ||= "555e307a91082ae8c8e69b0a5ff3b8c3";

if (!useOauth && !process.env.CLOUDFLARE_API_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN in ../.env.local — or run: npm run deploy:oauth");
  process.exit(1);
}

try {
  execSync("npx wrangler deploy", { stdio: "inherit", env: process.env, cwd: cloudagentDir });
} catch {
  if (!useOauth) {
    console.error(`
Deploy failed. Your CLOUDFLARE_API_TOKEN is valid but cannot publish Workers (error 10000).

Fix A — edit the SAME token (no new token):
  https://dash.cloudflare.com/profile/api-tokens
  → your token → Add: Account / Workers Scripts / Edit
  (+ D1 Edit, Vectorize Edit, Workers AI Read if missing)

Fix B — browser login instead of API token:
  npx wrangler logout
  npx wrangler login
  npm run deploy:oauth
`);
  }
  process.exit(1);
}
