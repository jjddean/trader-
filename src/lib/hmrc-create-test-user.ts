/**
 * HMRC Create Test User API (sandbox) — organisation with customs-services.
 * @see https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/api-platform-test-user/1.0
 */

export interface HmrcSandboxTestUser {
  userId: string;
  password: string;
  userFullName?: string;
  emailAddress?: string;
  eoriNumber?: string;
}

function sandboxBaseUrl(): string {
  return process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk";
}

function sandboxClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.HMRC_SANDBOX_CLIENT_ID || process.env.HMRC_CLIENT_ID || "";
  const clientSecret =
    process.env.HMRC_SANDBOX_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "";
  return { clientId, clientSecret };
}

async function getClientCredentialsToken(): Promise<string> {
  const { clientId, clientSecret } = sandboxClientCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Missing HMRC sandbox OAuth credentials (HMRC_CLIENT_ID / HMRC_CLIENT_SECRET).");
  }

  const base = sandboxBaseUrl();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "write:customs-declaration",
  });

  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  let data: { access_token?: string };
  try {
    data = JSON.parse(text) as { access_token?: string };
  } catch {
    throw new Error(`HMRC token response not JSON (${res.status})`);
  }

  if (!res.ok || !data.access_token) {
    throw new Error(`HMRC client credentials failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return data.access_token;
}

/** Create an organisation sandbox test user for TDR OAuth (customs-services). */
export async function createHmrcOrganisationTestUser(): Promise<HmrcSandboxTestUser> {
  const accessToken = await getClientCredentialsToken();
  const base = sandboxBaseUrl();

  const payload: { serviceNames: string[]; eoriNumber?: string } = {
    serviceNames: ["customs-services"],
  };
  const optionalEori = process.env.HMRC_DEFAULT_TEST_USER_EORI?.trim();
  if (optionalEori) {
    payload.eoriNumber = optionalEori;
  }

  const res = await fetch(`${base}/create-test-user/organisations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Create test user response not JSON (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`Create test user failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const userId = typeof data.userId === "string" ? data.userId : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!userId || !password) {
    throw new Error("Create test user response missing userId or password");
  }

  return {
    userId,
    password,
    userFullName: typeof data.userFullName === "string" ? data.userFullName : undefined,
    emailAddress: typeof data.emailAddress === "string" ? data.emailAddress : undefined,
    eoriNumber: typeof data.eoriNumber === "string" ? data.eoriNumber : undefined,
  };
}
