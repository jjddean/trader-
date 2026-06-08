import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const saveToken = mutation({
  args: {
    userId: v.optional(v.string()), // Clerk userId — cross-checked against the authenticated identity
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
    eori: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // HMRC tokens are credentials — writes MUST be authenticated. The caller's
    // Convex identity is authoritative; a supplied userId may only match it,
    // never override it (previously an unauthenticated caller could plant
    // tokens under any userId).
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: HMRC token writes require an authenticated session");
    }
    if (args.userId && args.userId !== identity.subject) {
      throw new Error("Forbidden: cannot write HMRC tokens for another user");
    }
    const effectiveUserId = identity.subject;

    const expiresAt = Date.now() + args.expiresIn * 1000;
    
    // Check if user already has a token record
    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", effectiveUserId))
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
        userId: effectiveUserId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt,
        eori: args.eori
      });
    }

    // Securely link this to the user's workspace if one exists
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", effectiveUserId))
      .first();
      
    if (workspace) {
      await ctx.db.patch(workspace._id, {
        hmrcTokensId: tokenId
      });
    }

    // 3. Audit Log Entry
    await ctx.db.insert("auditLogs", {
      userId: effectiveUserId,
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

export const disconnectToken = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);

      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
        .first();
      if (workspace) {
        await ctx.db.patch(workspace._id, { hmrcTokensId: undefined });
      }

      await ctx.db.insert("auditLogs", {
        userId: identity.subject,
        action: "hmrc_auth_disconnected",
        details: JSON.stringify({ timestamp: Date.now() }),
        timestamp: Date.now(),
      });
    }
  },
});

export const getToken = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Token rows contain access AND refresh tokens — never serve them to an
    // unauthenticated caller, and never to a caller asking for another user's
    // tokens. The authenticated identity is the only key we trust.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (args.userId && args.userId !== identity.subject) return null;

    return await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
  },
});
