#!/usr/bin/env node
/**
 * Upload normalized UK Sanctions List JSON to R2.
 *
 * Usage:
 *   node scripts/export-controls/upload-sanctions-to-r2.mjs
 *   node scripts/export-controls/upload-sanctions-to-r2.mjs --file data/export-controls/sanctions-2026-06-26.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function parseArgs() {
  const args = process.argv.slice(2);
  let file = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) file = path.resolve(args[++i]);
  }
  return { file };
}

function findLatestSanctionsFile() {
  const dir = path.join(ROOT, "data/export-controls");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("sanctions-") && f.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? path.join(dir, files[0]) : null;
}

async function main() {
  const { file: argFile } = parseArgs();
  const file = argFile ?? findLatestSanctionsFile();

  if (!file || !fs.existsSync(file)) {
    console.error("Sanctions JSON not found.");
    console.error("Run: npm run export-controls:ingest-sanctions");
    process.exit(1);
  }

  const required = [
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET_NAME",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing env: ${key}`);
      process.exit(1);
    }
  }

  const raw = fs.readFileSync(file, "utf8");
  const meta = JSON.parse(raw);
  const version = meta.dateGenerated || meta.version;
  if (!version) {
    console.error("JSON missing dateGenerated/version");
    process.exit(1);
  }

  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || "tradedna";
  const versionedKey = `export-controls/sanctions/v${version}.json`;
  const latestKey = "export-controls/sanctions/latest.json";

  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  for (const key of [versionedKey, latestKey]) {
    console.log(`Uploading → ${bucket}/${key}`);
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: raw,
        ContentType: "application/json",
        Metadata: {
          sha256: hash,
          version: String(version),
          entityCount: String(meta.entityCount ?? ""),
        },
      }),
    );
  }

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  console.log(`\n✅ Uploaded sanctions v${version} (${meta.entityCount} entities)`);
  console.log(`   SHA-256: ${hash.slice(0, 16)}…`);
  if (publicBase) console.log(`   Public: ${publicBase}/${latestKey}`);
  console.log("\nRecord version in Convex:");
  console.log(
    `   npx convex run sanctions_data:recordVersion '{"publishedAt":"${version}","sourceHash":"${hash}","entityCount":${meta.entityCount},"storagePath":"/export-controls/sanctions/latest.json"}'`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
