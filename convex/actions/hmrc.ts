"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const HMRC_CLIENT_ID = process.env.HMRC_CLIENT_ID;
const HMRC_CLIENT_SECRET = process.env.HMRC_CLIENT_SECRET;
const HMRC_REDIRECT_URI = process.env.HMRC_REDIRECT_URI;
const HMRC_ENVIRONMENT = process.env.HMRC_ENVIRONMENT || "sandbox";
const HMRC_SCOPES = process.env.HMRC_SCOPES || "write:customs-declaration write:customs-declarations-information";

const AUTH_BASE_URL = HMRC_ENVIRONMENT === "sandbox"
    ? "https://test-api.service.hmrc.gov.uk/oauth/authorize"
    : "https://api.service.hmrc.gov.uk/oauth/authorize";

const TOKEN_BASE_URL = HMRC_ENVIRONMENT === "sandbox"
    ? "https://test-api.service.hmrc.gov.uk/oauth/token"
    : "https://api.service.hmrc.gov.uk/oauth/token";

export const getHmrcAuthUrl = action({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        if (!HMRC_CLIENT_ID || !HMRC_REDIRECT_URI) {
            throw new Error("HMRC environment variables (HMRC_CLIENT_ID, HMRC_REDIRECT_URI) are missing in Convex dashboard.");
        }

        const params = new URLSearchParams({
            client_id: HMRC_CLIENT_ID!,
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

        const response = await fetch(TOKEN_BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: args.code,
                redirect_uri: HMRC_REDIRECT_URI!,
                client_id: HMRC_CLIENT_ID!,
                client_secret: HMRC_CLIENT_SECRET!,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HMRC Token Error: ${error}`);
        }

        const data = await response.json();
        const expiresAt = Date.now() + (data.expires_in * 1000);

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

type HmrcStatus = {
    connected: boolean;
    isExpired?: boolean;
    eori?: string;
};

export const getHmrcStatus = action({
    args: {},
    handler: async (ctx): Promise<HmrcStatus> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { connected: false };

        const tokens: { expiresAt: number; eori?: string } | null = await ctx.runQuery(internal.hmrc_internal.getTokens, {
            userId: identity.subject,
        });

        if (!tokens) return { connected: false };

        const isExpired: boolean = Date.now() > (tokens.expiresAt ?? 0);

        return {
            connected: true,
            isExpired,
            eori: tokens.eori,
        };
    },
});
