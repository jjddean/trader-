import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateCommodityCodeFromChat = mutation({
  args: {
    declarationId: v.id("declarations"),
    commodityCode: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^[0-9]{10}$/.test(args.commodityCode)) {
      throw new Error("Invalid structure: Commodity codes must be exactly 10 digits.");
    }
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration) throw new Error("Target declaration tracking record missing");

    await ctx.db.patch(args.declarationId, {
      commodityCode: args.commodityCode,
    });
    return { success: true, updatedCode: args.commodityCode };
  },
});

export const appendChatMessage = mutation({
  args: {
    workspaceId: v.any(),
    declarationId: v.id("declarations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages" as any, {
      workspaceId: args.workspaceId,
      declarationId: args.declarationId,
      role: args.role,
      body: args.body,
      createdAt: Date.now(),
    });
  },
});
