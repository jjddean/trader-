"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";

/**
 * Deprecated: HMRC OAuth must start at the Next.js route so it can bind Clerk,
 * Convex auth, state, and PKCE verifier cookies/storage in one request.
 */
export const getHmrcAuthUrl = action({
  args: {},
  handler: async () => {
    throw new Error("HMRC OAuth must be initiated via /api/hmrc/auth so PKCE and state are bound to the session.");
  },
});

/**
 * Deprecated: the Next.js callback exchanges the code because it has access to
 * the Clerk session and the PKCE verifier created at /api/hmrc/auth.
 */
export const handleHmrcCallback = action({
  args: { code: v.string() },
  handler: async () => {
    throw new Error("HMRC OAuth callback must be handled by /auth/hmrc/callback so PKCE and session checks are enforced.");
  },
});

export const syncAllUsersHMRC = action({
  args: { secret: v.string() },
  handler: async () => {
    // Placeholder for global sync
    console.log("Global sync triggered");
    return { success: true };
  },
});
