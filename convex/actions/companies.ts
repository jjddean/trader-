"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
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

    // const userId = identity.subject;
    // const userName = identity.name;

    const typesenseUrl = process.env.TYPESENSE_NODES;
    const typesenseKey = process.env.TYPESENSE_API_KEY;

    if (!typesenseUrl || !typesenseKey) {
      throw new Error(
        "Typesense environment variables (TYPESENSE_NODES, TYPESENSE_API_KEY) are missing in Convex dashboard.",
      );
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
    } catch {
      // Fallback for simple host:port strings
      const parts = typesenseUrl.replace("https://", "").replace("http://", "").split(":");
      host = parts[0];
      port = parts[1] ? parseInt(parts[1]) : 443;
      protocol = typesenseUrl.startsWith("http://") ? "http" : "https";
    }

    const client = new TypesenseClient({
      nodes: [
        {
          host,
          port,
          protocol: protocol as "http" | "https",
        },
      ],
      apiKey: typesenseKey,
      connectionTimeoutSeconds: 5,
    });

    const searchParameters: Record<string, string | number> = {
      q: args.query,
      query_by: "name,category,country,hscode",
      query_by_weights: "4,2,1,1", // Prioritize name matches
      filter_by: args.filter_by || "",
      facet_by: "country,category,hscode",
      page: args.page || 1,
      per_page: args.per_page || 10,
      highlight_full_fields: "name,category,country", // Show exactly where matches were found
    };

    const results = await client.collections("companies").documents().search(searchParameters);

    return results;
  },
});

export const indexCompanies = action({
  args: {
    datasetUrl: v.string(), // The URL to the JSONL or JSON file of companies
  },
  handler: async (ctx, args) => {
    const typesenseUrl = process.env.TYPESENSE_NODES;
    const typesenseKey = process.env.TYPESENSE_API_KEY;

    if (!typesenseUrl || !typesenseKey) {
      throw new Error("Typesense environment variables are missing.");
    }

    // Reuse the client initialization logic
    let host = "localhost";
    let port = 443;
    let protocol = "https";
    try {
      const url = new URL(typesenseUrl);
      host = url.hostname;
      port = parseInt(url.port) || (url.protocol === "https:" ? 443 : 80);
      protocol = url.protocol.replace(":", "");
    } catch {
      const parts = typesenseUrl.replace("https://", "").replace("http://", "").split(":");
      host = parts[0];
      port = parts[1] ? parseInt(parts[1]) : 443;
      protocol = typesenseUrl.startsWith("http://") ? "http" : "https";
    }

    const client = new TypesenseClient({
      nodes: [{ host, port, protocol: protocol as "http" | "https" }],
      apiKey: typesenseKey,
      connectionTimeoutSeconds: 10,
    });

    // 1. Drop existing collection if it exists
    try {
      await client.collections("companies").delete();
      console.log("Deleted existing companies collection.");
    } catch (err) {
      // Ignore if doesn't exist
    }

    // 2. Define schema
    const schema = {
      name: "companies",
      fields: [
        { name: "name", type: "string" },
        { name: "category", type: "string", facet: true },
        { name: "country", type: "string", facet: true },
        { name: "hscode", type: "string", facet: true },
        { name: "description", type: "string", optional: true },
      ],
      default_sorting_field: "name",
    };

    await client.collections().create(schema as any);
    console.log("Created companies collection.");

    // 3. Fetch data
    const response = await fetch(args.datasetUrl);
    if (!response.ok) throw new Error("Failed to fetch dataset.");
    const companies = await response.json(); // Assuming JSON array for this example

    // 4. Bulk Import
    console.log(`Importing ${companies.length} companies...`);
    const importResults = (await client.collections("companies").documents().import(companies, { action: "create" })) as unknown as string;
    
    // Typesense import returns a newline-separated string of JSON objects
    const resultsArray = importResults.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line));

    const failedItems = resultsArray.filter((r: any) => r.success === false);
    if (failedItems.length > 0) {
      console.error(`Failed to import ${failedItems.length} items.`, failedItems[0]);
    }

    return { total: companies.length, failed: failedItems.length };

  },
});
