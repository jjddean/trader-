import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getLanes = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tradeLanes")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    },
});

export const createLane = mutation({
    args: {
        userId: v.string(),
        originCountry: v.string(),
        commodityCode: v.string(),
        description: v.string(),
        tier: v.string(),
        status: v.string(),
        savingsEstimate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const laneId = await ctx.db.insert("tradeLanes", {
            ...args,
            lastVerified: Date.now(),
        });

        await ctx.db.insert("auditLogs", {
            userId: args.userId,
            action: "lane_created",
            details: { laneId, originCountry: args.originCountry },
            timestamp: Date.now(),
        });

        return laneId;
    },
});
