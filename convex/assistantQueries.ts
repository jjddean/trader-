import { query } from "./_generated/server";
import { v } from "convex/values";

export const getDeclarationContextForAI = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration) throw new Error("Target declaration entry missing");

    // Dynamically query your workspace structure safely using 'as any'
    const targetWorkspaceId = (declaration as any).workspaceId || (declaration as any).orgId;
    const workspace = targetWorkspaceId ? await ctx.db.get(targetWorkspaceId) : null;

    // Safely collect past data stream without forcing index compilation breaks
    const history = await ctx.db
      .query("messages" as any)
      .collect();

    const filteredHistory = history
      .filter((msg: any) => msg.declarationId === args.declarationId)
      .slice(-10);

    return {
      status: declaration.status ?? "UNKNOWN",
      conversationId: declaration.conversationId ?? "NO_ID",
      estimatedDutyGBP: (declaration as any).estimatedDutyGBP ?? 0,
      estimatedVatGBP: (declaration as any).estimatedVatGBP ?? 0,
      rawHmrcErrorLogs: (declaration as any).rawHmrcErrorLogs ?? "",
      isUKEstablished: workspace ? ((workspace as any).isUKEstablished ?? true) : true,
      workspaceId: targetWorkspaceId ?? "",
      chatHistory: filteredHistory,
    };
  },
});
