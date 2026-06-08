import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";

const TOKEN_EXPIRY_BUFFER_MS = Number(process.env.HMRC_TOKEN_EXPIRY_BUFFER_MS) || 300000;
const DEFAULT_EXPIRES_IN_SEC = Number(process.env.HMRC_DEFAULT_TOKEN_EXPIRY_MS) || 14400;

function hmrcBaseUrl(): string {
  return process.env.HMRC_ENVIRONMENT === "sandbox"
    ? process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk"
    : process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk";
}

export interface HmrcTokenRow {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  eori?: string;
}

/** Resolve a valid access token for background jobs (cron / scheduled pulls). */
export async function resolveAccessTokenForUser(
  ctx: ActionCtx,
  userId: string,
): Promise<string | null> {
  const row: HmrcTokenRow | null = await ctx.runQuery(internal.declarations.getHmrcTokenRowForUser, {
    userId,
  });
  if (!row?.accessToken) return null;

  const expiresAt = Number(row.expiresAt ?? 0);
  if (expiresAt > 0 && Date.now() + TOKEN_EXPIRY_BUFFER_MS < expiresAt) {
    return row.accessToken;
  }

  if (!row.refreshToken) {
    console.warn(`[HMRC-TOKEN] No refresh token for user ${userId} — using possibly expired access token`);
    return row.accessToken;
  }

  const tokenUrl = `${hmrcBaseUrl()}/oauth/token`;
  const refreshBody = new URLSearchParams({
    client_secret: process.env.HMRC_CLIENT_SECRET!,
    client_id: process.env.HMRC_CLIENT_ID!,
    grant_type: "refresh_token",
    refresh_token: row.refreshToken,
  });

  const refreshResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshBody.toString(),
  });

  if (!refreshResponse.ok) {
    const errText = await refreshResponse.text();
    console.error(`[HMRC-TOKEN] Refresh failed for user ${userId}:`, refreshResponse.status, errText.slice(0, 200));
    return null;
  }

  const data = (await refreshResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresIn = data.expires_in || DEFAULT_EXPIRES_IN_SEC;
  await ctx.runMutation(internal.hmrc_internal.storeTokens, {
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || row.refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    eori: row.eori,
  });

  return data.access_token;
}
