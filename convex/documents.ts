import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const trackUpload = mutation({
  args: {
    declarationId: v.id("declarations"),
    fileName: v.string(),
    fileSize: v.number(),
    documentType: v.string(),
    uploadStatus: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", args);
  }
});
