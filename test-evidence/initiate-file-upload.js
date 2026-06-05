/**
 * Customs Declarations API — POST file-upload initiate
 *
 * Usage:
 *   node test-evidence/initiate-file-upload.js
 *   MRN=26GB664W3BLIFZFAR4 node test-evidence/initiate-file-upload.js
 *
 * Requires: .env.local (HMRC_*, NEXT_PUBLIC_CONVEX_URL, HMRC_TEST_USER_ID)
 * Writes: documentation/HMRC/sdst-evidence-pack/evidence/06-file-upload/
 *
 * Source: HMRC Customs Declarations v2.0 OAS — POST /customs/declarations/file-upload
 * Request shape: HMRC CDS E2E guide (hmrc:fileupload namespace + Files wrapper)
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const HMRC_CONFIG = {
  sandboxBaseUrl: process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk",
  productionBaseUrl: process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk",
  declarationsAccept:
    process.env.HMRC_DECLARATIONS_ACCEPT ||
    process.env.HMRC_ACCEPT_V2_XML ||
    "application/vnd.hmrc.2.0+xml",
  vendor: {
    publicIp: process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6",
    productName: process.env.HMRC_VENDOR_PRODUCT_NAME || "Freightcode",
    version: process.env.HMRC_VENDOR_VERSION || "1.0.0",
  },
  timing: {
    tokenExpiryBufferMs: Number(process.env.HMRC_TOKEN_EXPIRY_BUFFER_MS) || 300000,
    defaultTokenExpiryMs: Number(process.env.HMRC_DEFAULT_TOKEN_EXPIRY_MS) || 14400,
  },
};

const DEFAULT_MRN = "26GB664W3BLIFZFAR4";
const DEFAULT_DOCUMENT_TYPE = "invoice";
const OUT_DIR = path.join(
  process.cwd(),
  "documentation/HMRC/sdst-evidence-pack/evidence/06-file-upload",
);

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildFileUploadRequestXml(mrn, documentType) {
  // HMRC CDS E2E guide + v2.0 OAS: xmlns hmrc="hmrc:fileupload", Files wrapper required.
  return `<?xml version="1.0" encoding="UTF-8"?>
<hmrc:FileUploadRequest xmlns:hmrc="hmrc:fileupload">
  <hmrc:DeclarationID>${xmlEscape(mrn)}</hmrc:DeclarationID>
  <hmrc:FileGroupSize>1</hmrc:FileGroupSize>
  <hmrc:Files>
    <hmrc:File>
      <hmrc:FileSequenceNo>1</hmrc:FileSequenceNo>
      <hmrc:DocumentType>${xmlEscape(documentType)}</hmrc:DocumentType>
    </hmrc:File>
  </hmrc:Files>
</hmrc:FileUploadRequest>`;
}

async function getToken(client, userId) {
  const tokenRecord = await client.query(api.hmrc.getToken, { userId });
  if (!tokenRecord?.accessToken) {
    throw new Error(`No HMRC token in Convex for user ${userId}. Connect HMRC in the app first.`);
  }

  if (
    tokenRecord.expiresAt &&
    Date.now() + HMRC_CONFIG.timing.tokenExpiryBufferMs > tokenRecord.expiresAt
  ) {
    if (!tokenRecord.refreshToken) {
      throw new Error("HMRC token expiring and no refresh token in Convex");
    }
    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? HMRC_CONFIG.sandboxBaseUrl
        : HMRC_CONFIG.productionBaseUrl;
    const refreshResponse = await fetch(`${hmrcBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_secret: process.env.HMRC_CLIENT_SECRET,
        client_id: process.env.HMRC_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: tokenRecord.refreshToken,
      }).toString(),
    });
    if (!refreshResponse.ok) {
      throw new Error(`Token refresh failed: ${await refreshResponse.text()}`);
    }
    const data = await refreshResponse.json();
    await client.mutation(api.hmrc.saveToken, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenRecord.refreshToken,
      expiresIn: data.expires_in || HMRC_CONFIG.timing.defaultTokenExpiryMs,
      eori: tokenRecord.eori,
    });
    return { accessToken: data.access_token, eori: tokenRecord.eori };
  }

  return { accessToken: tokenRecord.accessToken, eori: tokenRecord.eori };
}

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

function parseUploadResponse(bodyText) {
  const tag = (name) => {
    const match = bodyText.match(
      new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`),
    );
    return match?.[1] ?? null;
  };

  return {
    reference: tag("Reference"),
    uploadHref: tag("Href"),
    hasUploadFields: /<(?:[^>]*:)?Fields>/i.test(bodyText),
  };
}

async function run() {
  const mrn = process.env.MRN || DEFAULT_MRN;
  const documentType = process.env.DOCUMENT_TYPE || DEFAULT_DOCUMENT_TYPE;
  const userId = process.env.HMRC_TEST_USER_ID || process.env.HMRC_USER_ID;
  if (!userId) {
    throw new Error("Missing HMRC_TEST_USER_ID (or HMRC_USER_ID) in .env.local");
  }
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const { accessToken, eori } = await getToken(client, userId);
  const eoriHeader = eori || process.env.HMRC_EORI;
  if (!eoriHeader) {
    throw new Error("Missing EORI — reconnect HMRC in Settings or set HMRC_EORI in .env.local");
  }

  const hmrcBase =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;
  const url = `${hmrcBase}/customs/declarations/file-upload`;
  const requestXml = buildFileUploadRequestXml(mrn, documentType);
  const timestamp = new Date().toISOString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: HMRC_CONFIG.declarationsAccept,
      "Content-Type": "application/xml; charset=UTF-8",
      Authorization: `Bearer ${accessToken}`,
      "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
      "X-Eori-Identifier": eoriHeader,
      ...fraudHeaders(),
    },
    body: requestXml,
  });

  const bodyText = await response.text();
  const parsed = parseUploadResponse(bodyText);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "request.xml"), requestXml);
  fs.writeFileSync(path.join(OUT_DIR, "response.xml"), bodyText);

  const summary = {
    timestamp,
    mrn,
    documentType,
    httpStatus: response.status,
    conversationId: response.headers.get("X-Conversation-ID") || null,
    endpoint: "/customs/declarations/file-upload",
    accept: HMRC_CONFIG.declarationsAccept,
    ok: response.ok,
    uploadReference: parsed.reference,
    uploadHref: parsed.uploadHref,
    hasUploadFields: parsed.hasUploadFields,
  };

  fs.writeFileSync(path.join(OUT_DIR, "summary.md"), [
    "# File upload initiate — §4.3",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Date (UTC) | ${summary.timestamp} |`,
    `| MRN (DeclarationID) | ${summary.mrn} |`,
    `| Document type | ${summary.documentType} |`,
    `| HTTP | ${summary.httpStatus} |`,
    `| X-Conversation-ID | ${summary.conversationId ?? "—"} |`,
    `| Endpoint | POST ${summary.endpoint} |`,
    `| Accept | ${summary.accept} |`,
    `| Upload reference | ${summary.uploadReference ?? "—"} |`,
    `| S3 Href present | ${summary.uploadHref ? "yes" : "no"} |`,
    `| Upload Fields present | ${summary.hasUploadFields ? "yes" : "no"} |`,
    "",
    summary.ok
      ? "Result: **PASS** — initiate returned signed upload metadata."
      : "Result: **FAIL** — see response.xml",
    "",
    "Next: copy conversation ID + timestamp into [LOG.md](../../LOG.md) and tick CHECKLIST §4.3.",
    "",
  ].join("\n"));

  console.log(JSON.stringify(summary, null, 2));

  if (!response.ok) {
    console.error("\n[FAIL]", bodyText.slice(0, 800));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
