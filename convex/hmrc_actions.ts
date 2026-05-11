import { action } from "./_generated/server";
import { v } from "convex/values";

type TradeTariffSearchResult = {
    goods_nomenclature_item_id?: string;
    description?: string;
    match_type?: string;
};

type TradeTariffSearchResponse = {
    data?: {
        attributes?: {
            results?: TradeTariffSearchResult[];
        };
    };
};

export const searchHSCode = action({
    args: {
        query: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            // The UK Trade Tariff v2 endpoints for search are public data.
            // Documentation: https://api.trade-tariff.service.gov.uk/
            const url = `https://www.trade-tariff.service.gov.uk/api/v2/search`;
            
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

            const data = await response.json() as TradeTariffSearchResponse;

            if (data && data.data) {
                const results = data.data.attributes?.results || [];
                return results.map((r) => ({
                    code: r.goods_nomenclature_item_id || "",
                    description: r.description || "",
                    matchType: r.match_type || ""
                }));
            }
            return [];
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("HMRC Search (Public) Error:", message);
            return [];
        }
    },
});
