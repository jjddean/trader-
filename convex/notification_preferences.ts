/**
 * Per-user notification preferences, merged over the category defaults in
 * convex/lib/notification_events.ts.
 *
 * A category with no stored row uses its default, so nothing needs backfilling
 * and defaults can be retuned later without rewriting anyone's settings. Only a
 * category the user has actually touched has a row.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getActiveOrgId } from "./lib/org_access";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "./lib/notification_events";
import { unauthenticatedError, userError } from "./lib/user_errors";

const CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[];

/**
 * Every category with its effective setting for the calling user. Returns the
 * full list rather than only stored rows so the settings page can render without
 * knowing the catalogue itself.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      category: v.string(),
      label: v.string(),
      description: v.string(),
      inApp: v.boolean(),
      email: v.boolean(),
      locked: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const orgId = (await getActiveOrgId(ctx, identity.subject)) || undefined;

    const stored = await ctx.db
      .query("notification_preferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const byCategory = new Map(
      stored.filter((row) => (row.orgId || undefined) === orgId).map((row) => [row.category, row]),
    );

    return CATEGORY_KEYS.map((category) => {
      const definition = NOTIFICATION_CATEGORIES[category];
      const row = byCategory.get(category);
      const locked = definition.locked === true;
      return {
        category,
        label: definition.label,
        description: definition.description,
        // A locked category always reports on, whatever a stale row says.
        inApp: locked ? true : (row?.inApp ?? definition.defaultInApp),
        email: row?.email ?? false,
        locked,
      };
    });
  },
});

export const set = mutation({
  args: {
    category: v.string(),
    inApp: v.optional(v.boolean()),
    email: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const definition = NOTIFICATION_CATEGORIES[args.category as NotificationCategory];
    if (!definition) {
      throw userError("invalid_category", "That notification category does not exist.");
    }
    if (definition.locked) {
      // Rejected rather than silently ignored, so a UI that wrongly renders a
      // toggle for a locked category fails visibly in development.
      throw userError(
        "category_locked",
        "This category carries compliance outcomes and cannot be switched off.",
      );
    }

    const orgId = (await getActiveOrgId(ctx, identity.subject)) || undefined;
    const now = Date.now();

    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_user_org_category", (q) =>
        q.eq("userId", identity.subject).eq("orgId", orgId).eq("category", args.category),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        inApp: args.inApp ?? existing.inApp,
        email: args.email ?? existing.email,
        updatedAt: now,
      });
      return null;
    }

    await ctx.db.insert("notification_preferences", {
      userId: identity.subject,
      orgId,
      category: args.category,
      inApp: args.inApp ?? definition.defaultInApp,
      email: args.email ?? false,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});
