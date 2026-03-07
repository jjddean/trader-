"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Client as TypesenseClient } from "typesense";

export const searchCompanies = action({
    args: {
        query: v.string(),
        filter_by: v.optional(v.string()),
        page: v.optional(v.number()),
        per_page: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const userId = identity.subject;
        const userName = identity.name;

        const typesenseUrl = process.env.TYPESENSE_NODES;
        const typesenseKey = process.env.TYPESENSE_API_KEY;

        if (!typesenseUrl || !typesenseKey) {
            throw new Error("Typesense environment variables (TYPESENSE_NODES, TYPESENSE_API_KEY) are missing in Convex dashboard.");
        }

        // Robust parsing: extract host and port from URL
        let host = "localhost";
        let port = 443;
        let protocol = "https";

        try {
            const url = new URL(typesenseUrl);
            host = url.hostname;
            port = parseInt(url.port) || (url.protocol === "https:" ? 443 : 80);
            protocol = url.protocol.replace(":", "");
        } catch (e) {
            // Fallback for simple host:port strings
            const parts = typesenseUrl.replace("https://", "").replace("http://", "").split(":");
            host = parts[0];
            port = parts[1] ? parseInt(parts[1]) : 443;
            protocol = typesenseUrl.startsWith("http://") ? "http" : "https";
        }

        const client = new TypesenseClient({
            nodes: [{
                host,
                port,
                protocol: protocol as any
            }],
            apiKey: typesenseKey,
            connectionTimeoutSeconds: 5
        });

        const searchParameters: any = {
            'q': args.query,
            'query_by': 'name,category,country,hscode',
            'query_by_weights': '4,2,1,1', // Prioritize name matches
            'filter_by': args.filter_by || "",
            'facet_by': 'country,category,hscode',
            'page': args.page || 1,
            'per_page': args.per_page || 10,
            'highlight_full_fields': 'name,category,country', // Show exactly where matches were found
            'infix': 'always' // Better partial matching
        };

        const results = await client.collections('companies').documents().search(searchParameters);

        // Track search history via internal mutation
        await ctx.runMutation(api.history.logSearch, {
            query: args.query,
            category: "companies" as string,
        });

        return results;
    },
});
