import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { HMRC_CONFIG } from "./hmrc-config";

export async function resolveHmrcAccessToken(
  convex: ConvexHttpClient,
  userId: string,
): Promise<{ token: string } | { error: NextResponse }> {
  const tokenRecord = await convex.query(api.hmrc.getToken, { userId });

  if (!tokenRecord?.accessToken) {
    return {
      error: NextResponse.json(
        { error: "HMRC OAuth Token not found. Please connect your account." },
        { status: 403 },
      ),
    };
  }

  let token = tokenRecord.accessToken;

  if (
    tokenRecord.expiresAt &&
    Date.now() + HMRC_CONFIG.timing.tokenExpiryBufferMs > tokenRecord.expiresAt
  ) {
    if (!tokenRecord.refreshToken) {
      return {
        error: NextResponse.json(
          { error: "HMRC Token expired and no refresh token available. Please reconnect." },
          { status: 403 },
        ),
      };
    }

    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? HMRC_CONFIG.sandboxBaseUrl
        : HMRC_CONFIG.productionBaseUrl;
    const tokenUrl = `${hmrcBase}/oauth/token`;

    const refreshBody = new URLSearchParams({
      client_secret: process.env.HMRC_CLIENT_SECRET!,
      client_id: process.env.HMRC_CLIENT_ID!,
      grant_type: "refresh_token",
      refresh_token: tokenRecord.refreshToken,
    });

    const refreshResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: refreshBody.toString(),
    });

    if (!refreshResponse.ok) {
      // Log the raw HMRC response server-side only — never return it to the
      // client, as it can expose OAuth/token internals.
      const errorText = await refreshResponse.text();
      console.error("[HMRC] Token refresh failed:", refreshResponse.status, errorText);
      return {
        error: NextResponse.json(
          { error: "Failed to refresh HMRC token. Please reconnect." },
          { status: 403 },
        ),
      };
    }

    const data = await refreshResponse.json();
    token = data.access_token;

    await convex.mutation(api.hmrc.saveToken, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || HMRC_CONFIG.timing.defaultTokenExpiryMs,
      eori: tokenRecord.eori,
    });
  }

  return { token };
}
