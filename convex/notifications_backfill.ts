/**
 * One-off backfill: mirror rows for HMRC notifications that landed before the
 * inbox existed.
 *
 * Run from the Convex dashboard, repeatedly, passing the returned cursor back in
 * until `isDone` is true. Deliberately a paginated internal mutation rather than
 * a single sweep — the source table carries full CDS XML per row, so reading it
 * end to end in one transaction is not safe at any real volume.
 *
 * Two deliberate narrowings versus live emission:
 *
 *  - **Owner only, no org fan-out.** Backfilled history is context, not a call
 *    to action; giving every colleague a copy of every historical notification
 *    multiplies rows for no benefit.
 *  - **Written already read.** Backfill must never light up the bell with a
 *    year of history the user has in fact already seen on the status page.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { orgIdFromDeclaration } from "./lib/org_access";
import {
  eventDefinition,
  eventForNotification,
  titleForNotification,
} from "./lib/notification_events";

export const backfillMirrorRows = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    skipped: v.number(),
    isDone: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(args.batchSize ?? 100, 1), 500);

    const page = await ctx.db
      .query("notifications")
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems });

    let created = 0;
    let skipped = 0;

    for (const row of page.page) {
      const userId = typeof row.userId === "string" ? row.userId.trim() : "";
      if (!userId || !row.declarationId) {
        // Unlinked notifications have no owner and no destination to click
        // through to, so there is nothing to show anyone.
        skipped += 1;
        continue;
      }

      // Same key shape notify() writes, so a live notification arriving for a
      // row this pass already handled collapses instead of duplicating.
      const dedupeKey = `hmrc:${row._id}:user:${userId}`;
      const existing = await ctx.db
        .query("app_notifications")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
        .first();
      if (existing) {
        skipped += 1;
        continue;
      }

      // `notifications.declarationId` is schema-typed `v.any()`, so it arrives
      // as an unresolved id union and must be narrowed before use.
      const declarationId = row.declarationId as Id<"declarations">;
      const declaration = await ctx.db.get(declarationId);
      if (!declaration) {
        skipped += 1;
        continue;
      }

      const event = eventForNotification({ notificationType: row.notificationType });
      const definition = eventDefinition(event);
      const errorCodes: string[] = Array.isArray(row.errorCodes) ? row.errorCodes : [];
      const mrn = typeof row.mrn === "string" ? row.mrn : "";
      const createdAt = Number(row.timestamp ? Date.parse(String(row.timestamp)) : NaN);

      await ctx.db.insert("app_notifications", {
        userId,
        orgId: orgIdFromDeclaration(declaration),
        event,
        category: definition.category,
        severity: definition.severity,
        title: titleForNotification(event, row.notificationType),
        body: errorCodes.length > 0
          ? `${mrn || "Declaration"} — ${errorCodes.slice(0, 3).join(", ")}`
          : (mrn && mrn !== "UNKNOWN" ? `MRN ${mrn}` : undefined),
        href: `/dashboard/declarations/${declarationId}/status`,
        declarationId,
        sourceTable: "notifications",
        sourceId: row._id,
        dedupeKey,
        // Fall back to the evidence row's own creation time when the HMRC
        // timestamp is missing or unparseable, so ordering stays sane.
        createdAt: Number.isFinite(createdAt) ? createdAt : row._creationTime,
        readAt: Date.now(),
        metadata: { notificationType: row.notificationType, backfilled: true },
      });
      created += 1;
    }

    return {
      scanned: page.page.length,
      created,
      skipped,
      isDone: page.isDone,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});
