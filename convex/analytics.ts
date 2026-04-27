import { v } from "convex/values";
import { query } from "./_generated/server";

export const suggestFromHistory = query({
  args: {
    originCountry: v.string(),
    userId: v.optional(v.string()), // Kept optional for backward compatibility
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { hsCode: null, confidence: 0 };

    const records = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user_country", (q) =>
        q.eq("userId", identity.subject).eq("countryOfOriginCode", args.originCountry),
      )
      .take(1000);

    if (records.length === 0) return { hsCode: null, confidence: 0 };

    // Simply pick the most frequent for now
    const counts: Record<string, number> = {};
    for (const r of records) {
      if (r.commodityCode) {
        counts[r.commodityCode] = (counts[r.commodityCode] || 0) + 1;
      }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      hsCode: sorted[0][0],
      confidence: Math.round((sorted[0][1] / records.length) * 100),
    };
  },
});

