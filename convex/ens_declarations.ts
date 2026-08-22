/**
 * ENS (Safety & Security GB) declaration persistence.
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md`
 * Domain model: `src/lib/ens/types.ts`
 *
 * Separate from `declarations.ts`, which is CDS/WCO-shaped. The two message
 * families share no identifiers and no lifecycle.
 *
 * Access control follows the same pattern as the CDS tables: every function
 * authenticates, then checks tenancy through `canAccessDeclaration`, which
 * compares the row's `userId`/`orgId` against the caller's active org.
 */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { canAccessDeclaration, resolveOrgIdForNewRecord } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

/** Party shape from src/lib/ens/types.ts. Validated at the boundary, not in the table. */
const partyValidator = v.object({
  eori: v.optional(v.string()),
  name: v.optional(v.string()),
  streetAndNumber: v.optional(v.string()),
  postcode: v.optional(v.string()),
  city: v.optional(v.string()),
  countryCode: v.optional(v.string()),
});

const goodsItemValidator = v.any();

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
  if (!identity) throw unauthenticatedError();
  return identity;
}

/** Create a draft ENS. Environment is stamped now and locked at first submission. */
export const createEnsDeclaration = mutation({
  args: {
    localReferenceNumber: v.string(),
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const lrn = args.localReferenceNumber.trim();
    if (!lrn) {
      throw userError("ens_lrn_required", "A local reference number is required.");
    }

    // The LRN must be unique — HMRC rejects a duplicate with nonUniqueLRN, and
    // that rejection arrives asynchronously, long after the operator has moved on.
    const clash = await ctx.db
      .query("ens_declarations")
      .withIndex("by_lrn", (q) => q.eq("localReferenceNumber", lrn))
      .first();
    if (clash) {
      throw userError(
        "ens_lrn_duplicate",
        `Local reference number "${lrn}" is already in use. HMRC rejects duplicates.`,
      );
    }

    const now = Date.now();
    return await ctx.db.insert("ens_declarations", {
      userId: identity.subject,
      orgId: await resolveOrgIdForNewRecord(ctx, identity.subject),
      clientId: args.clientId,
      environment: args.environment ?? "sandbox",
      status: "draft",
      localReferenceNumber: lrn,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateEnsDeclaration = mutation({
  args: {
    id: v.id("ens_declarations"),
    transportModeAtBorder: v.optional(v.string()),
    identityOfMeansOfTransport: v.optional(v.string()),
    nationalityOfMeansOfTransport: v.optional(v.string()),
    totalGrossMass: v.optional(v.union(v.number(), v.null())),
    declarationPlace: v.optional(v.string()),
    specificCircumstanceIndicator: v.optional(v.string()),
    transportChargesMethodOfPayment: v.optional(v.string()),
    commercialReferenceNumber: v.optional(v.string()),
    conveyanceReferenceNumber: v.optional(v.string()),
    placeOfLoading: v.optional(v.string()),
    placeOfUnloading: v.optional(v.string()),
    customsOfficeOfFirstEntry: v.optional(v.string()),
    expectedArrivalDateTime: v.optional(v.string()),
    subsequentEntryOffices: v.optional(v.array(v.string())),
    lodgementCustomsOffice: v.optional(v.string()),
    consignor: v.optional(partyValidator),
    consignee: v.optional(partyValidator),
    notifyParty: v.optional(partyValidator),
    representative: v.optional(partyValidator),
    personLodgingSummaryDeclaration: v.optional(partyValidator),
    carrier: v.optional(partyValidator),
    itinerary: v.optional(v.array(v.object({ countryCode: v.string() }))),
    seals: v.optional(v.array(v.object({ sealIdentity: v.string() }))),
    goodsItems: v.optional(v.array(goodsItemValidator)),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw forbiddenError();
    }

    // Once submitted the payload is evidence of what was sent. Amendments go
    // through submitted-state fields, never by editing the original in place.
    if (existing.status !== "draft" && existing.status !== "rejected") {
      throw userError(
        "ens_not_editable",
        `This ENS is ${existing.status} and can no longer be edited. Submit an amendment instead.`,
      );
    }

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * Record a submission attempt and its result.
 *
 * Called by the API route after HMRC responds. The correlation ID is written in
 * the same transaction as the status change: it is the only handle on the
 * submission until an MRN exists, so a partial write orphans the declaration.
 */
export const recordEnsSubmission = mutation({
  args: {
    id: v.id("ens_declarations"),
    operation: v.union(v.literal("submit"), v.literal("amend")),
    messageType: v.string(),
    httpStatus: v.optional(v.number()),
    correlationId: v.optional(v.string()),
    requestXml: v.optional(v.string()),
    responseXml: v.optional(v.string()),
    requestHash: v.optional(v.string()),
    errors: v.optional(v.any()),
    outcome: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw forbiddenError();
    }

    const now = Date.now();
    await ctx.db.insert("ens_submissions", {
      ensDeclarationId: args.id,
      userId: identity.subject,
      orgId: existing.orgId,
      environment: existing.environment,
      operation: args.operation,
      messageType: args.messageType,
      correlationId: args.correlationId,
      localReferenceNumber: existing.localReferenceNumber,
      movementReferenceNumber: existing.movementReferenceNumber,
      httpStatus: args.httpStatus,
      outcome: args.outcome,
      requestXml: args.requestXml,
      responseXml: args.responseXml,
      errors: args.errors,
      createdAt: now,
    });

    // A correlation id means HMRC accepted the MESSAGE. The declaration itself
    // is still unresolved until an outcome arrives, so status becomes
    // "submitted", never "accepted".
    if (args.correlationId) {
      await ctx.db.patch(args.id, {
        status: "submitted",
        correlationId: args.correlationId,
        submittedAt: now,
        requestHash: args.requestHash,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(args.id, { status: "failed", updatedAt: now });
    }
    return args.id;
  },
});

export const getEnsDeclaration = query({
  args: { id: v.id("ens_declarations") },
  handler: async (ctx, args) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return null;
    const row = await ctx.db.get(args.id);
    if (!row || !(await canAccessDeclaration(ctx, identity.subject, row))) return null;

    const outcomes = await ctx.db
      .query("ens_outcomes")
      .withIndex("by_declaration", (q) => q.eq("ensDeclarationId", args.id))
      .collect();
    const notifications = await ctx.db
      .query("ens_notifications")
      .withIndex("by_declaration", (q) => q.eq("ensDeclarationId", args.id))
      .collect();
    const submissions = await ctx.db
      .query("ens_submissions")
      .withIndex("by_declaration", (q) => q.eq("ensDeclarationId", args.id))
      .collect();

    return {
      ...row,
      outcomes: outcomes.sort((a, b) => a.receivedAt - b.receivedAt),
      notifications: notifications.sort((a, b) => a.receivedAt - b.receivedAt),
      submissions: submissions.sort((a, b) => a.createdAt - b.createdAt),
      /** Surfaced separately so a stop condition never needs a nested lookup. */
      hasDoNotLoad: notifications.some((n) => n.doNotLoad && !n.acknowledgedAt),
    };
  },
});

export const listEnsDeclarations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return [];
    const rows = await ctx.db.query("ens_declarations").order("desc").take(args.limit ?? 100);
    const visible: typeof rows = [];
    for (const row of rows) {
      if (await canAccessDeclaration(ctx, identity.subject, row)) visible.push(row);
    }
    return visible;
  },
});

/** Declarations whose outcome has not arrived — the poller's work list. */
export const listAwaitingOutcome = query({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as { subject: string } | null;
    if (!identity) return [];
    const rows = await ctx.db.query("ens_declarations").order("desc").take(500);
    const visible = [];
    for (const row of rows) {
      if (row.status !== "submitted") continue;
      if (await canAccessDeclaration(ctx, identity.subject, row)) visible.push(row);
    }
    return visible;
  },
});
