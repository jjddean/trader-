/**
 * Read and write API for the in-app inbox (`app_notifications`).
 *
 * Every function here is auth-gated and tenant-scoped. Rows are addressed to a
 * single recipient by fan-out, so scoping is an index lookup on
 * `(userId, orgId)` rather than a post-filter — which is what keeps the unread
 * count a single indexed read instead of a client-side count over a truncated
 * page, the defect in the old bell.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getActiveOrgId } from "./lib/org_access";
import { isUrgentSeverity } from "./lib/notification_events";
import { forbiddenError, unauthenticatedError } from "./lib/user_errors";

/** Display caps at "99+", so counting beyond that is wasted work. */
const COUNT_CAP = 100;

const filterValidator = v.union(v.literal("all"), v.literal("unread"), v.literal("urgent"));

/**
 * "Urgent" is an action queue, not a severity archive: it means unread *and*
 * urgent. An already-read alert has been seen, so leaving it in the tab — and in
 * the tab's count — would keep the badge lit over resolved work. Both filters
 * are therefore subsets of unread and read the same index, so a tab's number and
 * its list can never disagree.
 */

/**
 * Recipient scope for the calling user: their id plus the org they are currently
 * acting in. A user in two orgs sees only the active org's notifications.
 */
async function callerScope(ctx: Parameters<typeof getActiveOrgId>[0]) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const userId = identity.subject;
  const activeOrgId = await getActiveOrgId(ctx, userId);
  return { userId, orgId: activeOrgId || undefined };
}

/** Most recent notifications for the panel. */
export const listRecent = query({
  args: { limit: v.optional(v.number()), filter: v.optional(filterValidator) },
  handler: async (ctx, args) => {
    const scope = await callerScope(ctx);
    if (!scope) return [];

    const filter = args.filter ?? "all";
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    // Both narrowed filters are subsets of unread, so both read the unread
    // index. Reading the newest page and filtering afterwards would silently
    // drop urgent rows sitting behind a run of ordinary ones.
    if (filter === "unread" || filter === "urgent") {
      const unread = await ctx.db
        .query("app_notifications")
        .withIndex("by_user_org_read", (q) =>
          q.eq("userId", scope.userId).eq("orgId", scope.orgId).eq("readAt", undefined),
        )
        .order("desc")
        .take(filter === "unread" ? limit : COUNT_CAP);

      return filter === "unread"
        ? unread
        : unread.filter((row) => isUrgentSeverity(row.severity)).slice(0, limit);
    }

    return await ctx.db
      .query("app_notifications")
      .withIndex("by_user_org_created", (q) =>
        q.eq("userId", scope.userId).eq("orgId", scope.orgId),
      )
      .order("desc")
      .take(limit);
  },
});

/** Tab counts. Capped — the UI renders "99+" past the cap anyway. */
export const counts = query({
  args: {},
  returns: v.object({ all: v.number(), unread: v.number(), urgent: v.number() }),
  handler: async (ctx) => {
    const scope = await callerScope(ctx);
    if (!scope) return { all: 0, unread: 0, urgent: 0 };

    const recent = await ctx.db
      .query("app_notifications")
      .withIndex("by_user_org_created", (q) =>
        q.eq("userId", scope.userId).eq("orgId", scope.orgId),
      )
      .order("desc")
      .take(COUNT_CAP);

    const unread = await ctx.db
      .query("app_notifications")
      .withIndex("by_user_org_read", (q) =>
        q.eq("userId", scope.userId).eq("orgId", scope.orgId).eq("readAt", undefined),
      )
      .take(COUNT_CAP);

    return {
      all: recent.length,
      unread: unread.length,
      // Urgent means unread and urgent: a resolved alert should not keep the tab lit.
      urgent: unread.filter((row) => isUrgentSeverity(row.severity)).length,
    };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("app_notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const row = await ctx.db.get(args.notificationId);
    if (!row) return null;
    // Ownership, not just authentication. The old app's equivalent had neither,
    // so any caller could mark any notification id read.
    if (row.userId !== identity.subject) throw forbiddenError();

    if (row.readAt === undefined) {
      await ctx.db.patch(row._id, { readAt: Date.now() });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.object({ marked: v.number() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    const orgId = (await getActiveOrgId(ctx, identity.subject)) || undefined;

    // Bounded per call. `.collect()` over every unread row is what makes the old
    // implementation fail once a busy account accumulates history.
    const unread = await ctx.db
      .query("app_notifications")
      .withIndex("by_user_org_read", (q) =>
        q.eq("userId", identity.subject).eq("orgId", orgId).eq("readAt", undefined),
      )
      .take(500);

    const now = Date.now();
    for (const row of unread) {
      await ctx.db.patch(row._id, { readAt: now });
    }
    return { marked: unread.length };
  },
});

export const dismiss = mutation({
  args: { notificationId: v.id("app_notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const row = await ctx.db.get(args.notificationId);
    if (!row) return null;
    if (row.userId !== identity.subject) throw forbiddenError();

    const now = Date.now();
    await ctx.db.patch(row._id, {
      dismissedAt: now,
      readAt: row.readAt ?? now,
    });
    return null;
  },
});
