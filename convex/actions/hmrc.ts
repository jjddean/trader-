"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { hmrcOAuthBaseUrl, hmrcOAuthCredentials } from "../lib/hmrc_oauth";

const HMRC_REDIRECT_URI = process.env.HMRC_REDIRECT_URI;
const HMRC_SCOPES =
  process.env.HMRC_SCOPES || "write:customs-declaration write:customs-declarations-information";

const AUTH_BASE_URL = `${hmrcOAuthBaseUrl()}/oauth/authorize`;
const TOKEN_BASE_URL = `${hmrcOAuthBaseUrl()}/oauth/token`;

export const getHmrcAuthUrl = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    if (!HMRC_REDIRECT_URI) {
      throw new Error(
        "HMRC environment variables (HMRC_REDIRECT_URI) are missing in Convex dashboard.",
      );
    }

    const { clientId } = hmrcOAuthCredentials();
    if (!clientId) {
      throw new Error(
        "HMRC OAuth client ID missing in Convex dashboard (HMRC_PRODUCTION_CLIENT_ID for TDR).",
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: HMRC_REDIRECT_URI!,
      response_type: "code",
      scope: HMRC_SCOPES,
    });

    return `${AUTH_BASE_URL}?${params.toString()}`;
  },
});

export const handleHmrcCallback = action({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const { clientId, clientSecret } = hmrcOAuthCredentials();

    const response = await fetch(TOKEN_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: HMRC_REDIRECT_URI!,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HMRC Token Error: ${error}`);
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    await ctx.runMutation(internal.hmrc_internal.storeTokens, {
      userId: identity.subject,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      eori: process.env.HMRC_EORI, // Default for now
    });

    return { success: true };
  },
});

export const syncAllUsersHMRC = action({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    // Placeholder for global sync
    console.log("Global sync triggered");
    return { success: true };
  },
});
