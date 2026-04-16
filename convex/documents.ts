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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    // Verify ownership of parent declaration
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || declaration.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.insert("documents", {
      ...args,
      userId: identity.subject
    });
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
    ocrText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    return await ctx.db.insert("documents", {
      fileId: args.storageId,
      userId: identity.subject, // Enforce session ID
      fileName: args.fileName,
      mrn: args.mrn,
      declarationId: args.declarationId,
      status: "pending_hmrc",
      auditStatus: args.auditStatus || "pending",
      ocrText: args.ocrText,
      uploadDate: new Date().toISOString()
    });
  }
});

export const getDocuments = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("documents")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .order("desc")
      .take(200);
  }
});
