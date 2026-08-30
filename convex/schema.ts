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
    /**
     * Lowercased, trimmed `email`. Exists so an address can be looked up by
     * index: the portal-email guard previously scanned a bounded window of users
     * and silently stopped matching once the table outgrew it.
     */
    emailNormalized: v.optional(v.string()),
    name: v.optional(v.any()),
    orgId: v.optional(v.any()),
    role: v.optional(v.string()),
    /** Set when personal-scoped rows are attached to a Clerk org — hides Personal in org switcher */
    personalMigratedAt: v.optional(v.number()),
    /** @deprecated Removed from product — strip via stripLegacyClaimedForOrgId then delete from schema */
    legacyClaimedForOrgId: v.optional(v.string()),
    /** broker | managed_service — set when onboarding form is submitted */
    onboardingPath: v.optional(v.union(v.literal("broker"), v.literal("managed_service"))),
    onboardingCompletedAt: v.optional(v.number()),
  })
    .index("by_clerk", ["clerkId"])
    .index("by_email_normalized", ["emailNormalized"])
    // Notification fan-out resolves org members by this index. Without it the
    // emitter would scan the whole users table on every org-scoped event.
    .index("by_org", ["orgId"]),

  trade_lanes: defineTable({
    userId: v.string(),
    orgId: v.optional(v.string()),
    code: v.string(),
    originName: v.string(),
    originCountryCode: v.string(),
    originUNLocode: v.string(),
    destinationName: v.string(),
    destinationCountryCode: v.string(),
    destinationUNLocode: v.string(),
    vesselImo: v.optional(v.string()),
    mode: v.union(v.literal("ocean"), v.literal("air"), v.literal("rail"), v.literal("road")),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"]),

  /** Self-serve onboarding form payload (before org for brokers; client create for managed). */
  onboarding_profiles: defineTable({
    clerkId: v.string(),
    path: v.union(v.literal("broker"), v.literal("managed_service")),
    companyName: v.string(),
    legalEntityType: v.optional(v.string()),
    companyRegistrationNumber: v.optional(v.string()),
    tradingName: v.optional(v.string()),
    country: v.string(),
    addressLine: v.string(),
    postcode: v.string(),
    city: v.optional(v.string()),
    website: v.optional(v.string()),
    eori: v.optional(v.string()),
    contactName: v.string(),
    contactJobTitle: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    cdsSubscribed: v.optional(v.boolean()),
    termsAcceptedAt: v.optional(v.number()),
    clientId: v.optional(v.id("clients")),
    createdAt: v.number(),
    updatedAt: v.number(),
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
    /**
     * Org is entitled to file inventory-linked declarations through
     * FreightCode's managed CNS clearance (badge RKA). Off by default: this
     * gates a route that submits under FreightCode's own CSP badge.
     */
    cnsClearanceEnabled: v.optional(v.boolean()),
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
    /** Set when later assessment changes make this historical sign-off stale. */
    supersededAt: v.optional(v.number()),
    supersededBy: v.optional(v.string()),
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
    additionalDeclarationType: v.optional(v.string()),
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
    // DE 7/10 — Container identification number. Drives DE 7/2 ContainerCode
    // ("1" when present, "0" when not) and the TransportEquipment element.
    // Required for CNS inventory-linked imports: the CSP pre-check matches the
    // declared container against the inventory record.
    containerNumber: v.optional(v.string()),
    // DE 3/1 — overseas exporter Name+Address when dispatch ≠ GB/XI.
    exporterName: v.optional(v.string()),
    exporterCity: v.optional(v.string()),
    exporterLine: v.optional(v.string()),
    exporterPostcode: v.optional(v.string()),
    exporterEori: v.optional(v.string()),
    /**
     * Export declaration category (B1 standard export / re-export, C1 C&F
     * simplified). Absent means the import family — the H1 path. Obligations:
     * `docs/hmrc/specs/cds-api/appendix-22a-b1-obligations.md`.
     */
    declarationCategory: v.optional(
      v.union(v.literal("B1"), v.literal("C1"), v.literal("I1")),
    ),
    // DE 3/1 country for the export exporter block — on an export the exporter
    // is the declaring party, so its country is not the dispatch country.
    exporterCountry: v.optional(v.string()),
    // DE 3/9 + 3/10 — Consignee. The export counterpart of DE 3/15/3/16 Importer.
    consigneeEori: v.optional(v.string()),
    consigneeName: v.optional(v.string()),
    consigneeCity: v.optional(v.string()),
    consigneeLine: v.optional(v.string()),
    consigneePostcode: v.optional(v.string()),
    consigneeCountry: v.optional(v.string()),
    // DE 3/31 + 3/32 — Carrier (Declaration/Consignment/Carrier).
    carrierEori: v.optional(v.string()),
    carrierName: v.optional(v.string()),
    // DE 3/39 — holder of the authorisation. Conditional on B1, mandatory on C1.
    authorisationHolderEori: v.optional(v.string()),
    authorisationCategoryCode: v.optional(v.string()),
    // DE 4/2 — transport charges method of payment.
    transportChargesMethodOfPayment: v.optional(v.string()),
    // DE 4/15 — exchange rate.
    exchangeRate: v.optional(v.string()),
    // DE 5/12 — customs office of exit. Mandatory on B1 and C1, no import equivalent.
    customsOfficeOfExit: v.optional(v.string()),
    // DE 5/18 — countries of routing, in transit order.
    countriesOfRouting: v.optional(v.array(v.string())),
    // DE 7/5 — inland mode of transport.
    inlandTransportMode: v.optional(v.string()),
    // DE 7/7 — identity of the means of transport at departure. Export uses
    // departure identity; ArrivalTransportMeans is import-only.
    departureTransportId: v.optional(v.string()),
    departureTransportIdType: v.optional(v.string()),
    // DE 7/14 + 7/15 — active means crossing the border, and its nationality.
    borderTransportId: v.optional(v.string()),
    borderTransportIdType: v.optional(v.string()),
    borderTransportNationality: v.optional(v.string()),
    // DE 7/10 container id is `containerNumber`, declared with the CNS
    // transport fields below — one field, not two.
    // DE 7/18 — seal number.
    sealNumber: v.optional(v.string()),
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
    // H1 DE 4/16 Method 1 confirmation. Required when consignment value
    // exceeds £20,000 and representation is not self. Group 4 DE 4/16.
    h1Method1ConfirmedAt: v.optional(v.number()),
    h1Method1ConfirmedBy: v.optional(v.string()),
    // The broker's client this declaration is filed for (the represented
    // trader). Optional — self-serve declarations have no separate client.
    clientId: v.optional(v.id("clients")),

    /**
     * CNS inventory-linked transport (docs/cns/plan/).
     *
     * submissionTransport is stamped before the first outbound attempt and is
     * immutable thereafter: amendments and cancellations must follow the route
     * the declaration was created on. Absent on every pre-CNS row, which is
     * treated as "hmrc_direct".
     */
    submissionTransport: v.optional(
      v.union(v.literal("hmrc_direct"), v.literal("cns_inventory")),
    ),
    cnsEnvironment: v.optional(v.union(v.literal("euat"), v.literal("production"))),
    /** Badge the declaration was submitted under. Recorded for audit. */
    cnsBadgeId: v.optional(v.string()),
    cnsTopic: v.optional(v.string()),
    /** Operator-selected CNS inventory record (UCN). */
    cnsUcn: v.optional(v.string()),
    cnsGoodsLocationCode: v.optional(v.string()),
    /** Declaration-side inventory reference type — expected MCR. */
    cnsInventoryReferenceType: v.optional(v.string()),
    /**
     * Latest X-CSP-ID. Transport correlation for the initial request and any
     * inventory pre-check failure. NOT a declaration tracking id — the LRN is.
     */
    cnsCspId: v.optional(v.string()),
    /**
     * Machine transport state, held alongside (not instead of) `status`. The
     * human-readable status vocabulary is consumed across dashboard, portal and
     * read models and is deliberately left untouched.
     */
    cnsTransportState: v.optional(v.string()),
    /** Inventory state as observed: registered / arrived / rejected / linked. */
    cnsInventoryState: v.optional(v.string()),
    cnsInventoryErrorCode: v.optional(v.string()),
    cnsInventoryIrcCode: v.optional(v.string()),
    cnsInventoryErrorMessage: v.optional(v.string()),
    cnsLastNotificationAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_mrn", ["mrn"])
    .index("by_conversationId", ["conversationId"])
    .index("by_cnsCspId", ["cnsCspId"])
    .index("by_org_transport_status", ["orgId", "submissionTransport", "status"])
    // Stuck-declaration recovery scans by status + staleness. Without this the
    // hourly cron reads the whole table.
    .index("by_status_and_updated", ["status", "lastUpdated"])
    .index("by_client", ["clientId"]),

  // Broker's client/trader profiles. A reusable party record (the importer the
  // broker files on behalf of) scoped to the broker's Clerk org. This is DATA
  // only — portal login is a separate layer via portalEmail / portalClerkId.
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
    /**
     * This client holds their own licensed CNS badge.
     *
     * CNS compliance rule: inventory-linked declarations must be filed under the
     * badge the inventory is assigned to, and one badge must not be shared
     * across multiple client logins. When true, FreightCode cannot file
     * inventory-linked entries for this client under badge RKA — they must
     * submit under their own. FreightCode may still act as declarant for their
     * non-inventory-linked work.
     */
    cnsBadgeHolder: v.optional(v.boolean()),
    /**
     * This client was created by Managed Service onboarding, not by a broker.
     *
     * Recorded on the row because ownership must not be inferred by comparing
     * orgId to FREIGHTCODE_MANAGED_ORG_ID: that variable can change, and when it
     * did, every existing Managed Service customer was reclassified as a
     * broker's client and locked out of sign-in with a message telling them to
     * contact support. A row states what it is; the env var only says which org
     * *new* rows go to.
     */
    managedService: v.optional(v.boolean()),
    // Client portal auth mapping (Clerk). Lowercased email; clerkId patched on first match.
    portalEmail: v.optional(v.string()),
    portalClerkId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_portal_email", ["portalEmail"])
    .index("by_portal_clerk", ["portalClerkId"]),

  // Broker ↔ client portal messaging. Do NOT reuse conversations/messages (AI assistant).
  // Threads are filing/case-scoped: declarationId XOR assessmentId on new sends.
  portal_messages: defineTable({
    declarationId: v.optional(v.id("declarations")),
    assessmentId: v.optional(v.id("export_assessments")),
    clientId: v.id("clients"),
    orgId: v.optional(v.string()),
    senderRole: v.union(v.literal("broker"), v.literal("client")),
    senderId: v.string(),
    body: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_client", ["clientId"])
    .index("by_client_sender_read", ["clientId", "senderRole", "readAt"])
    .index("by_declaration", ["declarationId"])
    .index("by_assessment", ["assessmentId"]),

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
    // DE 8/6 — statistical value. Conditional on B1 export items.
    statisticalValue: v.optional(v.number()),
    // DE 6/9 — package type code (PK, BX, CT, etc.). Mandatory per Appendix 21A H1.
    packageType: v.optional(v.string()),
  }).index("by_declaration", ["declarationId"]).index("by_owner", ["ownerId"]),

  documents: defineTable({
    userId: v.optional(v.any()),
    orgId: v.optional(v.string()),
    /** Portal client that supplied the document, including before it is linked to a filing. */
    clientId: v.optional(v.id("clients")),
    workspaceId: v.optional(v.any()),
    fileId: v.optional(v.any()),
    fileName: v.optional(v.any()),
    fileType: v.optional(v.any()),
    fileSize: v.optional(v.number()),
    status: v.optional(v.any()),
    uploadDate: v.optional(v.any()),
    mrn: v.optional(v.any()),
    declarationId: v.optional(v.any()),
    linkedBy: v.optional(v.string()),
    linkedAt: v.optional(v.number()),
    sourceMessageId: v.optional(v.id("portal_messages")),
    auditStatus: v.optional(v.any()),
    auditResult: v.optional(v.any()),
    ocrText: v.optional(v.string()),
    hmrcUploadReference: v.optional(v.string()),
    hmrcConversationId: v.optional(v.string()),
    /**
     * Position within the HMRC file-upload group this file was sent in. HMRC
     * accepts up to 11 files per initiate and returns one Reference each;
     * keeping the pair lets an outcome notification be traced back to the file
     * and to the other files it was sent with.
     */
    fileSequenceNo: v.optional(v.number()),
    fileGroupSize: v.optional(v.number()),
    /**
     * DE 2/2 StatementCode from the DMSDOC documentary check this file answers,
     * when it was sent in response to one. Absent on a proactive upload.
     */
    requestedStatementCode: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_client", ["clientId"])
    .index("by_source_message", ["sourceMessageId"])
    .index("by_mrn", ["mrn"])
    .index("by_declaration", ["declarationId"])
    // Lets an orphaned upload be discarded without deleting a file a row claims.
    .index("by_file", ["fileId"]),

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
    /**
     * submit | amend | cancel — which request this notification answers, resolved
     * from the submissions row sharing its conversationId. HMRC issues a distinct
     * conversation id per request, so this is the reliable discriminator. Payload
     * LRN prefixes are not: CNS follow-ups carry the original create LRN.
     */
    originatingOperation: v.optional(v.string()),
    /** HMRC Response FunctionCode, when parsed from rawPayload. */
    functionCode: v.optional(v.string()),
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

  /**
   * The in-app inbox. Distinct from `notifications` above, which is the
   * append-only HMRC evidence log and stays HMRC-sourced only (CLAUDE.md).
   * Rows here are app-layer and disposable: an HMRC row is *mirrored* into this
   * table carrying `sourceTable`/`sourceId` back to the evidence, so pruning the
   * inbox never destroys a record.
   *
   * Delivery is fan-out — one row per recipient, not one shared row plus a
   * read-state join table. Per-user preferences can then be applied at emit time
   * and the unread count stays a single indexed read.
   * See docs/notifications/IMPLEMENTATION-PLAN.md §3.1 and §7.1.
   */
  app_notifications: defineTable({
    /** Exactly one audience is set: `userId` for staff, `clientId` for portal contacts. */
    userId: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    /** Tenant tag on staff rows. Undefined = personal workspace. */
    orgId: v.optional(v.string()),

    /** Typed key from convex/lib/notification_events.ts — never a free string. */
    event: v.string(),
    category: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("action_required"),
      v.literal("info"),
    ),

    /** Resolved at emit time so history survives later label changes. */
    title: v.string(),
    body: v.optional(v.string()),
    href: v.optional(v.string()),

    declarationId: v.optional(v.id("declarations")),
    sourceTable: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),

    /** User-facing read state. Unrelated to `notifications.processed`, a pipeline flag. */
    readAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    // orgId sits between the audience and the sort key so switching active org
    // filters without a table scan.
    .index("by_user_org_created", ["userId", "orgId", "createdAt"])
    .index("by_user_org_read", ["userId", "orgId", "readAt"])
    .index("by_client_created", ["clientId", "createdAt"])
    .index("by_client_read", ["clientId", "readAt"])
    .index("by_declaration", ["declarationId"])
    .index("by_dedupeKey", ["dedupeKey"]),

  /**
   * Per-user, per-category delivery preferences. A missing row means "use the
   * category default" (convex/lib/notification_events.ts), so no backfill is
   * needed and defaults can change without rewriting stored rows.
   */
  notification_preferences: defineTable({
    userId: v.string(),
    /** Per-org override. Undefined = the user's personal-workspace setting. */
    orgId: v.optional(v.string()),
    category: v.string(),
    inApp: v.boolean(),
    /** Stored now, not delivered — email is a later pass. */
    email: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_org_category", ["userId", "orgId", "category"])
    .index("by_user", ["userId"]),

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
    declarationCategory: v.optional(v.string()),
    cdsBadgeLabel: v.optional(v.string()),
    cdsBadgeTone: v.optional(v.string()),
    representationType: v.optional(
      v.union(v.literal("self"), v.literal("direct"), v.literal("indirect")),
    ),
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
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_user", ["userId"])
    // Entity-scoped retrieval. Third-party actions (consultant sign-off, end-user
    // EUSU submission) are logged under their own userId, so by_user cannot be
    // used to assemble a complete trail for one assessment.
    .index("by_details_assessment", ["details.assessmentId"]),

  // --- Export controls module (UK strategic export assessments) ---
  export_assessments: defineTable({
    userId: v.string(),
    orgId: v.optional(v.string()),
    declarationId: v.optional(v.id("declarations")),
    /** Portal client this assessment belongs to (same idea as declarations.clientId). */
    clientId: v.optional(v.id("clients")),
    reference: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("clear"),
      v.literal("flagged"),
      v.literal("review_required"),
    ),
    originJurisdiction: v.optional(v.union(v.literal("GB"), v.literal("NI"))),
    destinationCountry: v.optional(v.string()),
    consignee: v.optional(v.any()),
    endUser: v.optional(v.any()),
    intendedUse: v.optional(v.string()),
    endUserStatement: v.optional(v.any()),
    submissionRoute: v.optional(
      v.union(v.literal("lite"), v.literal("spire"), v.literal("otsi"), v.literal("none")),
    ),
    controlListVersion: v.optional(v.string()),
    sanctionsVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_declaration", ["declarationId"])
    .index("by_client", ["clientId"]),

  export_products: defineTable({
    assessmentId: v.id("export_assessments"),
    name: v.string(),
    manufacturer: v.optional(v.string()),
    modelNo: v.optional(v.string()),
    partNo: v.optional(v.string()),
    quantity: v.optional(v.number()),
    valueGbp: v.optional(v.number()),
    techDescription: v.optional(v.string()),
    sourceDocumentId: v.optional(v.id("documents")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_assessment", ["assessmentId"]),

  export_product_specs: defineTable({
    productId: v.id("export_products"),
    key: v.string(),
    valueRaw: v.string(),
    valueNum: v.optional(v.number()),
    unit: v.optional(v.string()),
    sourceDocId: v.optional(v.id("documents")),
    sourcePage: v.optional(v.number()),
    sourceQuote: v.optional(v.string()),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_product", ["productId"]),

  export_classification_runs: defineTable({
    productId: v.id("export_products"),
    assessmentId: v.id("export_assessments"),
    candidates: v.optional(v.any()),
    finalControlEntry: v.optional(v.string()),
    confidence: v.optional(v.number()),
    requiresReview: v.boolean(),
    controlListVersion: v.optional(v.string()),
    sanctionsVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    modelVersion: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_product", ["productId"]),

  sanctions_screenings: defineTable({
    assessmentId: v.id("export_assessments"),
    subjectType: v.union(
      v.literal("exporter"),
      v.literal("consignee"),
      v.literal("end_user"),
      v.literal("intermediary"),
      v.literal("vessel"),
    ),
    subjectName: v.string(),
    matchedUniqueId: v.optional(v.string()),
    score: v.optional(v.number()),
    matchReason: v.optional(v.string()),
    scoreBreakdown: v.optional(v.any()),
    sanctionsVersion: v.optional(v.string()),
    reviewStatus: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("dismissed")),
    reviewedBy: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_assessment", ["assessmentId"]),

  expert_requests: defineTable({
    assessmentId: v.id("export_assessments"),
    requestedBy: v.string(),
    /**
     * "consultant_dispatch" marks a row created by Request sign-off. Other
     * reason codes come from `createExpertRequest` and are unrelated internal
     * review flags — the consultant status lookup must not confuse the two.
     */
    reasonCode: v.string(),
    slaDueAt: v.optional(v.number()),
    status: v.string(),
    /**
     * Frozen review subject — see convex/lib/consultant_review_snapshot.ts.
     * Immutable once written: a later exporter edit must not change what the
     * consultant was asked to review.
     */
    assessmentSnapshot: v.any(),
    consultantEmail: v.optional(v.string()),
    consultantName: v.optional(v.string()),
    consultantRole: v.optional(
      v.union(v.literal("adviser"), v.literal("applies_on_behalf"), v.literal("eor")),
    ),
    senderNote: v.optional(v.string()),
    advisoryNotes: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("cleared"), v.literal("blocked"))),
    applicationRef: v.optional(v.string()),
    licenceRef: v.optional(v.string()),
    licenceType: v.optional(
      v.union(
        v.literal("siel"),
        v.literal("sitcl"),
        v.literal("sitl"),
        v.literal("f680"),
        v.literal("oiel"),
        v.literal("oitcl"),
        v.literal("ogel"),
        v.literal("otsi"),
        v.literal("other"),
      ),
    ),
    completedAt: v.optional(v.number()),

    // --- external consultant system (Phase 1: BEC) ---
    /** Partner that received this case. "bec" today; generic by design. */
    externalSystem: v.optional(v.string()),
    /** Case id the partner returned. Correlates their record with ours. */
    externalCaseId: v.optional(v.string()),
    deliveryStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("delivered"),
        v.literal("failed"),
        v.literal("revoked"),
        v.literal("expired"),
      ),
    ),
    deliveredAt: v.optional(v.number()),
    deliveryError: v.optional(v.string()),
    /** Dispatch validity. Past this, the partner may no longer complete it. */
    expiresAt: v.optional(v.number()),
    /** Indexed lifecycle flag for bounded expiry sweeps. */
    dispatchOpen: v.optional(v.boolean()),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
    /**
     * Set when a later exporter edit invalidates a completed dispatch. The
     * row stays for the audit trail; `status` becomes "superseded".
     */
    supersededAt: v.optional(v.number()),
    supersededBy: v.optional(v.string()),

    // --- reviewer identity on completion ---
    reviewerSystem: v.optional(v.string()),
    reviewerExternalId: v.optional(v.string()),
    reviewerEmail: v.optional(v.string()),
    /** True when the identity came from the reviewer's authenticated session. */
    reviewerVerified: v.optional(v.boolean()),

    /**
     * The end-user undertaking the reviewer confirmed having read.
     *
     * The review form makes the tick mandatory once a statement has been
     * submitted, so the completion carries which one was acknowledged rather
     * than leaving that gate on the client alone.
     */
    acknowledgedEndUserTokenId: v.optional(v.id("export_end_user_tokens")),
    acknowledgedEndUserAt: v.optional(v.number()),

    /** First partner-authenticated consultant to claim this dispatch. */
    assignedConsultantExternalId: v.optional(v.string()),
    assignedConsultantEmail: v.optional(v.string()),
    assignedConsultantName: v.optional(v.string()),
    assignedConsultantAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_external_case", ["externalSystem", "externalCaseId"])
    .index("by_dispatch_open_expiry", ["dispatchOpen", "expiresAt"]),

  export_review_tokens: defineTable({
    assessmentId: v.id("export_assessments"),
    expertRequestId: v.id("expert_requests"),
    orgId: v.optional(v.string()),
    /** Plaintext exists only on legacy sender-issued rows. */
    token: v.optional(v.string()),
    /** SHA-256 of a route-held session credential for handoff-issued rows. */
    tokenHash: v.optional(v.string()),
    consultantEmail: v.string(),
    consultantName: v.optional(v.string()),
    consultantRole: v.optional(
      v.union(v.literal("adviser"), v.literal("applies_on_behalf"), v.literal("eor")),
    ),
    senderNote: v.optional(v.string()),
    expiresAt: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    openedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    revoked: v.optional(v.boolean()),

    /**
     * How this token came to exist.
     *
     * "handoff" — minted when a partner redeemed a one-time launch code. Short
     * lived, and the consultant identity on it was proved by the partner's own
     * authenticated session, so completions carry a verified reviewer.
     *
     * "sender" — the legacy emailed link. A FreightCode user typed the
     * consultant's address and nothing verified who opened it. Retained as a
     * deliberate fallback for a partner outage, not the normal path.
     */
    issuedVia: v.optional(v.union(v.literal("handoff"), v.literal("sender"))),
    /** Partner slug that redeemed the handoff. */
    partnerSlug: v.optional(v.string()),
    /** The partner's own user id for the consultant. */
    consultantExternalId: v.optional(v.string()),
    consultantVerified: v.optional(v.boolean()),
  })
    .index("by_token", ["token"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_assessment", ["assessmentId"]),

  /**
   * One-time launch codes for the partner handoff.
   *
   * A partner's server asks for one, gets a URL back, and redirects the
   * consultant's browser to it. Redemption consumes the row and mints a
   * short-lived review token bound to the consultant identity the partner
   * asserted. Codes are stored as a SHA-256 hash — a database reader must not
   * be able to replay one inside its (short) validity window.
   */
  consultant_handoffs: defineTable({
    codeHash: v.string(),
    expertRequestId: v.id("expert_requests"),
    assessmentId: v.id("export_assessments"),
    partnerSlug: v.string(),
    consultantExternalId: v.string(),
    consultantEmail: v.optional(v.string()),
    consultantName: v.optional(v.string()),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    /** Review token minted on redemption, for the audit trail. */
    issuedTokenId: v.optional(v.id("export_review_tokens")),
    createdAt: v.number(),
  })
    .index("by_code_hash", ["codeHash"])
    .index("by_expert_request", ["expertRequestId"]),

  /** Durable replay claims for signed consultant-partner requests. */
  consultant_partner_requests: defineTable({
    partnerSlug: v.string(),
    requestId: v.string(),
    digest: v.string(),
    requestTimestamp: v.number(),
    receivedAt: v.number(),
  })
    .index("by_partner_request", ["partnerSlug", "requestId"])
    .index("by_partner_received_at", ["partnerSlug", "receivedAt"]),

  /** Durable, bounded-retry delivery of consultant case and status events. */
  consultant_partner_status_outbox: defineTable({
    expertRequestId: v.id("expert_requests"),
    partnerSlug: v.string(),
    externalCaseId: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("in_review"),
      v.literal("completed"),
      v.literal("blocked"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    /** Optional only for rows created before the durable event protocol. */
    eventId: v.optional(v.string()),
    eventType: v.optional(
      v.union(
        v.literal("consultant.case.created"),
        v.literal("consultant.case.status_changed"),
      ),
    ),
    eventKind: v.optional(v.union(v.literal("initial"), v.literal("status"))),
    occurredAt: v.optional(v.number()),
    sequence: v.optional(v.number()),
    /** Exact JSON bytes signed and retried for this event. */
    rawBody: v.optional(v.string()),
    state: v.union(
      v.literal("pending"),
      v.literal("delivering"),
      v.literal("delivered"),
      v.literal("superseded"),
      v.literal("exhausted"),
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    claimId: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    leaseExpiresAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    responseCaseId: v.optional(v.string()),
    exhaustedNotifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request_status", ["expertRequestId", "status"])
    .index("by_expert_request", ["expertRequestId"])
    .index("by_request_sequence", ["expertRequestId", "sequence"])
    .index("by_event_id", ["eventId"])
    .index("by_state_next_attempt", ["state", "nextAttemptAt"])
    .index("by_state_lease_expiry", ["state", "leaseExpiresAt"]),

  /** Append-only delivery history; a row is never updated after insertion. */
  consultant_partner_delivery_attempts: defineTable({
    outboxId: v.id("consultant_partner_status_outbox"),
    eventId: v.string(),
    claimId: v.string(),
    attemptNumber: v.number(),
    phase: v.union(
      v.literal("claimed"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("lease_expired"),
      v.literal("superseded"),
    ),
    occurredAt: v.number(),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    responseCaseId: v.optional(v.string()),
    responseBytes: v.optional(v.number()),
  })
    .index("by_outbox", ["outboxId", "occurredAt"])
    .index("by_event", ["eventId", "occurredAt"]),

  /** Immutable storage references captured in a consultant review packet. */
  consultant_review_files: defineTable({
    expertRequestId: v.id("expert_requests"),
    assessmentId: v.id("export_assessments"),
    evidenceId: v.id("export_evidence"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_request_evidence", ["expertRequestId", "evidenceId"])
    .index("by_storage", ["storageId"]),

  export_end_user_tokens: defineTable({
    assessmentId: v.id("export_assessments"),
    reviewTokenId: v.optional(v.id("export_review_tokens")),
    /** Legacy URL bearer. New rows never write this field. */
    token: v.optional(v.string()),
    /** Hash of the one-time code sent by email, removed when redeemed. */
    redemptionCodeHash: v.optional(v.string()),
    /** Hash of the separate HttpOnly-cookie session. */
    tokenHash: v.optional(v.string()),
    recipientEmail: v.string(),
    /** Where to send the "EUSU submitted" notification. */
    notifyEmail: v.optional(v.string()),
    senderNote: v.optional(v.string()),
    expiresAt: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    redeemedAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    notifiedAt: v.optional(v.number()),
    revoked: v.optional(v.boolean()),
    revokedAt: v.optional(v.number()),
    /** Immutable copy of the exact undertaking accepted from this recipient. */
    submittedStatement: v.optional(v.any()),
  })
    .index("by_token", ["token"])
    .index("by_redemption_code_hash", ["redemptionCodeHash"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_review_token", ["reviewTokenId"])
    .index("by_assessment", ["assessmentId"]),

  // Product evidence attached to an assessment for the DBT/ECJU supporting-doc bundle.
  export_evidence: defineTable({
    assessmentId: v.id("export_assessments"),
    orgId: v.optional(v.string()),
    kind: v.union(
      v.literal("technical_description"),
      v.literal("datasheet"),
      v.literal("brochure"),
      v.literal("web_page"),
      v.literal("commercial_invoice"),
      v.literal("eusu_signed"),
      v.literal("other"),
    ),
    label: v.string(),
    documentId: v.optional(v.id("documents")),
    url: v.optional(v.string()),
    note: v.optional(v.string()),
    productId: v.optional(v.id("export_products")),
    addedBy: v.string(),
    addedAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_document", ["documentId"]),

  export_licences: defineTable({
    assessmentId: v.id("export_assessments"),
    licenceType: v.union(
      v.literal("siel"),
      v.literal("sitcl"),
      v.literal("sitl"),
      v.literal("f680"),
      v.literal("oiel"),
      v.literal("oitcl"),
      v.literal("ogel"),
      v.literal("otsi"),
      v.literal("other"),
    ),
    applicationRef: v.optional(v.string()),
    licenceRef: v.optional(v.string()),
    route: v.optional(
      v.union(v.literal("lite"), v.literal("spire"), v.literal("otsi"), v.literal("none")),
    ),
    recordedBy: v.string(),
    recordedAt: v.number(),
  }).index("by_assessment", ["assessmentId"]),

  sanctions_versions: defineTable({
    publishedAt: v.string(),
    sourceHash: v.string(),
    entityCount: v.number(),
    storagePath: v.string(),
    ingestedAt: v.number(),
  }).index("by_publishedAt", ["publishedAt"]),

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

  financial_obligations: defineTable({
    declarationId: v.id("declarations"),
    userId: v.string(),
    orgId: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    mrn: v.optional(v.string()),
    obligationType: v.union(v.literal("duty_a00"), v.literal("vat_b00")),
    amount: v.number(),
    currency: v.string(),
    authority: v.union(v.literal("derived"), v.literal("hmrc")),
    status: v.union(v.literal("estimated"), v.literal("confirmed")),
    estimateAmount: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_declaration", ["declarationId"])
    .index("by_declaration_and_type", ["declarationId", "obligationType"])
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

    /** CNS transport fields. Absent on every direct-HMRC attempt. */
    transport: v.optional(
      v.union(v.literal("hmrc_direct"), v.literal("cns_inventory")),
    ),
    /**
     * X-CSP-ID from the CNS 202. On an inventory pre-check rejection this and
     * the LRN are the ONLY correlation keys — the notification carries no
     * ConversationID and a blank MRN.
     */
    cspId: v.optional(v.string()),
    /** Generated and persisted before the outbound call, for idempotency. */
    attemptKey: v.optional(v.string()),
    /** SHA-256 of the request XML. Never the Authorization value. */
    requestHash: v.optional(v.string()),
    endpoint: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    /**
     * "certain" once a definitive response arrived; "unknown" after a timeout or
     * 5xx where CNS may still have forwarded the declaration. Drives whether a
     * retry is permitted at all.
     */
    outcomeCertainty: v.optional(v.union(v.literal("certain"), v.literal("unknown"))),
    /** Normalised CNS error for operator display and support escalation. */
    cnsErrorCode: v.optional(v.string()),
    cnsErrorMessage: v.optional(v.string()),
  })
    .index("by_declaration", ["declarationId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_cspId", ["cspId"])
    .index("by_lrn", ["lrn"]),

  /**
   * Raw CNS notification envelopes.
   *
   * Separate from `notifications` deliberately: that table is HMRC-shaped
   * (conversationId / hmrcNotificationId) and has no topic, partition, Base64
   * body or acknowledgement state. Rows here are persisted BEFORE the batch is
   * acknowledged (Notification APIs v1.0.3 §10) and are the replay source when
   * parsing fails — CNS is not required to redeliver an acknowledged message.
   *
   * Decoded DMS bodies flow onward into `notifications` through the existing
   * parser, so the declaration timeline stays single-sourced.
   */
  cns_notifications: defineTable({
    topic: v.string(),
    /** CSP-assigned id. Unique per topic — the dedupe key. */
    notificationId: v.string(),
    partition: v.optional(v.number()),
    queuedDateTime: v.optional(v.string()),
    /** Every header from the envelope, verbatim. */
    headers: v.optional(v.any()),
    /** Per-notification Content-Type — determines body format, not the Accept type. */
    contentType: v.optional(v.string()),
    notificationType: v.optional(v.string()), // API | DMS | CILE | HEARTBEAT | UNKNOWN
    /** Retained alongside the decoded text for audit and parser replay. */
    bodyBase64: v.string(),
    bodyDecoded: v.optional(v.string()),
    /** Diagnostic only — never the dedupe key. */
    bodyHash: v.optional(v.string()),
    cspId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    badgeId: v.optional(v.string()),
    /** LRN recovered from the body — the permanent correlation key. */
    functionalReferenceId: v.optional(v.string()),
    declarationId: v.optional(v.id("declarations")),
    persistedAt: v.number(),
    ackedAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    parserError: v.optional(v.string()),
    parseAttempts: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_topic_and_notificationId", ["topic", "notificationId"])
    .index("by_declaration", ["declarationId"])
    .index("by_cspId", ["cspId"])
    .index("by_functionalReferenceId", ["functionalReferenceId"])
    // Drives the "persisted but not yet acknowledged" and "not yet parsed" sweeps.
    .index("by_topic_and_ackedAt", ["topic", "ackedAt"])
    .index("by_topic_and_processedAt", ["topic", "processedAt"]),

  /**
   * Poll lease and health per topic. Exactly one active poller may consume a
   * topic: querying a new batch before acknowledging the previous one causes the
   * unacknowledged messages to be redelivered in the next batch.
   */
  cns_poll_state: defineTable({
    topic: v.string(),
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    lastPollAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    consecutiveFailures: v.optional(v.number()),
    /** Earliest permitted next poll — enforces the 30s floor after a 204. */
    nextPollAt: v.optional(v.number()),
    mode: v.optional(v.union(v.literal("pull"), v.literal("push"))),
    lastError: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_topic", ["topic"]),
});
