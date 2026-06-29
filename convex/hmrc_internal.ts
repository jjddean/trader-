import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { encryptHmrcTokensForStorage } from "./lib/hmrc_token_row";

const hmrcEnvironment = v.union(v.literal("sandbox"), v.literal("production"));
type HmrcEnvironment = "sandbox" | "production";

export const storeTokens = internalMutation({
  args: {
    userId: v.string(),
    environment: hmrcEnvironment,
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    expiresAt: v.number(),
    eori: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user_and_environment", (q) =>
        q.eq("userId", args.userId).eq("environment", args.environment),
      )
      .first();

    const legacySandbox =
      !existing && args.environment === "sandbox"
        ? await ctx.db
            .query("hmrc_tokens")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first()
        : null;

    const row = existing ?? legacySandbox;
    const tokenPatch = {
      environment: args.environment,
      accessToken: undefined,
      refreshToken: undefined,
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted,
      expiresAt: args.expiresAt,
      eori: args.eori ?? row?.eori,
    };
    if (row) {
      await ctx.db.patch(row._id, tokenPatch);
    } else {
      await ctx.db.insert("hmrc_tokens", {
        userId: args.userId,
        ...tokenPatch,
      });
    }
  },
});

/** OAuth connection status only — never returns access/refresh tokens to the client. */
export const getTokens = query({
  args: {
    userId: v.string(),
    environment: v.optional(hmrcEnvironment),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) return null;

    const environment: HmrcEnvironment = args.environment ?? "sandbox";
    const row = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user_and_environment", (q) =>
        q.eq("userId", args.userId).eq("environment", environment),
      )
      .first();

    const legacySandbox =
      !row && environment === "sandbox"
        ? await ctx.db
            .query("hmrc_tokens")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first()
        : null;

    const tokenRow = row ?? legacySandbox;
    if (!tokenRow) return null;
    return {
      connected: true,
      environment,
      expiresAt: tokenRow.expiresAt,
      eori: tokenRow.eori ?? null,
    };
  },
});

/** One-time migration: encrypt legacy plaintext hmrc_tokens rows. Requires HMRC_TOKEN_ENCRYPTION_KEY. */
export const encryptLegacyHmrcTokens = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.limit ?? 100, 500);
    const rows = await ctx.db.query("hmrc_tokens").take(batchSize);
    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
      const hasPlain =
        (typeof row.accessToken === "string" && row.accessToken.length > 0) ||
        (typeof row.refreshToken === "string" && row.refreshToken.length > 0);
      const alreadyEncrypted =
        typeof row.accessTokenEncrypted === "string" && row.accessTokenEncrypted.length > 0;
      if (!hasPlain || alreadyEncrypted) {
        skipped += 1;
        continue;
      }

      const accessToken = typeof row.accessToken === "string" ? row.accessToken : "";
      if (!accessToken) {
        skipped += 1;
        continue;
      }
      const refreshToken = typeof row.refreshToken === "string" ? row.refreshToken : undefined;
      const { accessTokenEncrypted, refreshTokenEncrypted } = await encryptHmrcTokensForStorage(
        accessToken,
        refreshToken,
      );
      await ctx.db.patch(row._id, {
        accessToken: undefined,
        refreshToken: undefined,
        accessTokenEncrypted,
        refreshTokenEncrypted,
      });
      migrated += 1;
    }

    return { scanned: rows.length, migrated, skipped };
  },
});