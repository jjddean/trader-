import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const storeTokens = internalMutation({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    eori: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        eori: args.eori ?? existing.eori,
      });
    } else {
      await ctx.db.insert("hmrc_tokens", {
        userId: args.userId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        eori: args.eori,
      });
    }
  },
});

/** OAuth connection status only — never returns access/refresh tokens to the client. */
export const getTokens = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) return null;
    const row = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!row) return null;
    return {
      connected: true,
      expiresAt: row.expiresAt,
      eori: row.eori ?? null,
    };
  },
});
