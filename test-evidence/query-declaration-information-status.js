/**
 * Customs Declarations Information API — GET status by MRN
 *
 * Usage:
 *   node test-evidence/query-declaration-information-status.js
 *   MRN=26GB63M1I0RQFCVAR4 node test-evidence/query-declaration-information-status.js
 *
 * Requires: .env.local (HMRC_*, NEXT_PUBLIC_CONVEX_URL, HMRC_TEST_USER_ID)
 * Writes: docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/evidence/07-status-query/
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const HMRC_CONFIG = {
  sandboxBaseUrl: process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk",
  productionBaseUrl: process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk",
  // Trade Test Information API = v1.0 XML (CDS E2E guide); not v2.0 JSON
  informationAccept:
    process.env.HMRC_INFORMATION_ACCEPT ||
    (process.env.HMRC_ENVIRONMENT === "production"
      ? process.env.HMRC_ACCEPT_V2_XML || "application/vnd.hmrc.2.0+xml"
      : process.env.HMRC_ACCEPT_V1_XML || "application/vnd.hmrc.1.0+xml"),
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

const DEFAULT_MRN = "26GB63M1I0RQFCVAR4";
const OUT_DIR = path.join(
  process.cwd(),
  "docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/evidence/07-status-query",
);

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
    return data.access_token;
  }

  return tokenRecord.accessToken;
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

async function run() {
  const mrn = process.env.MRN || DEFAULT_MRN;
  const userId = process.env.HMRC_TEST_USER_ID || process.env.HMRC_USER_ID;
  if (!userId) {
    throw new Error("Missing HMRC_TEST_USER_ID (or HMRC_USER_ID) in .env.local");
  }
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const token = await getToken(client, userId);

  const hmrcBase =
    process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;
  const url = `${hmrcBase}/customs/declarations-information/mrn/${encodeURIComponent(mrn)}/status`;
  const timestamp = new Date().toISOString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: HMRC_CONFIG.informationAccept,
      Authorization: `Bearer ${token}`,
      "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
      ...fraudHeaders(),
    },
  });

  const bodyText = await response.text();
  const isXml = HMRC_CONFIG.informationAccept.includes("xml");
  const tag = (name) => {
    const m = bodyText.match(
      new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`),
    );
    return m?.[1];
  };
  const parsed = isXml
    ? { mrn: tag("ID"), ics: tag("ICS"), roe: tag("ROE"), versionId: tag("VersionID"), typeCode: tag("TypeCode") }
    : (() => {
        try {
          return JSON.parse(bodyText);
        } catch {
          return { raw: bodyText };
        }
      })();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (isXml) {
    fs.writeFileSync(path.join(OUT_DIR, "response.xml"), bodyText);
  }
  fs.writeFileSync(path.join(OUT_DIR, "response.json"), JSON.stringify(parsed, null, 2));

  const summary = {
    timestamp,
    mrn,
    httpStatus: response.status,
    conversationId: response.headers.get("X-Conversation-ID") || null,
    endpoint: url.replace(hmrcBase, ""),
    accept: HMRC_CONFIG.informationAccept,
    ok: response.ok,
    statusField: parsed?.ics ? `ICS ${parsed.ics}` : parsed?.status ?? parsed?.declarationStatus ?? null,
  };
  fs.writeFileSync(path.join(OUT_DIR, "summary.md"), [
    "# Declaration Information API — status by MRN",
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Date (UTC) | ${summary.timestamp} |`,
    `| MRN | ${summary.mrn} |`,
    `| HTTP | ${summary.httpStatus} |`,
    `| X-Conversation-ID | ${summary.conversationId ?? "—"} |`,
    `| Endpoint | GET ${summary.endpoint} |`,
    `| Accept | ${summary.accept} |`,
    `| HMRC status field | ${summary.statusField ?? "—"} |`,
    "",
    summary.ok ? "Result: **PASS**" : "Result: **FAIL** — see response.json",
    "",
  ].join("\n"));

  console.log(JSON.stringify(summary, null, 2));

  if (!response.ok) {
    if (parsed?.code === "INVALID_SCOPE") {
      console.error(
        "\n[FAIL] Token missing write:customs-declarations-information.\n" +
          "  1. Set HMRC_SCOPES in .env.local (both scopes, space-separated)\n" +
          "  2. Reconnect HMRC in app Settings (new OAuth grant)\n" +
          "  3. Re-run this script\n",
      );
    } else {
      console.error("\n[FAIL]", bodyText.slice(0, 500));
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
