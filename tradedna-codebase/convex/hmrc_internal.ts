import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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

export const getTokens = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
