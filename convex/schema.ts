import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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

  waitlist_leads: defineTable({
    email: v.optional(v.any()),
    status: v.optional(v.any()), // "pending"
    timestamp: v.optional(v.any()),
  }).index("by_email", ["email"]),

  historical_declarations: defineTable({
    userId: v.optional(v.any()),
    entryIdentifierMrn: v.optional(v.any()),
    declarantEori: v.optional(v.any()),
    countryOfOriginCode: v.optional(v.any()),
    preferenceCode: v.optional(v.any()),
    itemCustomsValue: v.optional(v.any()),
    taxLineTotalAmount: v.optional(v.any()),
    methodOfPaymentCode: v.optional(v.any()),
    customsProcedureCodeCpc: v.optional(v.any()),
    taxType: v.optional(v.any()),
    commodityCode: v.optional(v.any()),
    createdAt: v.optional(v.any()),
  }).index("by_user", ["userId"]),
  
  declarations: defineTable({
    userId: v.optional(v.any()), // clerkId
    workspaceId: v.optional(v.any()),
    status: v.optional(v.any()),
    eori: v.optional(v.any()),
    mrn: v.optional(v.any()),
    created: v.optional(v.any()),
    lastUpdated: v.optional(v.any()),
    conversationId: v.optional(v.any()),
    declarationType: v.optional(v.any()),
    route: v.optional(v.any()),
    commodityCode: v.optional(v.any()),
    description: v.optional(v.any()),
    lastVerified: v.optional(v.any()),
    originCountry: v.optional(v.any()),
    savingsEstimate: v.optional(v.any()),
    tier: v.optional(v.any()),
  }).index("by_user", ["userId"]).index("by_mrn", ["mrn"]),
  
  goods_items: defineTable({
    declarationId: v.optional(v.any()),
    sequenceNumber: v.optional(v.any()),
    commodityCode: v.optional(v.any()),
    description: v.optional(v.any()),
    originCountry: v.optional(v.any()),
    procedureCode: v.optional(v.any()),
    valueAmount: v.optional(v.any()),
    valueCurrency: v.optional(v.any()),
    grossWeightKg: v.optional(v.any()),
    netWeightKg: v.optional(v.any()),
  }).index("by_declaration", ["declarationId"]),

  documents: defineTable({
    userId: v.optional(v.any()),
    workspaceId: v.optional(v.any()),
    fileId: v.optional(v.any()),
    fileName: v.optional(v.any()),
    status: v.optional(v.any()),
    uploadDate: v.optional(v.any()),
    mrn: v.optional(v.any()),
    declarationId: v.optional(v.any()),
    auditStatus: v.optional(v.any()),
    ocrText: v.optional(v.string()),
  }).index("by_user", ["userId"]).index("by_mrn", ["mrn"]),
  
  workspaces: defineTable({
    name: v.optional(v.any()),
    ownerId: v.optional(v.any()), // clerkId
    hmrcTokensId: v.optional(v.any()),
    eoriNumber: v.optional(v.any()),
    createdAt: v.optional(v.any()),
  }).index("by_owner", ["ownerId"]),
  
  workspaceMembers: defineTable({
    workspaceId: v.optional(v.any()),
    userId: v.optional(v.any()),
    role: v.optional(v.any()),
  }).index("by_user", ["userId"]),
  
  notifications: defineTable({
    mrn: v.optional(v.any()),
    conversationId: v.optional(v.any()),
    timestamp: v.optional(v.any()),
    notificationType: v.optional(v.any()),
    errorCodes: v.optional(v.any()),
    fieldErrors: v.optional(v.any()),
    rawPayload: v.optional(v.any()),
    processed: v.optional(v.any()),
    userId: v.optional(v.any()),
    declarationId: v.optional(v.any()),
  }).index("by_mrn", ["mrn"]).index("by_user", ["userId"]),
  
  auditLogs: defineTable({
    userId: v.optional(v.any()),
    action: v.optional(v.any()),
    details: v.optional(v.any()),
    timestamp: v.optional(v.any()),
    archived: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]),
  admin_subscriptions: defineTable({
    service: v.string(),
    plan: v.string(),
    status: v.string(), // "active", "expiring", "suspended"
    statusOverride: v.optional(v.string()),
    loginUrl: v.string(),
    nextRenewal: v.number(), // timestamp
    notes: v.optional(v.string()),
    lastChecked: v.optional(v.number()),
  }).index("by_service", ["service"]),
});
