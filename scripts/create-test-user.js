/**
 * Create an HMRC sandbox test user (organisation) via the Create Test User API.
 *
 * Usage:
 *   node scripts/create-test-user.js
 *
 * Reads HMRC_CLIENT_ID and HMRC_CLIENT_SECRET from .env.local (never hardcoded).
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const HMRC_BASE =
  process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk";

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

async function createOrganisationTestUser(accessToken) {
  const res = await fetch(`${HMRC_BASE}/create-test-user/organisations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceNames: ["customs-services"],
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
  console.log("Requesting client credentials token...");
  const accessToken = await getClientCredentialsToken();
  console.log("Token obtained.\n");

  console.log("Creating organisation test user (customs-services)...");
  const user = await createOrganisationTestUser(accessToken);

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
