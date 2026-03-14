import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tradeLanes: defineTable({
    userId: v.optional(v.any()), // Clerk userId
    originCountry: v.optional(v.any()),
    commodityCode: v.optional(v.any()),
    description: v.optional(v.any()),
    tier: v.optional(v.any()), // Enhanced, Comprehensive, Standard
    status: v.optional(v.any()), // Verified, Review, Excluded
    savingsEstimate: v.optional(v.any()),
    lastVerified: v.optional(v.any()), // timestamp
  }).index("by_user", ["userId"]),


  prospects: defineTable({
    companyName: v.optional(v.any()),
    country: v.optional(v.any()),
    dctsTier: v.optional(v.any()),
    primaryHS: v.optional(v.any()),
    contactEmail: v.optional(v.any()),
    contactPhone: v.optional(v.any()),
    lastShipmentDate: v.optional(v.any()),
    reliabilityScore: v.optional(v.any()), // 0-1
    status: v.optional(v.any()), // "New", "Contacted", "Proposal Sent", "Client"
    laneId: v.optional(v.any()),
    businessCategory: v.optional(v.any()), // e.g. "Importer", "Manufacturer"
  })
    .index("by_country", ["country"])
    .index("by_hs", ["primaryHS"])
    .index("by_lane", ["laneId"]),

  shipments: defineTable({
    exporterName: v.optional(v.any()),
    originCountry: v.optional(v.any()),
    importerName: v.optional(v.any()), // Usually redacted in real HMRC data, but here for the matching engine
    hsCode: v.optional(v.any()),
    value: v.optional(v.any()),
    date: v.optional(v.any()),
  }).index("by_hs", ["hsCode"]),

  users: defineTable({
    clerkId: v.optional(v.any()),
    email: v.optional(v.any()),
    name: v.optional(v.any()),
    orgId: v.optional(v.any()),
  }).index("by_clerk", ["clerkId"]),

  subscriptions: defineTable({
    userId: v.optional(v.any()), // clerkId
    stripeCustomerId: v.optional(v.any()),
    stripeSubscriptionId: v.optional(v.any()),
    status: v.optional(v.any()), // "active", "trialing", "past_due", "canceled"
    plan: v.optional(v.any()), // "Starter", "Professional", "Enterprise"
    currentPeriodEnd: v.optional(v.any()), // timestamp
  }).index("by_user", ["userId"]),

  saved_companies: defineTable({
    userId: v.optional(v.any()),
    companyName: v.optional(v.any()),
    country: v.optional(v.any()),
    category: v.optional(v.any()),
    notes: v.optional(v.any()),
    timestamp: v.optional(v.any()),
  }).index("by_user", ["userId"]),



  messages: defineTable({
    laneId: v.optional(v.any()),
    prospectId: v.optional(v.any()),
    sender: v.optional(v.any()), // "user" | "buyer"
    channel: v.optional(v.any()), // "email" | "whatsapp" | "sms" | "draft"
    content: v.optional(v.any()),
    status: v.optional(v.any()), // "draft" | "sent" | "delivered" | "opened" | "replied"
    createdAt: v.optional(v.any()),
    userId: v.optional(v.any()),
  })
    .index("by_lane", ["laneId"])
    .index("by_user", ["userId"])
    .index("by_prospect", ["prospectId"]),

  referenceDatasets: defineTable({
    name: v.optional(v.any()), // "hs_codes", "dcts", "tariffs", "currency", "companies"
    version: v.optional(v.any()), // e.g., "v2026-03-06"
    storagePath: v.optional(v.any()), // e.g., "/hs/latest.json"
    storageUrl: v.optional(v.any()), // Optional full URL if not using a proxy
    lastUpdated: v.optional(v.any()),
  }).index("by_name", ["name"]),

  hmrc_tokens: defineTable({
    userId: v.optional(v.any()), // clerkId
    accessToken: v.optional(v.any()),
    refreshToken: v.optional(v.any()),
    expiresAt: v.optional(v.any()),
    eori: v.optional(v.any()), // Optionally store the linked EORI
  }).index("by_user", ["userId"]),
});
