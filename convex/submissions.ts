import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Append-only record of a request sent to HMRC (submit / amend / cancel).
 * Stores the exact request XML, the LRN used and an as-submitted snapshot of
 * the declaration + items. Rows are immutable: there is no update/delete API.
 */
export const recordSubmission = mutation({
  args: {
    declarationId: v.id("declarations"),
    operation: v.string(),
    outcome: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    lrn: v.optional(v.string()),
    eori: v.optional(v.string()),
    priorMrn: v.optional(v.string()),
    hmrcStatus: v.optional(v.number()),
    requestXml: v.string(),
    declarationSnapshot: v.optional(v.any()),
    itemsSnapshot: v.optional(v.any()),
  },
  returns: v.id("submissions"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || decl.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.insert("submissions", {
      declarationId: args.declarationId,
      userId: identity.subject,
      operation: args.operation,
      outcome: args.outcome,
      conversationId: args.conversationId,
      lrn: args.lrn,
      eori: args.eori,
      priorMrn: args.priorMrn,
      hmrcStatus: args.hmrcStatus,
      requestXml: args.requestXml,
      declarationSnapshot: args.declarationSnapshot,
      itemsSnapshot: args.itemsSnapshot,
      createdAt: Date.now(),
    });
  },
});

/** Owner-scoped read of the submission evidence for one declaration. */
export const getSubmissions = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || decl.userId !== identity.subject) return [];

    return await ctx.db
      .query("submissions")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("desc")
      .take(100);
  },
});
