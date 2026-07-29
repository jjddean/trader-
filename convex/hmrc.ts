import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { canAccessDeclaration } from "./lib/org_access";
const hmrcEnvironment = v.union(v.literal("sandbox"), v.literal("production"));
type HmrcEnvironment = "sandbox" | "production";

export const saveToken = mutation({
  args: {
    userId: v.optional(v.string()), // Clerk userId — cross-checked against the authenticated identity
    environment: hmrcEnvironment,
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    expiresIn: v.number(),
    eori: v.optional(v.string()),
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
    const email =
      typeof identity.email === "string" && identity.email.trim()
        ? identity.email.trim()
        : undefined;
    const name =
      typeof identity.name === "string" && identity.name.trim()
        ? identity.name.trim()
        : undefined;

    // Ensure admin Platform users / HMRC connection tables can resolve this
    // account — HMRC connect must not leave a token with no users row.
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", effectiveUserId))
      .unique();
    if (existingUser) {
      const patch: Record<string, string> = {};
      if (email && existingUser.email !== email) patch.email = email;
      if (name && existingUser.name !== name) patch.name = name;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existingUser._id, patch);
      }
    } else {
      await ctx.db.insert("users", {
        clerkId: effectiveUserId,
        email,
        name,
        role: "user",
      });
    }

    const expiresAt = Date.now() + args.expiresIn * 1000;

    const tokenPatch = {
      environment: args.environment,
      accessToken: undefined,
      refreshToken: undefined,
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted,
      expiresAt,
      eori: args.eori,
    };

    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user_and_environment", (q) =>
        q.eq("userId", effectiveUserId).eq("environment", args.environment),
      )
      .first();

    let tokenId;
    if (existing) {
      tokenId = existing._id;
      await ctx.db.patch(existing._id, tokenPatch);
    } else {
      tokenId = await ctx.db.insert("hmrc_tokens", {
        userId: effectiveUserId,
        ...tokenPatch,
      });
    }

    await ctx.db.insert("auditLogs", {
      userId: effectiveUserId,
      action: "hmrc_auth_linked",
      details: JSON.stringify({
        environment: args.environment,
        eori: args.eori,
        expiresAt,
      }),
      timestamp: Date.now(),
    });

    return tokenId;
  },
});

export const disconnectToken = mutation({
  args: { environment: v.optional(hmrcEnvironment) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const environment: HmrcEnvironment = args.environment ?? "sandbox";
    const existing = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user_and_environment", (q) =>
        q.eq("userId", identity.subject).eq("environment", environment),
      )
      .first();

    const legacySandbox =
      !existing && environment === "sandbox"
        ? await ctx.db
            .query("hmrc_tokens")
            .withIndex("by_user", (q) => q.eq("userId", identity.subject))
            .first()
        : null;

    const row = existing ?? legacySandbox;
    if (row) {
      await ctx.db.delete(row._id);

      await ctx.db.insert("auditLogs", {
        userId: identity.subject,
        action: "hmrc_auth_disconnected",
        details: JSON.stringify({ environment, timestamp: Date.now() }),
        timestamp: Date.now(),
      });
    }
  },
});

/** OAuth connection status only — never returns access/refresh tokens to the client. */
export const getToken = query({
  args: {
    userId: v.optional(v.string()),
    environment: v.optional(hmrcEnvironment),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (args.userId && args.userId !== identity.subject) return null;

    const environment: HmrcEnvironment = args.environment ?? "sandbox";
    const row = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user_and_environment", (q) =>
        q.eq("userId", identity.subject).eq("environment", environment),
      )
      .first();

    const legacySandbox =
      !row && environment === "sandbox"
        ? await ctx.db
            .query("hmrc_tokens")
            .withIndex("by_user", (q) => q.eq("userId", identity.subject))
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

/** Schedule delayed notification pulls via Convex (reliable on serverless — not setTimeout). */
export const scheduleNotificationPulls = mutation({
  args: {
    declarationId: v.id("declarations"),
    conversationId: v.string(),
    environment: v.optional(hmrcEnvironment),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw new Error("Unauthorized");
    }

    const environment = args.environment ?? "sandbox";
    const delaysMs = [0, 4000, 12000, 30000];
    for (const delayMs of delaysMs) {
      await ctx.scheduler.runAfter(delayMs, internal.hmrc_actions.pullNotificationsScheduled, {
        userId: identity.subject,
        declarationId: args.declarationId,
        conversationId: args.conversationId,
        environment,
        source: delayMs === 0 ? "scheduled_immediate" : `scheduled_${delayMs}ms`,
      });
    }
    return null;
  },
});

const PKCE_TTL_MS = 10 * 60 * 1000;

export const storeOAuthPkce = mutation({
  args: {
    stateNonce: v.string(),
    codeVerifier: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const existing = await ctx.db
      .query("hmrc_oauth_pkce")
      .withIndex("by_stateNonce", (q) => q.eq("stateNonce", args.stateNonce))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("hmrc_oauth_pkce", {
      stateNonce: args.stateNonce,
      userId: identity.subject,
      codeVerifier: args.codeVerifier,
      expiresAt: Date.now() + PKCE_TTL_MS,
    });
  },
});

export const consumeOAuthPkce = mutation({
  args: {
    stateNonce: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const row = await ctx.db
      .query("hmrc_oauth_pkce")
      .withIndex("by_stateNonce", (q) => q.eq("stateNonce", args.stateNonce))
      .first();

    if (!row || row.userId !== identity.subject) {
      return null;
    }

    await ctx.db.delete(row._id);

    if (row.expiresAt < Date.now()) {
      return null;
    }

    return row.codeVerifier;
  },
});