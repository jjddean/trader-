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

function normalizePortalEmail(value: string | null | undefined) {
  const trimmed = String(value ?? "")
    .trim()
    .toLowerCase();
  return trimmed || undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Enable (or update) client portal login for this client. Stores lowercased
 * portalEmail; portalClerkId is bound later when the client signs in.
 * Rejects if another clients row already uses the same portalEmail.
 */
export const setPortalAccess = mutation({
  args: {
    clientId: v.id("clients"),
    portalEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw new Error("Unauthorized");
    }
    if (client.status === "archived") {
      throw new Error("Restore the client before enabling portal access.");
    }

    const portalEmail = normalizePortalEmail(args.portalEmail);
    if (!portalEmail || !EMAIL_RE.test(portalEmail)) {
      throw new Error("A valid portal email is required.");
    }

    const brokerEmail = normalizePortalEmail(
      typeof identity.email === "string" ? identity.email : undefined,
    );
    if (brokerEmail && brokerEmail === portalEmail) {
      throw new Error(
        "Use the client's email, not your broker login email — that would trap your account on the portal.",
      );
    }

    const brokerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (normalizePortalEmail(typeof brokerUser?.email === "string" ? brokerUser.email : undefined) === portalEmail) {
      throw new Error(
        "Use the client's email, not your broker login email — that would trap your account on the portal.",
      );
    }

    // Block emails already registered as FreightCode users (brokers/admins).
    // users.email is not indexed/normalized — scan a bounded window case-insensitively.
    const knownUsers = await ctx.db.query("users").take(2000);
    const emailOwnedByAppUser = knownUsers.some(
      (row) => normalizePortalEmail(typeof row.email === "string" ? row.email : undefined) === portalEmail,
    );
    if (emailOwnedByAppUser) {
      throw new Error(
        "That email belongs to a FreightCode user account. Choose a different client portal email.",
      );
    }

    const existing = await ctx.db
      .query("clients")
      .withIndex("by_portal_email", (q) => q.eq("portalEmail", portalEmail))
      .first();
    if (existing && existing._id !== args.clientId) {
      throw new Error("That email is already used for another client's portal access.");
    }

    const now = Date.now();
    const emailChanged = client.portalEmail !== portalEmail;
    await ctx.db.patch(args.clientId, {
      portalEmail,
      // Re-bind on next sign-in if the invite email changed.
      ...(emailChanged ? { portalClerkId: undefined } : {}),
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "client_portal_access_enabled",
      details: {
        clientId: args.clientId,
        portalEmail,
        emailChanged,
      },
      timestamp: now,
      archived: false,
    });

    return { ok: true as const, portalEmail };
  },
});

/** Audit-only: record that a portal invite email was attempted (API route sends via Resend). */
export const recordPortalInviteSent = mutation({
  args: {
    clientId: v.id("clients"),
    portalEmail: v.string(),
    emailSent: v.boolean(),
    emailNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw new Error("Unauthorized");
    }

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "client_portal_invite_sent",
      details: {
        clientId: args.clientId,
        portalEmail: normalizePortalEmail(args.portalEmail),
        emailSent: args.emailSent,
        emailNote: args.emailNote ?? null,
      },
      timestamp: Date.now(),
      archived: false,
    });

    return { ok: true as const };
  },
});

/** Remove portal login mapping so the client can no longer resolve via email/clerk. */
export const revokePortalAccess = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw new Error("Unauthorized");
    }

    const previousEmail = client.portalEmail ?? null;
    const now = Date.now();
    await ctx.db.patch(args.clientId, {
      portalEmail: undefined,
      portalClerkId: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "client_portal_access_revoked",
      details: {
        clientId: args.clientId,
        previousEmail,
      },
      timestamp: now,
      archived: false,
    });

    return { ok: true as const };
  },
});

/** How many declarations are linked to this client (portal list source). */
export const countLinkedDeclarations = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return 0;

    const rows = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .take(500);
    return rows.filter((row) => row.clientId === args.clientId).length;
  },
});

/** Declarations linked to this client — for filing-scoped portal messaging. */
export const listLinkedDeclarations = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return [];

    const rows = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(100);

    return rows
      .filter((row) => row.clientId === args.clientId)
      .map((row) => ({
        _id: row._id,
        mrn: row.mrn != null ? String(row.mrn) : null,
        declarationType: row.declarationType != null ? String(row.declarationType) : null,
        lastUpdated: row.lastUpdated ?? row._creationTime,
      }));
  },
});

/** Export assessments linked to this client — for case-scoped portal messaging. */
export const listLinkedAssessments = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return [];

    const rows = await ctx.db
      .query("export_assessments")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(100);

    return rows
      .filter((row) => row.clientId === args.clientId)
      .map((row) => ({
        _id: row._id,
        reference: row.reference,
        status: row.status,
        updatedAt: row.updatedAt,
      }));
  },
});

export const listPortalMessages = query({
  args: {
    clientId: v.id("clients"),
    declarationId: v.optional(v.id("declarations")),
    assessmentId: v.optional(v.id("export_assessments")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return [];

    if (args.declarationId && args.assessmentId) return [];

    const rows = await ctx.db
      .query("portal_messages")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(Math.min(args.limit ?? 100, 200));

    return rows
      .filter((row) => {
        if (row.clientId !== args.clientId) return false;
        if (args.declarationId) return row.declarationId === args.declarationId;
        if (args.assessmentId) return row.assessmentId === args.assessmentId;
        return !row.declarationId && !row.assessmentId;
      })
      .map((row) => ({
        _id: row._id,
        declarationId: row.declarationId ?? null,
        assessmentId: row.assessmentId ?? null,
        senderRole: row.senderRole,
        body: row.body,
        createdAt: row.createdAt,
        readAt: row.readAt ?? null,
      }));
  },
});

export const sendBrokerMessage = mutation({
  args: {
    clientId: v.id("clients"),
    body: v.string(),
    declarationId: v.optional(v.id("declarations")),
    assessmentId: v.optional(v.id("export_assessments")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw new Error("Unauthorized");
    }

    const body = args.body.trim();
    if (body.length < 1) throw new Error("Message is empty");
    if (body.length > 4000) throw new Error("Message is too long");

    const hasDeclaration = Boolean(args.declarationId);
    const hasAssessment = Boolean(args.assessmentId);
    if (hasDeclaration && hasAssessment) {
      throw new Error("Choose either a declaration or an export case");
    }

    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw new Error("Declaration not found");
      }
      if (declaration.clientId !== args.clientId) {
        throw new Error("Declaration is not linked to this client");
      }
    }

    if (args.assessmentId) {
      const assessment = await ctx.db.get(args.assessmentId);
      if (!assessment) throw new Error("Export case not found");
      if (assessment.clientId !== args.clientId) {
        throw new Error("Export case is not linked to this client");
      }
      if (assessment.orgId && client.orgId && assessment.orgId !== client.orgId) {
        throw new Error("Export case is not linked to this client");
      }
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("portal_messages", {
      declarationId: args.declarationId,
      assessmentId: args.assessmentId,
      clientId: args.clientId,
      orgId: client.orgId,
      senderRole: "broker",
      senderId: identity.subject,
      body,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "client_portal_message_sent",
      details: {
        clientId: args.clientId,
        declarationId: args.declarationId ?? null,
        assessmentId: args.assessmentId ?? null,
        messageId,
      },
      timestamp: now,
      archived: false,
    });

    return { messageId };
  },
});
