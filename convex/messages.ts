import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByLane = query({
  args: { laneId: v.id("tradeLanes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_lane", (q) => q.eq("laneId", args.laneId))
      .order("desc")
      .collect();
  },
});

export const saveDraft = mutation({
  args: {
    laneId: v.id("tradeLanes"),
    prospectId: v.optional(v.id("prospects")),
    content: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      laneId: args.laneId,
      prospectId: args.prospectId,
      sender: "user",
      channel: "draft",
      content: args.content,
      status: "draft",
      createdAt: Date.now(),
      userId: args.userId,
    });


    return id;
  },
});
