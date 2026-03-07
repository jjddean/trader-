import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const calculateLandedCost = mutation({
    args: {
        hsCode: v.string(),
        originCountry: v.string(),
        itemValue: v.number(), // The value of the goods
        shippingCost: v.number(),
        dutyRate: v.number(), // Percentage (e.g., 12 for 12%)
        vatRate: v.number(), // Percentage (e.g., 20)
    },
    handler: async (ctx, args) => {
        const { itemValue, shippingCost, dutyRate, vatRate } = args;

        // 1. Calculate CIF (Cost, Insurance, Freight) - assuming shipping includes insurance for MVP
        const cifValue = itemValue + shippingCost;

        // 2. Calculate Duty
        const dutyAmount = (cifValue * dutyRate) / 100;

        // 3. Calculate VAT (VAT is calculated on [CIF + Duty])
        const vatBase = cifValue + dutyAmount;
        const vatAmount = (vatBase * vatRate) / 100;

        // 4. Total Landed Cost
        const totalLandedCost = cifValue + dutyAmount + vatAmount;

        const results = {
            cifValue,
            dutyAmount,
            vatAmount,
            totalLandedCost,
            timestamp: Date.now(),
        };

        // Log to history if user is authenticated
        const identity = await ctx.auth.getUserIdentity();
        if (identity) {
            await ctx.db.insert("calculator_history", {
                userId: identity.subject,
                hsCode: args.hsCode,
                originCountry: args.originCountry,
                value: itemValue,
                dutyRate: dutyRate,
                totalLandedCost: totalLandedCost,
                timestamp: Date.now(),
            });
        }

        return results;
    },
});

export const getHistory = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        return await ctx.db
            .query("calculator_history")
            .withIndex("by_user", (q) => q.eq("userId", identity.subject))
            .order("desc")
            .take(10);
    },
});
