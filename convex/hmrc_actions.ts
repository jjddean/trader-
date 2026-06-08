import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const searchHSCode = action({
    args: {
        query: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            // The UK Trade Tariff v2 endpoints for search are public data.
            // Documentation: https://api.trade-tariff.service.gov.uk/
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

export const recoverStuckDeclarations = internalAction({
    args: {},
    handler: async (ctx) => {
        const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
        const stuckDeclarations: Array<{ _id: string; userId: string; conversationId?: string | null }> =
            await ctx.runQuery(internal.declarations.getStuckProcessingDeclarations, { olderThanMs: STUCK_THRESHOLD_MS });

        if (stuckDeclarations.length === 0) return null;

        const HMRC_ENVIRONMENT = process.env.HMRC_ENVIRONMENT || "sandbox";
        const hmrcBase =
            HMRC_ENVIRONMENT === "sandbox" ? "https://test-api.service.hmrc.gov.uk" : "https://api.service.hmrc.gov.uk";

        for (const decl of stuckDeclarations) {
            if (!decl.conversationId) continue;

            const tokenRow: { accessToken?: string } | null = await ctx.runQuery(internal.declarations.getHmrcTokenForUser, {
                userId: decl.userId,
            });
            if (!tokenRow?.accessToken) continue;

            try {
                const listUrl = `${hmrcBase}/customs/declarations/notifications/${encodeURIComponent(decl.conversationId)}`;
                const res = await fetch(listUrl, {
                    headers: {
                        Authorization: `Bearer ${tokenRow.accessToken}`,
                        Accept: "application/vnd.hmrc.1.0+xml",
                    },
                });
                if (!res.ok) {
                    console.warn(`[RECOVER] Pull failed for ${decl._id}: ${res.status}`);
                } else {
                    console.log(`[RECOVER] Pulled notifications for stuck declaration ${decl._id}`);
                }
            } catch (err) {
                console.warn(`[RECOVER] Error for ${decl._id}:`, err);
            }
        }

        return null;
    },
});
