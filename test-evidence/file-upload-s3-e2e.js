/**
 * TDR — CDS file upload initiate + S3 POST (server-side, no browser CORS)
 *
 * Usage:
 *   node test-evidence/file-upload-s3-e2e.js
 *   MRN=26GB6GFBKLT2N0TAR6 node test-evidence/file-upload-s3-e2e.js
 *
 * Requires: .env.local (HMRC_*, NEXT_PUBLIC_CONVEX_URL, HMRC_TEST_USER_ID)
 * Writes: docs/hmrc/ACTIVE/tdr/evidence/file-upload/
 *
 * Note: Convex action auth required for token resolve — connect HMRC in app first.
 * Same S3 POST path as POST /api/hmrc/documents/upload on Vercel.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
const { register } = require("tsx/cjs/api");
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

register();

const {
  buildFileUploadRequestXml,
  parseFileUploadResponse,
  postFileToHmrcS3,
} = require("../src/lib/hmrc-document-upload.ts");
const { declarationsAcceptHeader } = require("../src/lib/hmrc-config.ts");

const OUT_DIR = path.join(process.cwd(), "docs/hmrc/ACTIVE/tdr/evidence/file-upload");
const DEFAULT_MRN = "26GB6GFBKLT2N0TAR6";

const HMRC_CONFIG = {
  sandboxBaseUrl: process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk",
  productionBaseUrl: process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk",
  vendor: {
    publicIp: process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6",
    productName: process.env.HMRC_VENDOR_PRODUCT_NAME || "Freightcode",
    version: process.env.HMRC_VENDOR_VERSION || "1.0.0",
  },
};

function fraudHeaders() {
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Public-IP": "62.31.164.236",
    "Gov-Client-Public-Port": "443",
    "Gov-Client-Device-ID": "be360090-eb60-4927-a94f-cc8102d1359c",
    "Gov-Client-User-IDs": "appUser=test-trader-jason",
    "Gov-Client-Timezone": "UTC+00:00",
    "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=1&colour-depth=24",
    "Gov-Client-Window-Size": "width=1920&height=1080",
    "Gov-Client-Browser-JS-User-Agent":
      "Mozilla%2F5.0+(Windows+NT+10.0%3B+Win64%3B+x64)+AppleWebKit%2F537.36",
    "Gov-Client-Browser-Do-Not-Track": "false",
    "Gov-Vendor-Version": `${HMRC_CONFIG.vendor.productName}=${HMRC_CONFIG.vendor.version}`,
    "Gov-Vendor-Product-Name": HMRC_CONFIG.vendor.productName,
    "Gov-Vendor-Public-IP": HMRC_CONFIG.vendor.publicIp,
    "Gov-Vendor-Forwarded": `by=${HMRC_CONFIG.vendor.publicIp}&for=62.31.164.236`,
  };
}

async function resolveToken(client, userId) {
  if (process.env.HMRC_ACCESS_TOKEN?.trim()) {
    return process.env.HMRC_ACCESS_TOKEN.trim();
  }

  try {
    const result = await client.action(api.hmrc_actions.resolveAccessToken, { userId });
    if (result?.token) return result.token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("Could not find public function")) {
      throw err;
    }
  }

  throw new Error(
    "No HMRC access token. Either run `npx convex dev` (deploy resolveAccessToken) or set HMRC_ACCESS_TOKEN in .env.local for CLI tests.",
  );
}

async function run() {
  const mrn = process.env.MRN || DEFAULT_MRN;
  const documentType = process.env.DOCUMENT_TYPE || "invoice";
  const userId = process.env.HMRC_TEST_USER_ID || process.env.HMRC_USER_ID;
  if (!userId) {
    throw new Error("Missing HMRC_TEST_USER_ID in .env.local");
  }
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const eori = process.env.HMRC_EORI;
  if (!eori) {
    throw new Error("Missing HMRC_EORI in .env.local");
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const accessToken = await resolveToken(client, userId);

  const hmrcBase =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;
  const accept = declarationsAcceptHeader();
  const requestXml = buildFileUploadRequestXml({ mrn, documentType });
  const timestamp = new Date().toISOString();

  const initiateRes = await fetch(`${hmrcBase}/customs/declarations/file-upload`, {
    method: "POST",
    headers: {
      Accept: accept,
      "Content-Type": "application/xml; charset=UTF-8",
      Authorization: `Bearer ${accessToken}`,
      "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
      "X-Eori-Identifier": eori,
      ...fraudHeaders(),
    },
    body: requestXml,
  });

  const initiateBody = await initiateRes.text();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "initiate-request.xml"), requestXml);
  fs.writeFileSync(path.join(OUT_DIR, "initiate-response.xml"), initiateBody);

  if (!initiateRes.ok) {
    console.error("[FAIL] Initiate:", initiateRes.status, initiateBody.slice(0, 500));
    process.exit(1);
  }

  const parsed = parseFileUploadResponse(initiateBody);
  if (!parsed.uploadHref || !parsed.hasUploadFields) {
    console.error("[FAIL] Missing S3 metadata in initiate response");
    process.exit(1);
  }

  const pdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n109\n%%EOF",
    "utf8",
  );

  const s3Result = await postFileToHmrcS3({
    href: parsed.uploadHref,
    fields: parsed.fields,
    fileBytes: pdfBytes,
    fileName: "freightcode-upload-test.pdf",
    contentType: "application/pdf",
  });

  const summary = {
    timestamp,
    mrn,
    documentType,
    initiateStatus: initiateRes.status,
    conversationId: initiateRes.headers.get("X-Conversation-ID"),
    uploadReference: parsed.reference,
    s3Status: s3Result.status,
    s3Ok: s3Result.ok,
    host: "server-side-node",
    route: "POST /api/hmrc/documents/upload (same S3 path as Vercel)",
  };

  fs.writeFileSync(path.join(OUT_DIR, "s3-result.json"), JSON.stringify(summary, null, 2));

  const summaryMd = [
    "# TDR — File upload initiate + S3 (server-side)",
    "",
    `**Date:** ${timestamp.slice(0, 10)}`,
    `**Outcome:** ${s3Result.ok ? "**PASS** — initiate + S3 POST succeeded" : "**FAIL** — see s3-result.json"}`,
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| MRN | \`${mrn}\` |`,
    `| Initiate HTTP | ${initiateRes.status} |`,
    `| S3 POST HTTP | ${s3Result.status} |`,
    `| X-Conversation-ID | ${summary.conversationId ?? "—"} |`,
    `| Upload reference | ${summary.uploadReference ?? "—"} |`,
    `| Path | Server-side (\`/api/hmrc/documents/upload\` on Vercel — no browser CORS) |`,
    "",
    "## Notes",
    "",
    "- Browser uploads on localhost previously failed CORS to Upscan; server-side POST avoids this.",
    "- UI uses `POST /api/hmrc/documents/upload` (multipart) instead of client-direct S3.",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT_DIR, "summary.md"), summaryMd);
  console.log(JSON.stringify(summary, null, 2));

  if (!s3Result.ok) {
    console.error(`\n[FAIL] S3 POST status ${s3Result.status}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
