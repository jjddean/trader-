/**
 * Create an HMRC sandbox test user via the Create Test User API.
 *
 * Usage:
 *   HMRC_TEST_USER_EORI=GBxxxxxxxxxxxx node scripts/create-test-user.js
 *   HMRC_TEST_USER_EORI=GBxxxxxxxxxxxx node scripts/create-test-user.js --individual
 *
 * Reads HMRC_CLIENT_ID and HMRC_CLIENT_SECRET from .env.local (never hardcoded).
 * HMRC_TEST_USER_EORI is required — pick a value from the CDS Test Data Library spreadsheet.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const HMRC_BASE =
  process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk";

const TDL_EORI = process.env.HMRC_TEST_USER_EORI?.trim();
const useIndividual = process.argv.includes("--individual");

async function getClientCredentialsToken() {
  const clientId = process.env.HMRC_CLIENT_ID;
  const clientSecret = process.env.HMRC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing HMRC_CLIENT_ID or HMRC_CLIENT_SECRET in .env.local",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "write:customs-declaration",
  });

  const res = await fetch(`${HMRC_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Token response not JSON (${res.status}): ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  if (!data.access_token) {
    throw new Error(`Token response missing access_token: ${text}`);
  }

  return data.access_token;
}

async function createTestUser(accessToken) {
  const endpoint = useIndividual
    ? `${HMRC_BASE}/create-test-user/individuals`
    : `${HMRC_BASE}/create-test-user/organisations`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceNames: ["customs-services"],
      eoriNumber: TDL_EORI,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Create user response not JSON (${res.status}): ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Create test user failed (${res.status}): ${text}`);
  }

  return data;
}

async function main() {
  if (!TDL_EORI) {
    throw new Error(
      "Set HMRC_TEST_USER_EORI to a Test Data Library EORI before running (see docs/hmrc/ARCHIVE/trade-test/hmrc-mirror/trade-test-data-library.md).",
    );
  }

  console.log("Requesting client credentials token...");
  const accessToken = await getClientCredentialsToken();
  console.log("Token obtained.\n");

  console.log(
    `Creating ${useIndividual ? "individual" : "organisation"} test user (customs-services, eoriNumber=${TDL_EORI})...`,
  );
  const user = await createTestUser(accessToken);

  console.log("=== Create Test User API response ===\n");
  console.log(JSON.stringify(user, null, 2));

  console.log("\n=== Key fields ===");
  console.log("userId:", user.userId ?? "(missing)");
  console.log("password:", user.password ?? "(missing)");
  console.log("eoriNumber:", user.eoriNumber ?? "(missing)");
  console.log("userFullName:", user.userFullName ?? "(missing)");
  console.log("emailAddress:", user.emailAddress ?? "(missing)");

  const otherKeys = Object.keys(user).filter(
    (k) =>
      !["userId", "password", "eoriNumber", "userFullName", "emailAddress"].includes(
        k,
      ),
  );
  if (otherKeys.length > 0) {
    console.log("\n=== Other fields ===");
    for (const key of otherKeys) {
      console.log(`${key}:`, JSON.stringify(user[key], null, 2));
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
