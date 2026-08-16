import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalQuery, mutation, query } from "./_generated/server";
import { canAccessDeclaration } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

async function distinctConversationIdsForDeclaration(
  db: QueryCtx["db"],
  declarationId: Id<"declarations">,
): Promise<string[]> {
  const decl = await db.get(declarationId);
  if (!decl) return [];

  const ids = new Set<string>();
  const add = (id: unknown) => {
    const s = String(id ?? "").trim();
    if (s) ids.add(s);
  };

  add(decl.conversationId);

  const subs = await db
    .query("submissions")
    .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
    .take(100);
  for (const row of subs) add(row.conversationId);

  return [...ids];
}

/**
 * Append-only record of a request sent to HMRC (submit / amend / cancel).
 * Stores the exact request XML, the LRN used and an as-submitted snapshot of
 * the declaration + items. Rows are immutable: there is no update/delete API.
 */
export const recordSubmission = mutation({
  args: {
    declarationId: v.id("declarations"),
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
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
    if (!identity) throw unauthenticatedError();

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }

    return await ctx.db.insert("submissions", {
      declarationId: args.declarationId,
      userId: identity.subject,
      environment: args.environment,
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

/** Persist a CNS attempt before the outbound request is made. */
export const beginCnsAttempt = mutation({
  args: {
    declarationId: v.id("declarations"),
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    operation: v.string(),
    attemptKey: v.string(),
    requestHash: v.string(),
    endpoint: v.string(),
    lrn: v.optional(v.string()),
    eori: v.optional(v.string()),
    priorMrn: v.optional(v.string()),
    requestXml: v.string(),
    declarationSnapshot: v.optional(v.any()),
    itemsSnapshot: v.optional(v.any()),
  },
  returns: v.id("submissions"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .filter((q) => q.eq(q.field("attemptKey"), args.attemptKey))
      .first();
    if (existing) return existing._id;
    const startedAt = Date.now();
    return await ctx.db.insert("submissions", {
      ...args,
      userId: identity.subject,
      transport: "cns_inventory",
      outcome: "pending",
      outcomeCertainty: "unknown",
      startedAt,
      createdAt: startedAt,
    });
  },
});

/** Complete only the transport-result fields of a previously persisted CNS attempt. */
export const completeCnsAttempt = mutation({
  args: {
    submissionId: v.id("submissions"),
    outcome: v.string(),
    hmrcStatus: v.optional(v.number()),
    cspId: v.optional(v.string()),
    outcomeCertainty: v.union(v.literal("certain"), v.literal("unknown")),
    cnsErrorCode: v.optional(v.string()),
    cnsErrorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    const row = await ctx.db.get(args.submissionId);
    if (!row || row.transport !== "cns_inventory") throw userError("cns_attempt_not_found", "CNS attempt not found");
    const decl = await ctx.db.get(row.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }
    await ctx.db.patch(row._id, {
      outcome: args.outcome,
      hmrcStatus: args.hmrcStatus,
      cspId: args.cspId,
      outcomeCertainty: args.outcomeCertainty,
      cnsErrorCode: args.cnsErrorCode,
      cnsErrorMessage: args.cnsErrorMessage,
      completedAt: Date.now(),
    });
    return null;
  },
});

/** Distinct HMRC conversation IDs for pull (submit + amend + cancel on this declaration). */
export const getDistinctConversationIds = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) return [];

    return distinctConversationIdsForDeclaration(ctx.db, args.declarationId);
  },
});

/** Scheduler/cron — no auth; only call from trusted internal actions. */
export const getDistinctConversationIdsInternal = internalQuery({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    return distinctConversationIdsForDeclaration(ctx.db, args.declarationId);
  },
});

/** Owner-scoped read of the submission evidence for one declaration. */
export const getSubmissions = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) return [];

    return await ctx.db
      .query("submissions")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("desc")
      .take(100);
  },
});
