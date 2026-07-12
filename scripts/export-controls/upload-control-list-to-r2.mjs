#!/usr/bin/env node
/**
 * Upload parsed control list JSON to Cloudflare R2 (versioned path).
 *
 * Usage:
 *   node scripts/export-controls/upload-control-list-to-r2.mjs
 *   node scripts/export-controls/upload-control-list-to-r2.mjs --file data/export-controls/v2025-12-16.json
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
const DEFAULT_FILE = path.join(ROOT, "data/export-controls/v2025-12-16.json");
const VERSION = "2025-12-16";

function parseArgs() {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) file = path.resolve(args[++i]);
  }
  return { file };
}

async function main() {
  const { file } = parseArgs();

  if (!fs.existsSync(file)) {
    console.error(`JSON not found: ${file}`);
    console.error("Run: node scripts/export-controls/parse-control-list.mjs");
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
      console.error(`Missing env: ${key} (set in .env.local)`);
      process.exit(1);
    }
  }

  const body = fs.readFileSync(file);
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || "tradedna";
  const versionedKey = `export-controls/control-list/v${VERSION}.json`;
  const latestKey = "export-controls/control-list/latest.json";

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
        Body: body,
        ContentType: "application/json",
        Metadata: { sha256: hash, version: VERSION },
      }),
    );
  }

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "(set NEXT_PUBLIC_R2_PUBLIC_URL)";
  console.log(`\n✅ Uploaded control list v${VERSION}`);
  console.log(`   SHA-256: ${hash.slice(0, 16)}…`);
  console.log(`   Public: ${publicBase}/${latestKey}`);
  console.log("\nNext: register pointer in Convex referenceDatasets:");
  console.log(`   name: export_control_list`);
  console.log(`   version: v${VERSION}`);
  console.log(`   storagePath: /export-controls/control-list/latest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
