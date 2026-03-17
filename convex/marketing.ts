import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const joinEarlyAccess = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("early_access_emails")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return { success: true, message: "Email already registered." };
    }

    await ctx.db.insert("early_access_emails", {
      email: args.email,
      createdAt: Date.now(),
    });

    return { success: true, message: "Successfully joined early access." };
  },
});
