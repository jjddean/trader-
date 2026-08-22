/**
 * Persistence for ENS outcomes and advanced notifications.
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md` §5–6
 *
 * These mutations are the `persist` half of the collector's
 * list → retrieve → **persist** → acknowledge sequence
 * (`src/lib/ens/ens-collector.ts`). They must complete before the caller
 * issues HMRC's DELETE, because that DELETE is a destructive read.
 *
 * Both tables are append-only evidence. `acknowledgedAt` is stamped by a
 * separate mutation, after HMRC confirms the acknowledgement — so a row can
 * exist unacknowledged, but never acknowledged-without-a-row.
 */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { canAccessDeclaration } from "./lib/org_access";
import { forbiddenError, unauthenticatedError } from "./lib/user_errors";

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
  if (!identity) throw unauthenticatedError();
  return identity;
}

/**
 * Store a collected outcome and move the declaration to its resolved state.
 *
 * Idempotent on `correlationId` + `outcomeType`: a retry after a crash between
 * persist and acknowledge must not create a second row.
 */
export const recordOutcome = mutation({
  args: {
    correlationId: v.string(),
    outcomeType: v.string(),
    movementReferenceNumber: v.optional(v.string()),
    errors: v.optional(v.any()),
    rawXml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    const declaration = await ctx.db
      .query("ens_declarations")
      .withIndex("by_correlationId", (q) => q.eq("correlationId", args.correlationId))
      .first();
    if (declaration && !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    const existing = await ctx.db
      .query("ens_outcomes")
      .withIndex("by_correlationId", (q) => q.eq("correlationId", args.correlationId))
      .collect();
    const duplicate = existing.find((o) => o.outcomeType === args.outcomeType);
    if (duplicate) return duplicate._id;

    const now = Date.now();
    const outcomeId = await ctx.db.insert("ens_outcomes", {
      ensDeclarationId: declaration?._id,
      orgId: declaration?.orgId,
      correlationId: args.correlationId,
      outcomeType: args.outcomeType,
      movementReferenceNumber: args.movementReferenceNumber,
      errors: args.errors,
      rawXml: args.rawXml,
      receivedAt: now,
    });

    if (declaration) {
      const accepted = args.outcomeType === "IE328" || args.outcomeType === "IE304";
      await ctx.db.patch(declaration._id, {
        status: accepted ? "accepted" : "rejected",
        // Only an acceptance carries an MRN; never clear an existing one on a
        // later rejection of an amendment.
        ...(args.movementReferenceNumber
          ? { movementReferenceNumber: args.movementReferenceNumber }
          : {}),
        updatedAt: now,
      });
    }
    return outcomeId;
  },
});

/** Stamp an outcome acknowledged. Called only after HMRC's DELETE succeeds. */
export const markOutcomeAcknowledged = mutation({
  args: { id: v.id("ens_outcomes") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw forbiddenError();
    if (row.ensDeclarationId) {
      const declaration = await ctx.db.get(row.ensDeclarationId);
      if (!(await canAccessDeclaration(ctx, identity.subject, declaration))) throw forbiddenError();
    }
    await ctx.db.patch(args.id, { acknowledgedAt: Date.now() });
    return args.id;
  },
});

/**
 * Store a collected advanced notification.
 *
 * Idempotent on `notificationId`. `doNotLoad` is stored as its own column
 * rather than derived at read time so a stop condition is findable by index,
 * without parsing XML.
 */
export const recordNotification = mutation({
  args: {
    notificationId: v.string(),
    correlationId: v.optional(v.string()),
    movementReferenceNumber: v.optional(v.string()),
    interventions: v.optional(v.any()),
    doNotLoad: v.boolean(),
    rawXml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    const existing = await ctx.db
      .query("ens_notifications")
      .withIndex("by_notificationId", (q) => q.eq("notificationId", args.notificationId))
      .first();
    if (existing) return existing._id;

    let declaration = null;
    if (args.correlationId) {
      declaration = await ctx.db
        .query("ens_declarations")
        .withIndex("by_correlationId", (q) => q.eq("correlationId", args.correlationId!))
        .first();
    }
    if (declaration && !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    return await ctx.db.insert("ens_notifications", {
      ensDeclarationId: declaration?._id,
      orgId: declaration?.orgId,
      notificationId: args.notificationId,
      correlationId: args.correlationId,
      movementReferenceNumber: args.movementReferenceNumber,
      interventions: args.interventions,
      doNotLoad: args.doNotLoad,
      rawXml: args.rawXml,
      receivedAt: Date.now(),
    });
  },
});

export const markNotificationAcknowledged = mutation({
  args: { id: v.id("ens_notifications") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw forbiddenError();
    if (row.ensDeclarationId) {
      const declaration = await ctx.db.get(row.ensDeclarationId);
      if (!(await canAccessDeclaration(ctx, identity.subject, declaration))) throw forbiddenError();
    }
    await ctx.db.patch(args.id, { acknowledgedAt: Date.now() });
    return args.id;
  },
});

/**
 * Outstanding Do Not Load notifications for the active tenant.
 *
 * Its own query so the dashboard can surface a stop condition without loading
 * declarations first — a DNL that needs opening a record to discover is a DNL
 * that gets missed.
 */
export const listOpenDoNotLoad = query({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return [];
    const rows = await ctx.db
      .query("ens_notifications")
      .withIndex("by_doNotLoad", (q) => q.eq("doNotLoad", true))
      .collect();
    const visible = [];
    for (const row of rows) {
      if (row.acknowledgedAt) continue;
      const declaration = row.ensDeclarationId ? await ctx.db.get(row.ensDeclarationId) : null;
      // A notification with no matched declaration is still shown: an
      // unmatched DNL is more dangerous than a noisy one.
      if (!declaration || (await canAccessDeclaration(ctx, identity.subject, declaration))) {
        visible.push(row);
      }
    }
    return visible.sort((a, b) => b.receivedAt - a.receivedAt);
  },
});
