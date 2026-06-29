"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { encryptHmrcTokensForStorage } from "../lib/hmrc_token_row";

/** Encrypt OAuth tokens outside mutations — AES-GCM needs random IV (non-deterministic). */
export const encryptOAuthTokens = action({
  args: {
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
  },
  returns: v.object({
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    return await encryptHmrcTokensForStorage(args.accessToken, args.refreshToken);
  },
});
