import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    tradeLanes: defineTable({
        userId: v.string(), // Clerk userId
        originCountry: v.string(),
        commodityCode: v.string(),
        description: v.string(),
        tier: v.string(), // Enhanced, Comprehensive, Standard
        status: v.string(), // Verified, Review, Excluded
        savingsEstimate: v.optional(v.number()),
        lastVerified: v.number(), // timestamp
    }).index("by_user", ["userId"]),

    auditLogs: defineTable({
        userId: v.string(),
        orgId: v.optional(v.string()),
        action: v.string(), // "simulation_run", "lane_created"
        details: v.any(),
        timestamp: v.number(),
    }).index("by_user", ["userId"]),

    prospects: defineTable({
        companyName: v.string(),
        country: v.string(),
        dctsTier: v.string(),
        primaryHS: v.string(),
        contactEmail: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        lastShipmentDate: v.optional(v.number()),
        reliabilityScore: v.number(), // 0-1
        status: v.string(), // "New", "Contacted", "Proposal Sent", "Client"
    }).index("by_country", ["country"]).index("by_hs", ["primaryHS"]),

    shipments: defineTable({
        exporterName: v.string(),
        originCountry: v.string(),
        importerName: v.string(), // Usually redacted in real HMRC data, but here for the matching engine
        hsCode: v.string(),
        value: v.number(),
        date: v.number(),
    }).index("by_hs", ["hsCode"]),

    users: defineTable({
        clerkId: v.string(),
        email: v.string(),
        name: v.optional(v.string()),
        orgId: v.optional(v.string()),
    }).index("by_clerk", ["clerkId"]),

    subscriptions: defineTable({
        userId: v.string(), // clerkId
        stripeCustomerId: v.string(),
        stripeSubscriptionId: v.string(),
        status: v.string(), // "active", "trialing", "past_due", "canceled"
        plan: v.string(), // "Starter", "Professional", "Enterprise"
        currentPeriodEnd: v.number(), // timestamp
    }).index("by_user", ["userId"]),

    saved_companies: defineTable({
        userId: v.string(),
        companyName: v.string(),
        country: v.string(),
        category: v.optional(v.string()),
        notes: v.optional(v.string()),
        timestamp: v.number(),
    }).index("by_user", ["userId"]),

    search_history: defineTable({
        userId: v.string(),
        query: v.string(),
        category: v.string(), // "companies", "hs_codes"
        timestamp: v.number(),
    }).index("by_user", ["userId"]),

    calculator_history: defineTable({
        userId: v.string(),
        hsCode: v.string(),
        originCountry: v.string(),
        value: v.number(),
        dutyRate: v.number(),
        totalLandedCost: v.number(),
        timestamp: v.number(),
    }).index("by_user", ["userId"]),

    referenceDatasets: defineTable({
        name: v.string(), // "hs_codes", "dcts", "tariffs", "currency", "companies"
        version: v.string(), // e.g., "v2026-03-06"
        storagePath: v.string(), // e.g., "/hs/latest.json"
        storageUrl: v.optional(v.string()), // Optional full URL if not using a proxy
        lastUpdated: v.number(),
    }).index("by_name", ["name"]),

    hmrc_tokens: defineTable({
        userId: v.string(), // clerkId
        accessToken: v.string(),
        refreshToken: v.string(),
        expiresAt: v.number(),
        eori: v.optional(v.string()), // Optionally store the linked EORI
    }).index("by_user", ["userId"]),
});
