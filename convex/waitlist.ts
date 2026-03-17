import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Check if email is already on the list
    const existing = await ctx.db
      .query("waitlist_leads")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return { success: true, message: "You are already on the waitlist!" };
    }

    // Add to waitlist
    await ctx.db.insert("waitlist_leads", {
      email: args.email,
      status: "pending",
      timestamp: Date.now(),
    });

    return { success: true, message: "Successfully added to the waitlist!" };
  },
});
