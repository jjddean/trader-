import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const logSearch = mutation({
    args: {
        query: v.string(),
        category: v.string(), // "companies", "hs_codes"
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;
        const userId = identity.subject;

        await ctx.db.insert("search_history", {
            userId,
            query: args.query,
            category: args.category,
            timestamp: Date.now(),
        });

        // Also log to general audit logs for system tracking
        await ctx.db.insert("auditLogs", {
            userId,
            action: `search_${args.category}`,
            details: { query: args.query },
            timestamp: Date.now(),
        });
    },
});
