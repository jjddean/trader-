"use node";

import { createHash } from "crypto";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { pullHmrcNotificationsServer, type PullSaveArgs } from "./lib/hmrc_pull_runtime";
import { resolveAccessTokenForUser } from "./lib/hmrc_token_refresh";
import type { ActionCtx } from "./_generated/server";

/** SHA-256 of trimmed payload — must match src/lib/hmrc-notification-idempotency.ts */
function buildHmrcNotificationIdempotencyKey(rawPayload: string): string {
    const normalized = rawPayload.trim();
    const hash = createHash("sha256").update(normalized, "utf8").digest("hex");
    return `hmrc:${hash}`;
}

function makeSavePulledNotification(ctx: ActionCtx) {
    return async (saveArgs: PullSaveArgs) => {
        await ctx.runMutation(api.notifications.saveWebhook, {
            ...saveArgs,
            idempotencyKey: buildHmrcNotificationIdempotencyKey(saveArgs.rawPayload),
        });
    };
}

export const searchHSCode = action({
    args: {
        query: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            const url = `https://api.trade-tariff.service.gov.uk/uk/api/v2/search`;
            
            const response = await fetch(`${url}?q=${encodeURIComponent(args.query)}`, {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "FreightCode/1.0",
                },
            });

            if (!response.ok) {
                console.error("Failed to fetch HMRC Search:", response.status, response.statusText);
                return [];
            }

            const data = await response.json();

            if (data && data.data) {
                const results = data.data.attributes.results || [];
                return results.map((r: any) => ({
                    code: r.goods_nomenclature_item_id,
                    description: r.description,
                    matchType: r.match_type
                }));
            }
            return [];
        } catch (error: any) {
            console.error("HMRC Search (Public) Error:", error.message);
            return [];
        }
    },
});

/** Scheduled/cron pull — persists notifications via saveWebhook. */
export const pullNotificationsScheduled = internalAction({
    args: {
        userId: v.string(),
        conversationId: v.string(),
        source: v.string(),
    },
    returns: v.object({
        conversationId: v.string(),
        total: v.number(),
        saved: v.number(),
    }),
    handler: async (ctx, args) => {
        const token = await resolveAccessTokenForUser(ctx, args.userId);
        if (!token) {
            console.warn(`[HMRC-PULL-SCHEDULED] No token for user ${args.userId}`);
            return { conversationId: args.conversationId, total: 0, saved: 0 };
        }

        const result = await pullHmrcNotificationsServer(
            args.conversationId,
            token,
            args.source,
            makeSavePulledNotification(ctx),
        );

        if (result.saved > 0) {
            console.log(
                `[HMRC-PULL-SCHEDULED] ${args.source}: saved ${result.saved}/${result.total} for ${args.conversationId}`,
            );
        }
        return result;
    },
});

export const recoverStuckDeclarations = internalAction({
    args: {},
    returns: v.object({
        scanned: v.number(),
        pulled: v.number(),
        saved: v.number(),
        skippedNoConversation: v.number(),
        skippedNoToken: v.number(),
    }),
    handler: async (ctx) => {
        const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
        const stuckDeclarations: Array<{
            _id: string;
            userId?: string;
            conversationId?: string | null;
            status?: string;
        }> = await ctx.runQuery(internal.declarations.getStuckProcessingDeclarations, {
            olderThanMs: STUCK_THRESHOLD_MS,
        });

        let pulled = 0;
        let saved = 0;
        let skippedNoConversation = 0;
        let skippedNoToken = 0;

        for (const decl of stuckDeclarations) {
            if (!decl.conversationId || !decl.userId) {
                skippedNoConversation += 1;
                continue;
            }

            const token = await resolveAccessTokenForUser(ctx, decl.userId);
            if (!token) {
                skippedNoToken += 1;
                console.warn(`[RECOVER] No token for declaration ${decl._id} (user ${decl.userId})`);
                continue;
            }

            try {
                const result = await pullHmrcNotificationsServer(
                    decl.conversationId,
                    token,
                    "cron_recover",
                    makeSavePulledNotification(ctx),
                );
                pulled += 1;
                saved += result.saved;
                console.log(
                    `[RECOVER] ${decl._id} (${decl.status}): saved ${result.saved}/${result.total} notifications`,
                );
            } catch (err) {
                console.warn(`[RECOVER] Error for ${decl._id}:`, err);
            }
        }

        const summary = {
            scanned: stuckDeclarations.length,
            pulled,
            saved,
            skippedNoConversation,
            skippedNoToken,
        };
        if (summary.scanned > 0) {
            console.log("[RECOVER] Summary:", JSON.stringify(summary));
        }
        return summary;
    },
});
