import { mutation } from "./_generated/server";

export const seedInitialDatasets = mutation({
    handler: async (ctx) => {
        const datasets = [
            { name: "hs_codes", version: "v2026-03-01", storagePath: "/hs/latest.json" },
            { name: "dcts", version: "v2026-03-01", storagePath: "/dcts/countries.json" },
            { name: "tariffs", version: "v2026-03-01", storagePath: "/tariffs/uk_tariffs.json" },
            { name: "currency", version: "v2026-03-06", storagePath: "/currency/latest.json" },
            { name: "companies", version: "v2026-03-01", storagePath: "/companies/companies.json" },
        ];

        for (const ds of datasets) {
            const existing = await ctx.db
                .query("referenceDatasets")
                .withIndex("by_name", (q) => q.eq("name", ds.name))
                .first();

            if (!existing) {
                await ctx.db.insert("referenceDatasets", {
                    ...ds,
                    lastUpdated: Date.now(),
                });
            }
        }
    },
});
