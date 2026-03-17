import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const saveToken = mutation({
  args: {
    userId: v.string(), // Clerk userId
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
    eori: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const expiresAt = Date.now() + args.expiresIn * 1000;
    
    // Check if user already has a token record
    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
      
    let tokenId;
    if (existing) {
      tokenId = existing._id;
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt,
        eori: args.eori
      });
    } else {
      tokenId = await ctx.db.insert("hmrc_tokens", {
        userId: args.userId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt,
        eori: args.eori
      });
    }

    // Securely link this to the user's workspace if one exists
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .first();
      
    if (workspace) {
      await ctx.db.patch(workspace._id, {
        hmrcTokensId: tokenId
      });
    }
    
    return tokenId;
  },
});

export const getToken = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
