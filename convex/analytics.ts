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
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("countryOfOriginCode"), args.originCountry))
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

export const getDashboardAnalytics = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const records = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(2000);

    // Group by month
    const monthlyData: Record<string, { value: number; duty: number }> = {};
    const hsCodeExposure: Record<string, number> = {};

    for (const r of records) {
      const date = new Date(r.createdAt || Date.now());
      const monthKey = date.toLocaleString("en-GB", { month: "short", year: "2-digit" });
      
      const val = Number(r.itemCustomsValue) || 0;
      const duty = Number(r.taxLineTotalAmount) || 0;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { value: 0, duty: 0 };
      }
      monthlyData[monthKey].value += val;
      monthlyData[monthKey].duty += duty;

      if (r.commodityCode) {
        const prefix = r.commodityCode.substring(0, 4);
        hsCodeExposure[prefix] = (hsCodeExposure[prefix] || 0) + val;
      }
    }

    const volumeChart = Object.entries(monthlyData).map(([name, data]) => ({
      name,
      ...data,
    })).reverse().slice(-6);

    const exposureChart = Object.entries(hsCodeExposure)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      volumeChart,
      exposureChart,
    };
  },
});
