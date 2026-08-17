import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { canAccessDeclaration } from "./lib/org_access";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

/**
 * CNS inventory-linked transport — declaration-side state.
 *
 * Notification ingestion lives in convex/cns_notifications.ts. This module owns
 * the route decision, its immutability, and the per-attempt record.
 *
 * See docs/cns/plan/.
 */

const submissionTransport = v.union(
  v.literal("hmrc_direct"),
  v.literal("cns_inventory"),
);

const cnsEnvironment = v.union(v.literal("euat"), v.literal("production"));

/**
 * Routing inputs the API route cannot read for itself: the org's CNS
 * entitlement and whether the client is separately badged.
 *
 * Returns conservative defaults (not entitled, not badged) rather than throwing
 * when the org or client is unknown — the routing function then refuses, which
 * is the safe direction.
 */
export const getRoutingContext = query({
  args: { declarationId: v.id("declarations") },
  returns: v.object({
    cnsClearanceEnabled: v.boolean(),
    cnsBadgeHolder: v.boolean(),
    storedTransport: v.optional(submissionTransport),
    cnsUcn: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }

    let cnsClearanceEnabled = false;
    if (decl.orgId) {
      const settings = await ctx.db
        .query("org_hmrc_settings")
        .withIndex("by_org", (q) => q.eq("orgId", decl.orgId as string))
        .first();
      cnsClearanceEnabled = settings?.cnsClearanceEnabled === true;
    }

    let cnsBadgeHolder = false;
    if (decl.clientId) {
      const client = await ctx.db.get(decl.clientId);
      cnsBadgeHolder = client?.cnsBadgeHolder === true;
    }

    return {
      cnsClearanceEnabled,
      cnsBadgeHolder,
      storedTransport: decl.submissionTransport,
      cnsUcn: decl.cnsUcn,
    };
  },
});

/**
 * Grant or revoke an organisation's entitlement to file through FreightCode's
 * managed CNS clearance.
 *
 * Internal deliberately: this authorises an org to submit under FreightCode's
 * own CSP badge, so it is an operations action, not a self-service setting.
 */
export const setOrgCnsClearance = internalMutation({
  args: { orgId: v.string(), enabled: v.boolean() },
  returns: v.object({ orgId: v.string(), cnsClearanceEnabled: v.boolean() }),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("org_hmrc_settings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (!settings) {
      throw userError("no_org_hmrc_settings_row_for", `No org_hmrc_settings row for ${args.orgId}.`);
    }
    await ctx.db.patch(settings._id, {
      cnsClearanceEnabled: args.enabled,
      updatedAt: Date.now(),
    });
    return { orgId: args.orgId, cnsClearanceEnabled: args.enabled };
  },
});

/**
 * The LRN the declaration was CREATED with.
 *
 * Both source specs require that the FunctionalReferenceID does not change for
 * an amendment or cancellation: "the LRN value does not change in the case of
 * making an amendment or cancellation requests for a declaration and you should
 * use the value provided when creating a declaration" (Customs Declaration API
 * v1.0.3). Under CNS this is not merely tidy — an inventory pre-check rejection
 * carries no ConversationID and a blank MRN, so the LRN is the only key that can
 * tie the notification back to this declaration.
 *
 * Read from the append-only submission evidence rather than the mutable
 * declaration row, so it reflects what was actually sent.
 */
export const getCreateLrn = query({
  args: { declarationId: v.id("declarations") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }

    const attempts = await ctx.db
      .query("submissions")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("desc")
      .take(100);

    // The accepted create attempt is authoritative. A rejected create may be
    // re-sent under the same LRN, so an accepted one always exists for a
    // declaration that reached CDS.
    const accepted = attempts.find(
      (row) => row.operation === "submit" && row.outcome === "accepted" && row.lrn,
    );
    if (accepted?.lrn) return accepted.lrn;

    const anyCreate = attempts.find((row) => row.operation === "submit" && row.lrn);
    return anyCreate?.lrn ?? null;
  },
});

/**
 * Stamp the transport on first use and reject any later attempt to change it.
 *
 * Mirrors assertAndStampEnvironment. A declaration created through CNS must be
 * amended and cancelled through CNS: the inventory record, the badge and the
 * CSP correlation all belong to that route. Re-routing mid-life would orphan
 * the inventory link.
 */
export const assertAndStampTransport = mutation({
  args: {
    declarationId: v.id("declarations"),
    transport: submissionTransport,
    environment: v.optional(cnsEnvironment),
    badgeId: v.optional(v.string()),
    topic: v.optional(v.string()),
    goodsLocationCode: v.optional(v.string()),
    inventoryReferenceType: v.optional(v.string()),
  },
  returns: v.object({ transport: submissionTransport }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }

    // Legacy rows carry no transport and are direct-HMRC by definition.
    const stamped = decl.submissionTransport ?? "hmrc_direct";
    if (decl.submissionTransport && stamped !== args.transport) {
      throw new Error(
        `TRANSPORT_MISMATCH: declaration was submitted via ${stamped} and cannot be sent via ${args.transport}. Amendments and cancellations must use the original route.`,
      );
    }

    if (decl.submissionTransport === args.transport) {
      return { transport: args.transport };
    }

    await ctx.db.patch(args.declarationId, {
      submissionTransport: args.transport,
      ...(args.transport === "cns_inventory"
        ? {
            cnsEnvironment: args.environment,
            cnsBadgeId: args.badgeId,
            cnsTopic: args.topic,
            cnsGoodsLocationCode: args.goodsLocationCode,
            cnsInventoryReferenceType: args.inventoryReferenceType,
          }
        : {}),
    });

    return { transport: args.transport };
  },
});

/** Persist the operator-selected UCN. Normalisation happens before this call. */
export const setInventoryReference = mutation({
  args: {
    declarationId: v.id("declarations"),
    cnsUcn: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }

    // The inventory reference is baked into submitted XML; changing it after
    // the fact would desynchronise the declaration from the CSP's record.
    if (decl.submissionTransport === "cns_inventory" && decl.cnsUcn && decl.cnsUcn !== args.cnsUcn) {
      throw new Error(
        "UCN_LOCKED: this declaration has already been submitted against a different inventory record. Cancel and re-create rather than re-pointing it.",
      );
    }

    await ctx.db.patch(args.declarationId, { cnsUcn: args.cnsUcn });
    return null;
  },
});

/**
 * Record the outcome of a CNS transport attempt.
 *
 * Called after the HTTP exchange completes, whatever the result. HTTP 202 sets
 * pending — never accepted, never an MRN. Anything downstream arrives on the
 * notification topic.
 */
export const recordTransportOutcome = mutation({
  args: {
    declarationId: v.id("declarations"),
    transportState: v.string(),
    cspId: v.optional(v.string()),
    inventoryState: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const decl = await ctx.db.get(args.declarationId);
    if (!decl || !(await canAccessDeclaration(ctx, identity.subject, decl))) {
      throw forbiddenError();
    }

    await ctx.db.patch(args.declarationId, {
      cnsTransportState: args.transportState,
      ...(args.cspId ? { cnsCspId: args.cspId } : {}),
      ...(args.inventoryState ? { cnsInventoryState: args.inventoryState } : {}),
      lastUpdated: Date.now(),
    });
    return null;
  },
});
