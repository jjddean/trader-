/**
 * The single emitter for in-app notifications.
 *
 * Contract (docs/notifications/IMPLEMENTATION-PLAN.md §2):
 *
 *  - **Never throws.** A notification is a side-effect of the work, never the
 *    work itself. Convex mutations are transactional, so an unhandled throw here
 *    would roll back the declaration write that triggered it. Same rule already
 *    applied to audit logging in the API routes.
 *  - **Fan-out delivery.** One row per recipient, so per-user preferences apply
 *    at emit time and the unread count stays a single indexed read.
 *  - **Typed events only.** Callers pass a `NotificationEvent` from the
 *    catalogue, never a free string.
 *  - **Call after** `refreshReadModels` / preview upserts, so anything the
 *    notification links to is already consistent when the user clicks through.
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  categoryDefaultInApp,
  eventDefinition,
  isCategoryLocked,
  type NotificationEvent,
} from "./notification_events";

/** Upper bound on recipients for one event. Guards against a runaway fan-out. */
const MAX_FANOUT = 200;

export interface NotifyParams {
  event: NotificationEvent;
  /**
   * The originating user. Always supply it when known — it is the fallback
   * recipient when org membership cannot be resolved, so an event is delivered
   * to somebody rather than silently dropped.
   */
  userId?: string;
  /** Present = deliver to every member of this org. Absent = personal workspace. */
  orgId?: string;
  /**
   * Portal audience. Mutually exclusive with `userId`/`orgId`: a client-scoped
   * notification is delivered to the client contact only and never fans out to
   * staff, which is what keeps broker-internal events out of the portal.
   */
  clientId?: Id<"clients">;

  /** Overrides the catalogue default when a more specific title is available. */
  title?: string;
  body?: string;
  href?: string;

  declarationId?: Id<"declarations">;
  sourceTable?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;

  /**
   * Collapse key. A second event with the same key replaces the first for that
   * recipient rather than stacking — so a declaration missing six documents
   * produces one row, refreshed, not six. Scoped per recipient internally.
   */
  dedupeKey?: string;
}

/**
 * Members of an org, capped. Falls back to the originating user so an event is
 * never lost to an unresolvable or empty org.
 */
async function resolveRecipients(
  ctx: MutationCtx,
  params: Pick<NotifyParams, "userId" | "orgId">,
): Promise<string[]> {
  const orgId = (params.orgId ?? "").trim();
  const originator = (params.userId ?? "").trim();

  if (!orgId) return originator ? [originator] : [];

  const members = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_FANOUT);

  const recipients = new Set<string>();
  for (const member of members) {
    const clerkId = typeof member.clerkId === "string" ? member.clerkId.trim() : "";
    if (clerkId) recipients.add(clerkId);
  }
  // The originator may not carry a users row yet (first action after sign-up).
  if (originator) recipients.add(originator);

  return [...recipients];
}

/**
 * Whether this recipient wants this category in-app. Locked categories skip the
 * lookup entirely — a rejected declaration or a sanctions hit is not silenceable.
 */
async function wantsInApp(
  ctx: MutationCtx,
  userId: string,
  orgId: string | undefined,
  category: string,
): Promise<boolean> {
  if (isCategoryLocked(category)) return true;

  const preference = await ctx.db
    .query("notification_preferences")
    .withIndex("by_user_org_category", (q) =>
      q.eq("userId", userId).eq("orgId", orgId || undefined).eq("category", category),
    )
    .first();

  return preference ? preference.inApp : categoryDefaultInApp(category);
}

/**
 * Emit one notification. Returns how many rows were written — 0 is a normal
 * outcome (everyone muted the category, or the event collapsed onto an existing
 * row), not an error.
 */
export async function notify(ctx: MutationCtx, params: NotifyParams): Promise<number> {
  try {
    const definition = eventDefinition(params.event);
    const now = Date.now();

    const base = {
      event: params.event as string,
      category: definition.category as string,
      severity: definition.severity,
      title: params.title?.trim() || definition.title,
      body: params.body,
      href: params.href,
      declarationId: params.declarationId,
      sourceTable: params.sourceTable,
      sourceId: params.sourceId,
      metadata: params.metadata,
      createdAt: now,
    };

    // Portal audience: no fan-out, no staff preference lookup.
    if (params.clientId) {
      const dedupeKey = params.dedupeKey ? `${params.dedupeKey}:client:${params.clientId}` : undefined;
      if (await collapseOntoExisting(ctx, dedupeKey, base)) return 0;
      await ctx.db.insert("app_notifications", { ...base, clientId: params.clientId, dedupeKey });
      return 1;
    }

    const recipients = await resolveRecipients(ctx, params);
    const orgId = (params.orgId ?? "").trim() || undefined;

    let written = 0;
    for (const recipient of recipients) {
      if (!(await wantsInApp(ctx, recipient, orgId, definition.category))) continue;

      // Scoped per recipient: one person reading their copy must not suppress
      // the next event for everybody else.
      const dedupeKey = params.dedupeKey ? `${params.dedupeKey}:user:${recipient}` : undefined;
      if (await collapseOntoExisting(ctx, dedupeKey, base)) continue;

      await ctx.db.insert("app_notifications", {
        ...base,
        userId: recipient,
        orgId,
        dedupeKey,
      });
      written += 1;
    }

    return written;
  } catch (error) {
    // Deliberately swallowed — see the contract at the top of this file.
    console.error("[notify] failed to emit notification", {
      event: params.event,
      declarationId: params.declarationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Refresh an existing row carrying the same dedupe key instead of stacking a new
 * one. Returns true when the event was absorbed.
 *
 * The refreshed row is marked unread again: the condition it describes has
 * recurred, so a user who already dismissed the earlier copy needs to see it.
 */
async function collapseOntoExisting(
  ctx: MutationCtx,
  dedupeKey: string | undefined,
  base: Record<string, unknown>,
): Promise<boolean> {
  if (!dedupeKey) return false;

  const existing = await ctx.db
    .query("app_notifications")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
    .first();
  if (!existing) return false;

  await ctx.db.patch(existing._id, {
    ...base,
    readAt: undefined,
    dismissedAt: undefined,
  });
  return true;
}
