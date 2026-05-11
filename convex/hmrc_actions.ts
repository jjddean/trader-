import { action } from "./_generated/server";
import { v } from "convex/values";

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
