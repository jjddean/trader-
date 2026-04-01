import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
    };

    return results;
  },
});
