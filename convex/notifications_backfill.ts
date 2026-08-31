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
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { orgIdFromDeclaration } from "./lib/org_access";
import {
  eventDefinition,
  eventForNotification,
  titleForNotification,
} from "./lib/notification_events";
import {
  extractFunctionCode,
  resolveHmrcDmsType,
} from "./lib/hmrc_notification_catalogue";
import {
  isAmendmentAccepted,
  isAmendmentRejected,
  isCancellationRejected,
  isInvalidationAccepted,
} from "./lib/notification_dms_context";

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

/** Rewrite derived DMS labels from XML FunctionCode. Skip rows with no FunctionCode. */
export const persistFromFunctionCode = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patchedNotifications: v.number(),
    patchedInbox: v.number(),
    rebuiltPreviews: v.number(),
    skipped: v.number(),
    isDone: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(args.batchSize ?? 50, 1), 200);
    const page = await ctx.db
      .query("notifications")
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems });

    let patchedNotifications = 0;
    let patchedInbox = 0;
    let skipped = 0;
    const declarationIds = new Set<string>();

    for (const row of page.page) {
      const raw = typeof row.rawPayload === "string" ? row.rawPayload : "";
      const functionCode = extractFunctionCode(raw) || (row.functionCode ? String(row.functionCode) : "");
      if (!functionCode) {
        skipped += 1;
        continue;
      }
      const dmsType = resolveHmrcDmsType({
        rawPayload: raw,
        storedNotificationType: row.notificationType ? String(row.notificationType) : null,
        functionCode,
      });
      const storedType = String(row.notificationType ?? "").trim().toUpperCase();
      const storedFc = row.functionCode ? String(row.functionCode) : "";
      if (storedType !== dmsType || storedFc !== functionCode) {
        await ctx.db.patch(row._id, {
          notificationType: dmsType,
          functionCode,
        });
        patchedNotifications += 1;
      }

      if (row.declarationId) {
        const declarationId = row.declarationId as Id<"declarations">;
        declarationIds.add(String(declarationId));
        const inbox = await ctx.db
          .query("app_notifications")
          .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
          .take(50);
        const dmsCtx = {
          notificationType: dmsType,
          rawPayload: raw,
          errorCodes: Array.isArray(row.errorCodes) ? (row.errorCodes as string[]) : undefined,
          fieldErrors: Array.isArray(row.fieldErrors)
            ? (row.fieldErrors as Array<{ field: string; reason: string; code?: string }>)
            : undefined,
          originatingOperation: row.originatingOperation,
        };
        const event = eventForNotification({
          notificationType: dmsType,
          isAmendmentAccepted: isAmendmentAccepted(dmsCtx),
          isAmendmentRejected: isAmendmentRejected(dmsCtx),
          isCancellationRejected: isCancellationRejected(dmsCtx),
          isInvalidationAccepted: isInvalidationAccepted(dmsCtx),
        });
        const definition = eventDefinition(event);
        const title = titleForNotification(event, dmsType);
        for (const inboxRow of inbox) {
          if (String(inboxRow.sourceId ?? "") !== String(row._id)) continue;
          if (
            inboxRow.title === title &&
            inboxRow.event === event &&
            inboxRow.severity === definition.severity
          ) {
            continue;
          }
          await ctx.db.patch(inboxRow._id, {
            event,
            category: definition.category,
            severity: definition.severity,
            title,
            metadata: {
              ...(typeof inboxRow.metadata === "object" && inboxRow.metadata
                ? inboxRow.metadata
                : {}),
              notificationType: dmsType,
            },
          });
          patchedInbox += 1;
        }
      }
    }

    let rebuiltPreviews = 0;
    for (const id of declarationIds) {
      await ctx.runMutation(internal.declarations.upsertDeclarationPreview, {
        declarationId: id as Id<"declarations">,
      });
      rebuiltPreviews += 1;
    }

    return {
      scanned: page.page.length,
      patchedNotifications,
      patchedInbox,
      rebuiltPreviews,
      skipped,
      isDone: page.isDone,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});
