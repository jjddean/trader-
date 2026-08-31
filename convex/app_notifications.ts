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
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getActiveOrgId } from "./lib/org_access";
import {
  eventDefinition,
  eventForNotification,
  isUrgentSeverity,
  titleForNotification,
} from "./lib/notification_events";
import { resolveHmrcDmsType } from "./lib/hmrc_notification_catalogue";
import {
  isAmendmentAccepted,
  isAmendmentRejected,
  isCancellationRejected,
  isInvalidationAccepted,
} from "./lib/notification_dms_context";
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

async function presentInboxRow(
  ctx: QueryCtx,
  row: Doc<"app_notifications">,
): Promise<Doc<"app_notifications">> {
  if (row.sourceTable !== "notifications" || !row.sourceId) return row;
  const src = await ctx.db.get(row.sourceId as Id<"notifications">);
  if (!src) return row;
  const dmsType = resolveHmrcDmsType({
    rawPayload: typeof src.rawPayload === "string" ? src.rawPayload : null,
    storedNotificationType: src.notificationType ? String(src.notificationType) : null,
    functionCode: src.functionCode ? String(src.functionCode) : null,
  });
  const dmsCtx = {
    notificationType: dmsType,
    rawPayload: typeof src.rawPayload === "string" ? src.rawPayload : null,
    errorCodes: Array.isArray(src.errorCodes) ? (src.errorCodes as string[]) : undefined,
    fieldErrors: Array.isArray(src.fieldErrors)
      ? (src.fieldErrors as Array<{ field: string; reason: string; code?: string }>)
      : undefined,
    originatingOperation: src.originatingOperation,
  };
  const event = eventForNotification({
    notificationType: dmsType,
    isAmendmentAccepted: isAmendmentAccepted(dmsCtx),
    isAmendmentRejected: isAmendmentRejected(dmsCtx),
    isCancellationRejected: isCancellationRejected(dmsCtx),
    isInvalidationAccepted: isInvalidationAccepted(dmsCtx),
  });
  const definition = eventDefinition(event);
  return {
    ...row,
    event,
    category: definition.category,
    severity: definition.severity,
    title: titleForNotification(event, dmsType),
  };
}

async function presentInboxRows(
  ctx: QueryCtx,
  rows: Doc<"app_notifications">[],
): Promise<Doc<"app_notifications">[]> {
  return Promise.all(rows.map((row) => presentInboxRow(ctx, row)));
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
      const unread = await presentInboxRows(
        ctx,
        await ctx.db
          .query("app_notifications")
          .withIndex("by_user_org_read", (q) =>
            q.eq("userId", scope.userId).eq("orgId", scope.orgId).eq("readAt", undefined),
          )
          .order("desc")
          .take(filter === "unread" ? limit : COUNT_CAP),
      );

      return filter === "unread"
        ? unread
        : unread.filter((row) => isUrgentSeverity(row.severity)).slice(0, limit);
    }

    return presentInboxRows(
      ctx,
      await ctx.db
        .query("app_notifications")
        .withIndex("by_user_org_created", (q) =>
          q.eq("userId", scope.userId).eq("orgId", scope.orgId),
        )
        .order("desc")
        .take(limit),
    );
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

    const unread = await presentInboxRows(
      ctx,
      await ctx.db
        .query("app_notifications")
        .withIndex("by_user_org_read", (q) =>
          q.eq("userId", scope.userId).eq("orgId", scope.orgId).eq("readAt", undefined),
        )
        .take(COUNT_CAP),
    );

    return {
      all: recent.length,
      unread: unread.length,
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
