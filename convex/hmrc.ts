import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const saveToken = mutation({
  args: {
    userId: v.string(), // Clerk userId
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
    eori: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const expiresAt = Date.now() + args.expiresIn * 1000;
    
    // Check if user already has a token record
    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
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
        userId: identity.subject,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt,
        eori: args.eori
      });
    }

    // Securely link this to the user's workspace if one exists
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .first();
      
    if (workspace) {
      await ctx.db.patch(workspace._id, {
        hmrcTokensId: tokenId
      });
    }

    // 3. Audit Log Entry
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "hmrc_auth_linked",
      details: JSON.stringify({
        eori: args.eori,
        expiresAt: expiresAt
      }),
      timestamp: Date.now()
    });
    
    return tokenId;
  },
});

export const getToken = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
  },
});
