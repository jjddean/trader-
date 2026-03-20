import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const saveDocument = mutation({
  args: {
    storageId: v.id("_storage"),
    userId: v.string(),
    fileName: v.string(),
    mrn: v.optional(v.string()),
    declarationId: v.optional(v.id("declarations")),
    auditStatus: v.optional(v.string()),
    fileType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      fileId: args.storageId,
      userId: args.userId,
      fileName: args.fileName,
      mrn: args.mrn,
      declarationId: args.declarationId,
      status: "pending_hmrc",
      auditStatus: args.auditStatus || "pending",
      uploadDate: new Date().toISOString()
    });
  }
});

export const getDocuments = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  }
});
