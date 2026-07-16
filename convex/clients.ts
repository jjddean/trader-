import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  canAccessDeclaration,
  getActiveOrgId,
  isPersonalScopedRecord,
  resolveOrgIdForNewRecord,
} from "./lib/org_access";

type Ctx = QueryCtx | MutationCtx;

function normalizeString(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function normalizeUpper(value: string | null | undefined) {
  return normalizeString(value)?.toUpperCase();
}

async function canAccessClient(ctx: Ctx, userId: string, client: Doc<"clients"> | null) {
  if (!client) return false;
  if (String(client.userId ?? "") === userId) return true;
  const activeOrgId = await getActiveOrgId(ctx, userId);
  const clientOrgId = normalizeString(client.orgId);
  return Boolean(activeOrgId && clientOrgId && activeOrgId === clientOrgId);
}

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const activeOrgId = await getActiveOrgId(ctx, identity.subject);
    let rows: Doc<"clients">[];
    if (activeOrgId) {
      rows = await ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
        .order("desc")
        .take(500);
    } else {
      rows = (
        await ctx.db
          .query("clients")
          .withIndex("by_user", (q) => q.eq("userId", identity.subject))
          .order("desc")
          .take(500)
      ).filter((row) => isPersonalScopedRecord(row.orgId));
    }

    return args.includeArchived ? rows : rows.filter((row) => row.status !== "archived");
  },
});

export const get = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return null;
    return client;
  },
});

const clientFieldArgs = {
  name: v.string(),
  eori: v.optional(v.union(v.string(), v.null())),
  addressLine: v.optional(v.union(v.string(), v.null())),
  city: v.optional(v.union(v.string(), v.null())),
  postcode: v.optional(v.union(v.string(), v.null())),
  country: v.optional(v.union(v.string(), v.null())),
  contactName: v.optional(v.union(v.string(), v.null())),
  contactEmail: v.optional(v.union(v.string(), v.null())),
  contactPhone: v.optional(v.union(v.string(), v.null())),
  notes: v.optional(v.union(v.string(), v.null())),
};

function buildClientFields(args: {
  name: string;
  eori?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}) {
  return {
    name: args.name.trim(),
    eori: normalizeUpper(args.eori),
    addressLine: normalizeString(args.addressLine),
    city: normalizeString(args.city),
    postcode: normalizeString(args.postcode),
    country: normalizeUpper(args.country),
    contactName: normalizeString(args.contactName),
    contactEmail: normalizeString(args.contactEmail),
    contactPhone: normalizeString(args.contactPhone),
    notes: normalizeString(args.notes),
  };
}

export const create = mutation({
  args: clientFieldArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const name = args.name.trim();
    if (name.length < 2) throw new Error("Client name is required.");

    const now = Date.now();
    const orgId = await resolveOrgIdForNewRecord(ctx, identity.subject);
    const clientId = await ctx.db.insert("clients", {
      userId: identity.subject,
      orgId,
      ...buildClientFields(args),
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "client_created",
      details: { clientId, name, hasEori: Boolean(normalizeUpper(args.eori)) },
      timestamp: now,
      archived: false,
    });

    return { clientId };
  },
});

export const update = mutation({
  args: { clientId: v.id("clients"), ...clientFieldArgs },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) throw new Error("Unauthorized");

    const name = args.name.trim();
    if (name.length < 2) throw new Error("Client name is required.");

    const now = Date.now();
    await ctx.db.patch(args.clientId, { ...buildClientFields(args), updatedAt: now });
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "client_updated",
      details: { clientId: args.clientId, name },
      timestamp: now,
      archived: false,
    });

    return { ok: true, updatedAt: now };
  },
});

/**
 * Link (or unlink) the client a declaration is filed on behalf of. Sets
 * `declarations.clientId`. This is the association only — it does NOT change the
 * importer mapping / DE 3/15-3/16 output.
 */
export const setClient = mutation({
  args: {
    declarationId: v.id("declarations"),
    // Accept a client id, null, or "" (empty selection) — normalized below so a
    // blank value from the picker unlinks instead of failing arg validation.
    clientId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw new Error("Unauthorized");
    }

    const rawClientId = String(args.clientId ?? "").trim();
    let clientId: Id<"clients"> | undefined;
    if (rawClientId) {
      const candidate = ctx.db.normalizeId("clients", rawClientId);
      if (!candidate) throw new Error("Client not found");
      const client = await ctx.db.get(candidate);
      if (!(await canAccessClient(ctx, identity.subject, client))) {
        throw new Error("Client not found");
      }
      clientId = candidate;
    }

    const now = Date.now();
    await ctx.db.patch(args.declarationId, {
      clientId,
      lastUpdated: now,
    });
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: clientId ? "declaration_client_linked" : "declaration_client_unlinked",
      details: { declarationId: args.declarationId, clientId: clientId ?? null },
      timestamp: now,
      archived: false,
    });

    return { ok: true };
  },
});

export const setStatus = mutation({
  args: { clientId: v.id("clients"), status: v.union(v.literal("active"), v.literal("archived")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) throw new Error("Unauthorized");

    const now = Date.now();
    await ctx.db.patch(args.clientId, { status: args.status, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: args.status === "archived" ? "client_archived" : "client_restored",
      details: { clientId: args.clientId },
      timestamp: now,
      archived: false,
    });

    return { ok: true };
  },
});
