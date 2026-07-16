import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- AI Assistant Persistent Workspace ---
  conversations: defineTable({
    organizationId: v.string(),
    declarationId: v.optional(v.id("declarations")),
    createdBy: v.string(),
    title: v.optional(v.string()),
    status: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_declaration", ["declarationId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    createdAt: v.number(),
    streamed: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  })
    .index("by_conversation", ["conversationId"]),

  assistantEvents: defineTable({
    conversationId: v.id("conversations"),
    declarationId: v.optional(v.id("declarations")),
    eventType: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_declaration", ["declarationId"]),
  users: defineTable({
    clerkId: v.optional(v.any()),
    email: v.optional(v.any()),
    name: v.optional(v.any()),
    orgId: v.optional(v.any()),
    role: v.optional(v.string()),
    /** Set when personal-scoped rows are attached to a Clerk org — hides Personal in org switcher */
    personalMigratedAt: v.optional(v.number()),
    /** @deprecated Removed from product — strip via stripLegacyClaimedForOrgId then delete from schema */
    legacyClaimedForOrgId: v.optional(v.string()),
  }).index("by_clerk", ["clerkId"]),

  /** Per Clerk org: practice (sandbox/TDR) vs live (production CDS). */
  org_hmrc_settings: defineTable({
    orgId: v.string(),
    /** Clerk organisation display name (synced on sign-in). */
    orgName: v.optional(v.string()),
    hmrcMode: v.union(v.literal("practice"), v.literal("live")),
    /** Sandbox OAuth sign-in for practice orgs (HMRC Test User — not live Government Gateway). */
    sandboxTestUserId: v.optional(v.string()),
    sandboxTestUserPassword: v.optional(v.string()),
    sandboxTestUserCreatedAt: v.optional(v.number()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_org", ["orgId"]),

  subscriptions: defineTable({
    userId: v.optional(v.any()), // clerkId
    stripeCustomerId: v.optional(v.any()),
    stripeSubscriptionId: v.optional(v.any()),
    status: v.optional(v.any()), // "active", "trialing", "past_due", "canceled"
    plan: v.optional(v.any()), // "Starter", "Pro", "Pay As You Go"
    currentPeriodEnd: v.optional(v.any()), // timestamp
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  referenceDatasets: defineTable({
    name: v.optional(v.any()), // "hs_codes", "dcts", "tariffs", "currency", "companies"
    version: v.optional(v.any()), // e.g., "v2026-03-06"
    storagePath: v.optional(v.any()), // e.g., "/hs/latest.json"
    storageUrl: v.optional(v.any()), // Optional full URL if not using a proxy
    lastUpdated: v.optional(v.any()),
    submittedAt: v.optional(v.any()),
  }).index("by_name", ["name"]),

  hmrc_tokens: defineTable({
    userId: v.optional(v.any()), // clerkId
    /** sandbox | production. Missing legacy rows are treated as sandbox only. */
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    /** @deprecated Plaintext — migrate to accessTokenEncrypted; cleared on write when encryption enabled. */
    accessToken: v.optional(v.any()),
    /** @deprecated Plaintext — migrate to refreshTokenEncrypted; cleared on write when encryption enabled. */
    refreshToken: v.optional(v.any()),
    accessTokenEncrypted: v.optional(v.string()),
    refreshTokenEncrypted: v.optional(v.string()),
    expiresAt: v.optional(v.any()),
    eori: v.optional(v.any()), // Optionally store the linked EORI
  })
    .index("by_user", ["userId"])
    .index("by_user_and_environment", ["userId", "environment"]),

  /** Short-lived PKCE verifiers for HMRC OAuth (survives cross-site redirect without cookies). */
  hmrc_oauth_pkce: defineTable({
    stateNonce: v.string(),
    userId: v.string(),
    codeVerifier: v.string(),
    expiresAt: v.number(),
  }).index("by_stateNonce", ["stateNonce"]),

  waitlist_leads: defineTable({
    email: v.optional(v.any()),
    status: v.optional(v.any()), // "pending"
    timestamp: v.optional(v.any()),
  }).index("by_email", ["email"]),

  historical_declarations: defineTable({
    userId: v.optional(v.any()),
    orgId: v.optional(v.string()),
    importId: v.optional(v.id("tre_imports")),
    sourceRowHash: v.optional(v.string()),
    reportKind: v.optional(v.string()), // import_item | import_header | import_tax_lines | export_item
    entryIdentifierMrn: v.optional(v.any()),
    declarantEori: v.optional(v.any()),
    importerEori: v.optional(v.any()),
    countryOfOriginCode: v.optional(v.any()),
    countryOfDispatchCode: v.optional(v.any()),
    destinationCountryCode: v.optional(v.any()),
    preferenceCode: v.optional(v.any()),
    itemCustomsValue: v.optional(v.any()),
    taxLineTotalAmount: v.optional(v.any()),
    methodOfPaymentCode: v.optional(v.any()),
    customsProcedureCodeCpc: v.optional(v.any()),
    taxType: v.optional(v.any()),
    commodityCode: v.optional(v.any()),
    dutyRatePercent: v.optional(v.number()),
    acceptanceDate: v.optional(v.any()),
    goodsDescription: v.optional(v.string()),
    netMassKg: v.optional(v.number()),
    documentCodes: v.optional(v.string()),
    invoiceTotalGbp: v.optional(v.number()),
    transportCostGbp: v.optional(v.number()),
    totalDutyGbp: v.optional(v.number()),
    totalVatGbp: v.optional(v.number()),
    goodsDepartureDate: v.optional(v.string()),
    createdAt: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_country", ["userId", "countryOfOriginCode"])
    .index("by_org", ["orgId"])
    .index("by_org_country", ["orgId", "countryOfOriginCode"])
    .index("by_import", ["importId"])
    .index("by_org_row_hash", ["orgId", "sourceRowHash"])
    .index("by_user_row_hash", ["userId", "sourceRowHash"]),

  tre_imports: defineTable({
    orgId: v.optional(v.string()),
    userId: v.string(),
    filename: v.string(),
    reportFormat: v.optional(v.string()),
    rowCount: v.number(),
    lineItemsStored: v.number(),
    lineItemsSkipped: v.number(),
    status: v.string(),
    warnings: v.optional(v.array(v.string())),
    errors: v.optional(v.array(v.string())),
    checksum: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"]),

  declarations: defineTable({
    userId: v.optional(v.any()), // clerkId
    orgId: v.optional(v.string()), // Clerk org — shared within team
    /**
     * HMRC environment this declaration is bound to (sandbox | production).
     * Stamped at creation from org mode and locked on first submission so a
     * sandbox declaration can never be sent to Live (or vice-versa).
     * Legacy rows without this field are treated as sandbox.
     */
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
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
    dispatchCountry: v.optional(v.any()),
    destinationCountry: v.optional(v.any()),
    importerEori: v.optional(v.any()),
    presentationOffice: v.optional(v.any()),
    locationId: v.optional(v.any()),
    /** port_unlocode | address — drives auto-mapped CDS type/qualifier (not free-text A/U). */
    goodsLocationKind: v.optional(v.any()),
    goodsLocationTypeCode: v.optional(v.any()),
    goodsLocationQualifier: v.optional(v.any()),
    invoiceCurrency: v.optional(v.any()),
    savingsEstimate: v.optional(v.any()),
    tier: v.optional(v.any()),
    // Rule engine mode: "minimal" forbids any non-mandatory enrichment
    // (documents, additional procedures, valuation adjustments). "enriched"
    // unlocks them subject to per-rule allowance. Defaults to "minimal" when
    // unset so new lanes can't accidentally include kitchen-sink data.
    mode: v.optional(v.string()),
    // Optional explicit declaration-level invoice total used by the
    // VALUE_MATCH_INVOICE rule. When unset the rule skips (mapper's
    // auto-sum makes the check meaningless).
    invoiceTotal: v.optional(v.any()),
    incoterms: v.optional(v.any()),
    incotermLocation: v.optional(v.any()),
    // DE 7/4 — Mode of transport at the border. Numeric: "1" sea, "3" road,
    // "4" air, "8" inland waterway. Required for imports (CDS12073).
    transportMode: v.optional(v.string()),
    // DE 7/9 — Identity of the active means of transport crossing the border
    // (vessel name, vehicle reg, flight number). R123 demands this matches the
    // ArrivalTransportMeans inside the consignment.
    transportId: v.optional(v.string()),
    // DE 7/7 — Identification type of the means of transport. e.g. "11"
    // vessel name, "30" road vehicle reg, "40" flight number.
    transportIdType: v.optional(v.string()),
    // DE 3/1 — overseas exporter Name+Address when dispatch ≠ GB/XI.
    exporterName: v.optional(v.string()),
    exporterCity: v.optional(v.string()),
    exporterLine: v.optional(v.string()),
    exporterPostcode: v.optional(v.string()),
    exporterEori: v.optional(v.string()),
    // DE 8/5 — GoodsShipment/TransactionNatureCode (WCOID 103).
    transactionNatureCode: v.optional(v.string()),
    // DE 2/6 — duty deferment account number (optional; surfaced on Financial Records).
    defermentAccountNumber: v.optional(v.string()),
    // DE 4/8 — method of payment code (e.g. "E" deferment).
    paymentMethodCode: v.optional(v.string()),
    // DE 3/19-3/21 — customs representation. Omitted/undefined is treated as
    // self-representation for existing declarations.
    representationType: v.optional(v.union(v.literal("self"), v.literal("direct"), v.literal("indirect"))),
    representativeEori: v.optional(v.string()),
    representativeName: v.optional(v.string()),
    representativeAddressLine: v.optional(v.string()),
    representativeCity: v.optional(v.string()),
    representativePostcode: v.optional(v.string()),
    representativeCountry: v.optional(v.string()),
    authorityVerified: v.optional(v.boolean()),
    authorityValidFrom: v.optional(v.number()),
    authorityValidTo: v.optional(v.number()),
    representationUpdatedAt: v.optional(v.number()),
    // The broker's client this declaration is filed for (the represented
    // trader). Optional — self-serve declarations have no separate client.
    clientId: v.optional(v.id("clients")),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_mrn", ["mrn"])
    .index("by_conversationId", ["conversationId"]),

  // Broker's client/trader profiles. A reusable party record (the importer the
  // broker files on behalf of) scoped to the broker's Clerk org. This is DATA
  // only — a client is never an app login. A read-only client portal would be a
  // separate layer that maps a Clerk user to one of these records.
  clients: defineTable({
    userId: v.string(), // clerkId of the creator
    orgId: v.optional(v.string()), // Clerk org — shared within the broker team
    name: v.string(),
    eori: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    city: v.optional(v.string()),
    postcode: v.optional(v.string()),
    country: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"]),

  goods_items: defineTable({
    ownerId: v.optional(v.any()),
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
    additionalDocuments: v.optional(v.any()),
    additionalProcedureCode: v.optional(v.any()),
    shippingMarks: v.optional(v.any()),
    // DE 6/2 — supplementary units (TariffQuantity). Required when tariff instructs (e.g. 8471300000 → p/st).
    supplementaryUnitQty: v.optional(v.number()),
    // Appendix 20 / UK Tariff Data Standard: NAR = number of items (p/st).
    supplementaryUnitCode: v.optional(v.string()),
    // DE 6/10 — number of packages. Mandatory per Appendix 21A H1.
    packageCount: v.optional(v.number()),
    // DE 6/9 — package type code (PK, BX, CT, etc.). Mandatory per Appendix 21A H1.
    packageType: v.optional(v.string()),
  }).index("by_declaration", ["declarationId"]).index("by_owner", ["ownerId"]),

  documents: defineTable({
    userId: v.optional(v.any()),
    orgId: v.optional(v.string()),
    workspaceId: v.optional(v.any()),
    fileId: v.optional(v.any()),
    fileName: v.optional(v.any()),
    fileType: v.optional(v.any()),
    fileSize: v.optional(v.number()),
    status: v.optional(v.any()),
    uploadDate: v.optional(v.any()),
    mrn: v.optional(v.any()),
    declarationId: v.optional(v.any()),
    auditStatus: v.optional(v.any()),
    auditResult: v.optional(v.any()),
    ocrText: v.optional(v.string()),
    hmrcUploadReference: v.optional(v.string()),
    hmrcConversationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_mrn", ["mrn"])
    .index("by_declaration", ["declarationId"]),

  document_requirements: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    code: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
    source: v.optional(v.string()),
    requirementLevel: v.optional(v.string()), // blocking | advisory
    deReference: v.optional(v.string()),
    hmrcGuidance: v.optional(v.string()),
    status: v.string(), // missing | uploaded | waived
    linkedDocumentId: v.optional(v.id("documents")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_declaration", ["declarationId"]).index("by_declaration_code", ["declarationId", "code"]),

  workspaces: defineTable({
    name: v.optional(v.any()),
    slug: v.optional(v.any()),
    ownerId: v.optional(v.any()), // clerkId
    hmrcTokensId: v.optional(v.any()),
    eoriNumber: v.optional(v.any()),
    createdAt: v.optional(v.any()),
  }).index("by_owner", ["ownerId"]),

  workspaceMembers: defineTable({
    workspaceId: v.optional(v.any()),
    userId: v.optional(v.any()),
    role: v.optional(v.any()),
    workspaceName: v.optional(v.any()),
    workspaceSlug: v.optional(v.any()),
  }).index("by_user", ["userId"]),

  notifications: defineTable({
    mrn: v.optional(v.any()),
    conversationId: v.optional(v.any()),
    /** sandbox | production — stamped at ingest from pull env or linked declaration. */
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    idempotencyKey: v.optional(v.string()),
    hmrcNotificationId: v.optional(v.string()),
    source: v.optional(v.string()),
    timestamp: v.optional(v.any()),
    // HMRC IssueDateTime (ISO) — authoritative ordering, independent of receipt time.
    issueDateTime: v.optional(v.string()),
    notificationType: v.optional(v.any()),
    errorCodes: v.optional(v.any()),
    fieldErrors: v.optional(v.any()),
    rawPayload: v.optional(v.any()),
    processed: v.optional(v.any()),
    userId: v.optional(v.any()),
    orgId: v.optional(v.string()),
    declarationId: v.optional(v.any()),
  })
    .index("by_mrn", ["mrn"])
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_declaration", ["declarationId"])
    .index("by_conv_type_ts", ["conversationId", "notificationType", "timestamp"]) // used for dedupe
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_hmrcNotificationId", ["hmrcNotificationId"]),

  dashboard_summary: defineTable({
    userId: v.string(),
    totalDeclarations: v.number(),
    reviewCount: v.number(),
    totalValue: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  declaration_preview: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    orgId: v.optional(v.string()),
    status: v.string(),
    totalItems: v.number(),
    totalValue: v.number(),
    mrn: v.optional(v.string()),
    eori: v.optional(v.string()),
    declarationType: v.optional(v.string()),
    // Completeness state — derived from convex/lib/declaration_completeness.ts.
    // The single source of truth for "is this declaration submittable". Recomputed
    // on every declaration/items write via upsertDeclarationPreviewByDeclaration.
    // Optional for back-compat with rows written before this field existed.
    completenessReady: v.optional(v.boolean()),
    missingCount: v.optional(v.number()),
    // DMSTAX / tariff-derived financial snapshot — refreshed on notification + item writes.
    dutyAmount: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    customsValue: v.optional(v.number()),
    derivedDutyAmount: v.optional(v.number()),
    derivedVatAmount: v.optional(v.number()),
    financialSource: v.optional(v.union(v.literal("hmrc_confirmed"), v.literal("derived"))),
    estimateMethod: v.optional(
      v.union(
        v.literal("hmrc_confirmed"),
        v.literal("tariff_measures"),
        v.literal("historical_fallback"),
      ),
    ),
    estimateIncomplete: v.optional(v.boolean()),
    potentialPreferenceSaving: v.optional(v.number()),
    dmstaxUpdatedAt: v.optional(v.number()),
    defermentAccountNumber: v.optional(v.string()),
    paymentMethodLabel: v.optional(v.string()),
    // F2 — estimate vs HMRC DMSTAX variance (derived − confirmed).
    dutyVarianceAmount: v.optional(v.number()),
    vatVarianceAmount: v.optional(v.number()),
    varianceAlert: v.optional(v.boolean()),
    varianceKinds: v.optional(v.array(v.string())),
    varianceAssessedAt: v.optional(v.number()),
    fxConversionUsed: v.optional(v.boolean()),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_declarationId", ["declarationId"]),

  /** Latest Open Exchange Rates snapshot — synced daily from R2 for GBP customs value conversion. */
  fx_rates_cache: defineTable({
    base: v.string(),
    rates: v.any(),
    sourceVersion: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),

  auditLogs: defineTable({
    userId: v.optional(v.any()),
    action: v.optional(v.any()),
    details: v.optional(v.any()),
    timestamp: v.optional(v.any()),
    archived: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]).index("by_user", ["userId"]),

  declaration_approvals: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    orgId: v.optional(v.string()),
    approverName: v.string(),
    approverEmail: v.optional(v.string()),
    approvedAt: v.number(),
    reason: v.string(),
    riskScore: v.number(),
    exposureAmount: v.optional(v.number()),
    exposureCurrency: v.optional(v.string()),
    exposureReason: v.optional(v.string()),
    declarationLastUpdatedAt: v.optional(v.number()),
    materialFingerprint: v.optional(v.string()),
    declarationSnapshot: v.any(),
    itemsSnapshot: v.any(),
    representationSnapshot: v.any(),
    approvalMethod: v.string(),
    status: v.union(v.literal("approved"), v.literal("revoked")),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
    revocationReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_declaration", ["declarationId"])
    .index("by_declaration_and_status", ["declarationId", "status"])
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"]),

  financial_exposures: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    orgId: v.optional(v.string()),
    exposureAmount: v.number(),
    currency: v.string(),
    exposureReason: v.optional(v.string()),
    sourceApprovalId: v.optional(v.id("declaration_approvals")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_declaration", ["declarationId"])
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"]),

  // Pre-computed historical duty/VAT rate map per user.
  // Rebuilt only when historical_declarations are ingested — prevents getReports and
  // getFinancialRecords from scanning 2,000 historical rows on every subscription refresh.
  rate_cache: defineTable({
    userId: v.optional(v.string()),
    orgId: v.optional(v.string()),
    rateMap: v.any(), // Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"]),

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

  // Authoritative HMRC CDS code lists, sourced from github.com/hmrc/wco-dec.
  // Used by the dry-run preflight to reject invented values before they hit
  // CDS — Method 1 valuation requires N935, AuthorisationHolder needs CGU/EIR/SDE etc.,
  // SupervisingOffice values look like GBABD001 not GB000060.
  cds_code_lists: defineTable({
    listName: v.string(), // e.g. "additional_documents", "customs_offices", "auth_categories"
    value: v.string(),    // e.g. "A004", "GBABD001", "CGU"
    description: v.string(),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_list", ["listName"])
    .index("by_list_value", ["listName", "value"]),

  // Rule engine: declarative CDS business rules. The submit pipeline resolves
  // a scenario (CPC + additional procedure + commodity + origin + valuation)
  // from the declaration+items, then evaluates every enabled rule whose
  // triggerScope matches. Rules can require/forbid documents, require/forbid
  // fields, or both. Sources cite UK Tariff API, HMRC CDS Reject Library,
  // wco-dec, or empirical TDR rejections.
  rule_definitions: defineTable({
    ruleId: v.string(), // e.g. "INV-METHOD1-N935", "TRANS-R123-MIRROR"
    name: v.string(),
    description: v.string(),
    severity: v.string(), // "blocking" | "advisory"
    enabled: v.boolean(),
    source: v.optional(v.string()), // citation
    // triggerScope: empty array on a key = matches anything for that key
    triggerScope: v.object({
      procedureCodes: v.optional(v.array(v.string())),         // DE 1/10 4-digit
      additionalProcedureCodes: v.optional(v.array(v.string())), // DE 1/11 3-digit
      commodityPrefixes: v.optional(v.array(v.string())),      // HS prefix match (any length)
      originCountries: v.optional(v.array(v.string())),        // ISO alpha-2
      // ISO alpha-2 codes the rule explicitly does NOT apply to. Used when a
      // tariff measure targets a region group (e.g. "All third countries")
      // but excludes specific countries via measure.excluded_countries.
      excludedOriginCountries: v.optional(v.array(v.string())),
      // When true, the rule only applies if the declaration actually claims a
      // tariff preference. Used by tariff measure types 142/143 (preference /
      // suspension under quota) — these only kick in when the trader is
      // claiming preferential treatment, not on every import.
      requiresPreferenceClaim: v.optional(v.boolean()),
      dispatchCountries: v.optional(v.array(v.string())),      // ISO alpha-2
      valuationMethods: v.optional(v.array(v.string())),       // DE 4/16
      transportModes: v.optional(v.array(v.string())),         // DE 7/4
      declarationTypes: v.optional(v.array(v.string())),       // IMA, IMD, etc.
      modes: v.optional(v.array(v.string())),                  // "minimal" | "enriched"
    }),
    // effects: any combination — all are optional
    effects: v.object({
      requiredDocuments: v.optional(v.array(v.object({
        code: v.string(),                       // e.g. "N935"
        alternatives: v.optional(v.array(v.string())), // any-of satisfies
        lpcoExemptionCode: v.optional(v.string()),
        reason: v.optional(v.string()),
      }))),
      forbiddenDocuments: v.optional(v.array(v.object({
        code: v.string(),
        reason: v.optional(v.string()),
      }))),
      requiredFields: v.optional(v.array(v.object({
        path: v.string(),  // e.g. "declaration.dispatchCountry"
        reason: v.optional(v.string()),
      }))),
      forbiddenFields: v.optional(v.array(v.object({
        path: v.string(),
        reason: v.optional(v.string()),
      }))),
      predicates: v.optional(v.array(v.object({
        name: v.string(),  // see PredicateName in rule_engine.ts
        reason: v.optional(v.string()),
        tolerance: v.optional(v.number()),
      }))),
    }),
    // Provenance metadata for tariff-derived rules. Lets the dry-run output
    // surface measure_id, measure_type, geographical area, and validity dates
    // alongside the rule result so a reviewer can verify against the source.
    // Curated (source kind = "curated") rules carry an `evidence` block instead
    // — pointing at the CDS rejection (MRN/conversationId/FunctionCode 03) that
    // proved the requirement.
    metadata: v.optional(v.object({
      measureId: v.optional(v.string()),
      measureTypeId: v.optional(v.string()),
      measureTypeDescription: v.optional(v.string()),
      geographicalAreaId: v.optional(v.string()),
      geographicalAreaDescription: v.optional(v.string()),
      effectiveStartDate: v.optional(v.string()),
      effectiveEndDate: v.optional(v.string()),
      evidence: v.optional(v.object({
        mrn: v.optional(v.string()),
        conversationId: v.optional(v.string()),
        functionCode: v.optional(v.string()),  // "03" = rejection
        references: v.optional(v.array(v.string())),  // WCO section codes (42A/67A/68A)
        confidence: v.optional(v.string()),  // "high" | "medium"
        observedAt: v.optional(v.number()),
      })),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ruleId", ["ruleId"])
    .index("by_enabled", ["enabled"]),

  // Cached UK Trade Tariff API response per commodity. Source of truth for
  // any tariff-derived rule_definitions — the parser cites rows from here.
  // We cache because the parser walks the response on every refresh and the
  // payload for a single 10-digit commodity is ~350KB.
  // Endpoint: https://www.trade-tariff.service.gov.uk/uk/api/commodities/{code}
  // Header:   Accept: application/vnd.hmrc.2.0+json
  tariff_cache: defineTable({
    commodityCode: v.string(),    // 10-digit HS code
    fetchedAt: v.number(),
    sourceUrl: v.string(),
    rawResponse: v.any(),         // full JSON:API document
    derivedRuleIds: v.optional(v.array(v.string())), // ruleIds parsed out, for cleanup on refresh
  }).index("by_commodity", ["commodityCode"]),

  // Per-declaration evaluation output. Recomputed on every relevant write
  // (declaration update, item write, document linkage). The submit blocker
  // refuses to call HMRC when any blocking row has status="fail".
  validation_results: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    ruleId: v.string(),
    ruleName: v.string(),
    severity: v.string(),  // "blocking" | "advisory"
    status: v.string(),    // "pass" | "fail" | "skip"
    // Provenance: "core" = hand-curated CDS rule; "tariff" = parsed from
    // gov.uk Trade Tariff API. Lets the dashboard distinguish "this is a
    // standing CDS rule" from "this came from today's tariff snapshot".
    source: v.optional(v.string()),
    // Tariff measure_id when source = "tariff" — links the row back to the
    // exact measure in tariff_cache.rawResponse.included[].
    measureId: v.optional(v.string()),
    field: v.optional(v.string()),
    reason: v.optional(v.string()),
    evidence: v.optional(v.any()), // arbitrary debug context
    evaluatedAt: v.number(),
  })
    .index("by_declaration", ["declarationId"])
    .index("by_declaration_status", ["declarationId", "status"])
    .index("by_user", ["userId"]),

  // Immutable, append-only evidence of every request sent to HMRC. Captures the
  // exact request XML, the LRN used, and a point-in-time snapshot of the
  // declaration + items AS SUBMITTED — so a submission can be reconstructed for
  // audit even after the editable declaration/goods_items rows change. Never
  // patched or deleted.
  submissions: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    /** HMRC environment this request was sent to (sandbox | production). */
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    operation: v.string(), // "submit" | "amend" | "cancel"
    outcome: v.optional(v.string()), // "accepted" | "rejected" | "error"
    conversationId: v.optional(v.string()),
    lrn: v.optional(v.string()),
    eori: v.optional(v.string()),
    priorMrn: v.optional(v.string()),
    hmrcStatus: v.optional(v.number()),
    requestXml: v.string(),
    declarationSnapshot: v.optional(v.any()),
    itemsSnapshot: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_declaration", ["declarationId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_user", ["userId"]),
});
