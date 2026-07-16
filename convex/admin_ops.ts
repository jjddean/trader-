import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveDeclarationCdsBadge } from "./lib/cds_badge";
import { requireAdmin } from "./lib/user_role";

const NEEDS_ACTION_STATUSES = new Set(["Rejected", "Invalid", "Action Required"]);

function badgeFromStatus(status: string) {
  return resolveDeclarationCdsBadge(status, undefined);
}

function buildUserMap<T extends { clerkId?: unknown; email?: unknown; name?: unknown }>(
  users: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const user of users) {
    const clerkId = String(user.clerkId ?? "");
    if (clerkId) map.set(clerkId, user);
  }
  return map;
}

/** One row per user for admin UI — drops legacy duplicate sandbox rows. */
function dedupeTokensForDisplay<
  T extends { userId?: unknown; environment?: unknown; expiresAt?: unknown },
>(tokens: T[]): T[] {
  const byUser = new Map<string, T>();
  for (const token of tokens) {
    const userId = String(token.userId ?? "");
    if (!userId) continue;
    const existing = byUser.get(userId);
    if (!existing) {
      byUser.set(userId, token);
      continue;
    }
    const existingExplicit = existing.environment != null;
    const incomingExplicit = token.environment != null;
    if (incomingExplicit && !existingExplicit) {
      byUser.set(userId, token);
      continue;
    }
    if (existingExplicit && !incomingExplicit) continue;
    if (Number(token.expiresAt ?? 0) > Number(existing.expiresAt ?? 0)) {
      byUser.set(userId, token);
    }
  }
  return [...byUser.values()];
}

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [declarations, users, tokens, notificationSample] = await Promise.all([
      ctx.db.query("declarations").order("desc").take(1000),
      ctx.db.query("users").take(500),
      ctx.db.query("hmrc_tokens").take(500),
      ctx.db.query("notifications").take(100),
    ]);

    const now = Date.now();
    const counts = {
      total: declarations.length,
      draft: 0,
      accepted: 0,
      needsAction: 0,
      amended: 0,
      other: 0,
    };

    for (const declaration of declarations) {
      const status = String(declaration.status ?? "Draft");
      if (status === "Draft") counts.draft += 1;
      else if (status === "Accepted") counts.accepted += 1;
      else if (NEEDS_ACTION_STATUSES.has(status)) counts.needsAction += 1;
      else if (status === "Amended" || status === "Amendment Processing") counts.amended += 1;
      else counts.other += 1;
    }

    const hmrcConnected = tokens.filter((token) => (token.expiresAt ?? 0) > now).length;

    const lastNotification = notificationSample.sort(
      (a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0),
    )[0];

    const actionQueue = declarations
      .filter((d) => NEEDS_ACTION_STATUSES.has(String(d.status ?? "")))
      .slice(0, 8)
      .map((d) => {
        const status = String(d.status ?? "Draft");
        const badge = badgeFromStatus(status);
        return {
          declarationId: d._id,
          mrn: d.mrn ? String(d.mrn) : undefined,
          eori: d.eori ? String(d.eori) : undefined,
          status,
          cdsBadgeLabel: badge.label,
          cdsBadgeTone: badge.tone,
          lastUpdated: Number(d.lastUpdated || d.created || d._creationTime || 0),
        };
      });

    const recentNotifications = notificationSample
      .sort((a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0))
      .slice(0, 8)
      .map((n) => ({
        id: n._id,
        notificationType: n.notificationType ? String(n.notificationType) : "UNKNOWN",
        mrn: n.mrn ? String(n.mrn) : undefined,
        timestamp: n.timestamp,
      }));

    return {
      declarationCounts: counts,
      userCount: users.length,
      hmrcConnections: {
        total: tokens.length,
        active: hmrcConnected,
        expired: tokens.length - hmrcConnected,
      },
      lastNotificationAt: lastNotification?.timestamp ?? null,
      actionQueue,
      recentNotifications,
    };
  },
});

/** Fast declaration list — no per-row notification replay (avoids admin query timeouts). */
export const getDeclarationRows = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const [declarations, users] = await Promise.all([
      ctx.db.query("declarations").order("desc").take(limit),
      ctx.db.query("users").take(500),
    ]);

    const userMap = buildUserMap(users);

    return declarations.map((declaration) => {
      const status = String(declaration.status ?? "Draft");
      const badge = badgeFromStatus(status);
      const owner = userMap.get(String(declaration.userId ?? ""));

      return {
        declarationId: declaration._id,
        mrn: declaration.mrn ? String(declaration.mrn) : undefined,
        eori: declaration.eori ? String(declaration.eori) : undefined,
        declarationType: declaration.declarationType
          ? String(declaration.declarationType)
          : undefined,
        status,
        cdsBadgeLabel: badge.label,
        cdsBadgeTone: badge.tone,
        ownerEmail: typeof owner?.email === "string" ? owner.email : undefined,
        ownerName: typeof owner?.name === "string" ? owner.name : undefined,
        lastUpdated: Number(
          declaration.lastUpdated || declaration.created || declaration._creationTime || 0,
        ),
      };
    });
  },
});

export const getRecentNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const rows = await ctx.db.query("notifications").take(300);

    return rows
      .sort((a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0))
      .slice(0, limit)
      .map((n) => ({
        id: n._id,
        notificationType: n.notificationType ? String(n.notificationType) : "UNKNOWN",
        mrn: n.mrn ? String(n.mrn) : undefined,
        declarationId: n.declarationId,
        conversationId: n.conversationId ? String(n.conversationId) : undefined,
        timestamp: n.timestamp,
        errorCodes: Array.isArray(n.errorCodes) ? n.errorCodes : undefined,
      }));
  },
});

export const getIntegrationPanel = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, tokens] = await Promise.all([
      ctx.db.query("users").take(200),
      ctx.db.query("hmrc_tokens").take(500),
    ]);

    const userMap = buildUserMap(users);
    const now = Date.now();
    const tokenByUser = new Map<string, (typeof tokens)[number]>();
    for (const token of tokens) {
      const userId = String(token.userId ?? "");
      if (userId) tokenByUser.set(userId, token);
    }

    const hmrcConnections = dedupeTokensForDisplay(tokens)
      .map((token) => {
        const userId = String(token.userId ?? "");
        const owner = userMap.get(userId);
        const expiresAt = Number(token.expiresAt ?? 0);
        return {
          userId,
          ownerEmail: typeof owner?.email === "string" ? owner.email : undefined,
          ownerName: typeof owner?.name === "string" ? owner.name : undefined,
          eori: token.eori ? String(token.eori) : undefined,
          expiresAt,
          isActive: expiresAt > now,
        };
      })
      .sort((a, b) => b.expiresAt - a.expiresAt);

    const platformUsers = users.map((user) => {
      const clerkId = String(user.clerkId ?? "");
      const token = tokenByUser.get(clerkId);
      return {
        clerkId,
        email: typeof user.email === "string" ? user.email : undefined,
        name: typeof user.name === "string" ? user.name : undefined,
        role: typeof user.role === "string" ? user.role : undefined,
        hmrcConnected: Boolean(token && (token.expiresAt ?? 0) > now),
        hmrcEori: token?.eori ? String(token.eori) : undefined,
      };
    });

    return { hmrcConnections, platformUsers };
  },
});

export const getHmrcConnections = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [tokens, users] = await Promise.all([
      ctx.db.query("hmrc_tokens").take(500),
      ctx.db.query("users").take(500),
    ]);

    const userMap = buildUserMap(users);
    const now = Date.now();

    return dedupeTokensForDisplay(tokens)
      .map((token) => {
        const userId = String(token.userId ?? "");
        const owner = userMap.get(userId);
        const expiresAt = Number(token.expiresAt ?? 0);
        return {
          userId,
          ownerEmail: typeof owner?.email === "string" ? owner.email : undefined,
          ownerName: typeof owner?.name === "string" ? owner.name : undefined,
          eori: token.eori ? String(token.eori) : undefined,
          expiresAt,
          isActive: expiresAt > now,
        };
      })
      .sort((a, b) => b.expiresAt - a.expiresAt);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const panel = await ctx.db.query("users").take(200);
    const tokens = await ctx.db.query("hmrc_tokens").take(500);
    const now = Date.now();
    const tokenByUser = new Map<string, (typeof tokens)[number]>();
    for (const token of tokens) {
      const userId = String(token.userId ?? "");
      if (userId) tokenByUser.set(userId, token);
    }

    return panel.map((user) => {
      const clerkId = String(user.clerkId ?? "");
      const token = tokenByUser.get(clerkId);
      return {
        clerkId,
        email: typeof user.email === "string" ? user.email : undefined,
        name: typeof user.name === "string" ? user.name : undefined,
        role: typeof user.role === "string" ? user.role : undefined,
        hmrcConnected: Boolean(token && (token.expiresAt ?? 0) > now),
        hmrcEori: token?.eori ? String(token.eori) : undefined,
      };
    });
  },
});
