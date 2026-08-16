import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  canAccessDeclaration,
  getActiveOrgId,
  isPersonalScopedRecord,
  listDeclarationsForTenant,
  resolveOrgIdForNewRecord,
} from "./lib/org_access";
import {
  clientDeclarationAttachmentConflict,
  clientDocumentAttachmentConflict,
} from "./lib/portal_document_policy";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

type Ctx = QueryCtx | MutationCtx;

function normalizeString(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function normalizeUpper(value: string | null | undefined) {
  return normalizeString(value)?.toUpperCase();
}

function documentCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z]\d{3}|\d{4})(?:[^A-Z0-9]|$)/)?.[1] ?? null;
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
    if (!identity) throw unauthenticatedError();

    const name = args.name.trim();
    if (name.length < 2) throw userError("client_name_is_required", "Client name is required.");

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
    if (!identity) throw unauthenticatedError();

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) throw forbiddenError();

    const name = args.name.trim();
    if (name.length < 2) throw userError("client_name_is_required", "Client name is required.");

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
    if (!identity) throw unauthenticatedError();

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    const rawClientId = String(args.clientId ?? "").trim();
    let clientId: Id<"clients"> | undefined;
    if (rawClientId) {
      const candidate = ctx.db.normalizeId("clients", rawClientId);
      if (!candidate) throw userError("client_not_found", "Client not found");
      const client = await ctx.db.get(candidate);
      if (!(await canAccessClient(ctx, identity.subject, client))) {
        throw userError("client_not_found", "Client not found");
      }
      if (
        clientDeclarationAttachmentConflict({
          clientId: client?._id,
          clientOrgId: client?.orgId,
          declarationClientId: undefined,
          declarationOrgId: declaration.orgId,
        }) !== null
      ) {
        throw userError("the_client_and_filing_must_belong", "The client and filing must belong to the same organisation");
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
    if (!identity) throw unauthenticatedError();

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) throw forbiddenError();

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
    if (!identity) throw unauthenticatedError();

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw forbiddenError();
    }
    if (client.status === "archived") {
      throw userError("restore_the_client_before_enabling_portal", "Restore the client before enabling portal access.");
    }

    const portalEmail = normalizePortalEmail(args.portalEmail);
    if (!portalEmail || !EMAIL_RE.test(portalEmail)) {
      throw userError("a_valid_portal_email_is_required", "A valid portal email is required.");
    }

    const brokerEmail = normalizePortalEmail(
      typeof identity.email === "string" ? identity.email : undefined,
    );
    if (brokerEmail && brokerEmail === portalEmail) {
      throw userError(
        "portal_email_is_broker_login",
        "Use the client's email, not your broker login email — that would trap your account on the portal.",
      );
    }

    const brokerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (normalizePortalEmail(typeof brokerUser?.email === "string" ? brokerUser.email : undefined) === portalEmail) {
      throw userError(
        "portal_email_is_broker_login",
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
      throw userError(
        "portal_email_is_app_user",
        "That email belongs to a FreightCode user account. Choose a different client portal email.",
      );
    }

    const existing = await ctx.db
      .query("clients")
      .withIndex("by_portal_email", (q) => q.eq("portalEmail", portalEmail))
      .first();
    if (existing && existing._id !== args.clientId) {
      throw userError("portal_email_taken", "That email is already used for another client's portal access.");
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
    if (!identity) throw unauthenticatedError();

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw forbiddenError();
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
    if (!identity) throw unauthenticatedError();

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw forbiddenError();
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

/** Portal uploads awaiting a filing assignment for one broker client. */
export const listUnlinkedDocuments = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return [];

    const rows = await ctx.db
      .query("documents")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(200);

    return rows
      .filter((row) => row.clientId === args.clientId && !row.declarationId)
      .map((row) => ({
        _id: row._id,
        fileName: row.fileName != null ? String(row.fileName) : "Document",
        fileType: row.fileType != null ? String(row.fileType) : null,
        uploadDate: row.uploadDate != null ? String(row.uploadDate) : null,
        hasFile: Boolean(row.fileId),
      }));
  },
});

/** Drafts that can receive a waiting portal document for this client. */
export const listAttachableDeclarations = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) return [];

    const rows = await listDeclarationsForTenant(ctx, identity.subject, 200);
    return rows
      .filter(
        (row) =>
          clientDeclarationAttachmentConflict({
            clientId: client?._id,
            clientOrgId: client?.orgId,
            declarationClientId: row.clientId,
            declarationOrgId: row.orgId,
          }) === null,
      )
      .map((row) => ({
        _id: row._id,
        mrn: row.mrn != null ? String(row.mrn) : null,
        declarationType: row.declarationType != null ? String(row.declarationType) : null,
        lastUpdated: row.lastUpdated ?? row._creationTime,
      }));
  },
});

/** Assign an unlinked portal upload to this client's filing. */
export const attachUnlinkedDocument = mutation({
  args: {
    clientId: v.id("clients"),
    documentId: v.id("documents"),
    declarationId: v.id("declarations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const [client, document, declaration] = await Promise.all([
      ctx.db.get(args.clientId),
      ctx.db.get(args.documentId),
      ctx.db.get(args.declarationId),
    ]);
    if (!(await canAccessClient(ctx, identity.subject, client))) {
      throw forbiddenError();
    }
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw userError("declaration_not_found", "Declaration not found");
    }
    if (!document) {
      throw userError("document_not_found", "Document not found");
    }
    const attachmentConflict = clientDocumentAttachmentConflict({
      clientId: client?._id,
      clientOrgId: client?.orgId,
      documentClientId: document.clientId,
      documentOrgId: document.orgId,
      declarationClientId: declaration.clientId,
      declarationOrgId: declaration.orgId,
    });
    if (attachmentConflict === "document_client_mismatch") {
      throw userError("document_not_found", "Document not found");
    }
    if (attachmentConflict === "declaration_client_mismatch") {
      throw userError("the_filing_does_not_belong_to", "The filing does not belong to this client");
    }
    if (
      attachmentConflict === "tenant_mismatch" ||
      attachmentConflict === "document_tenant_mismatch"
    ) {
      throw userError("the_document_client_and_filing_must", "The document, client, and filing must belong to the same organisation");
    }
    if (document.declarationId) {
      throw userError("document_is_already_attached_to_a", "Document is already attached to a filing");
    }

    const now = Date.now();
    if (!declaration.clientId) {
      await ctx.db.patch(args.declarationId, {
        clientId: args.clientId,
        lastUpdated: now,
      });
    }
    await ctx.db.patch(args.documentId, {
      declarationId: args.declarationId,
      mrn: declaration.mrn != null ? String(declaration.mrn) : undefined,
      status: "pending_review",
      linkedBy: identity.subject,
      linkedAt: now,
    });
    const code = documentCode(document.fileName) ?? documentCode(document.fileType);
    if (code) {
      const requirement = await ctx.db
        .query("document_requirements")
        .withIndex("by_declaration_code", (q) =>
          q.eq("declarationId", args.declarationId).eq("code", code),
        )
        .first();
      if (requirement) {
        await ctx.db.patch(requirement._id, {
          status: "uploaded",
          linkedDocumentId: args.documentId,
          updatedAt: now,
        });
      }
    }
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "portal_document_attached",
      details: {
        clientId: args.clientId,
        documentId: args.documentId,
        declarationId: args.declarationId,
      },
      timestamp: now,
      archived: false,
    });

    return { ok: true as const };
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

    const limit = Math.min(args.limit ?? 100, 200);
    const rows = args.declarationId
      ? await ctx.db
          .query("portal_messages")
          .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
          .order("desc")
          .take(limit)
      : args.assessmentId
        ? await ctx.db
            .query("portal_messages")
            .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("portal_messages")
            .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
            .filter((q) =>
              q.and(
                q.eq(q.field("declarationId"), undefined),
                q.eq(q.field("assessmentId"), undefined),
              ),
            )
            .order("desc")
            .take(limit);

    return rows
      .filter((row) => row.clientId === args.clientId)
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

/** Mark client replies in the open broker thread as read. */
export const markPortalMessagesRead = mutation({
  args: {
    clientId: v.id("clients"),
    declarationId: v.optional(v.id("declarations")),
    assessmentId: v.optional(v.id("export_assessments")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client))) throw forbiddenError();
    if (args.declarationId && args.assessmentId) throw userError("choose_one_thread", "Choose one thread");

    const rows = args.declarationId
      ? await ctx.db
          .query("portal_messages")
          .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
          .filter((q) => q.and(q.eq(q.field("senderRole"), "client"), q.eq(q.field("readAt"), undefined)))
          .collect()
      : args.assessmentId
        ? await ctx.db
            .query("portal_messages")
            .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
            .filter((q) => q.and(q.eq(q.field("senderRole"), "client"), q.eq(q.field("readAt"), undefined)))
            .collect()
        : await ctx.db
            .query("portal_messages")
            .withIndex("by_client_sender_read", (q) =>
              q.eq("clientId", args.clientId).eq("senderRole", "client").eq("readAt", undefined),
            )
            .filter((q) =>
              q.and(q.eq(q.field("declarationId"), undefined), q.eq(q.field("assessmentId"), undefined)),
            )
            .collect();
    const now = Date.now();
    const unread = rows.filter((row) => row.clientId === args.clientId);
    await Promise.all(unread.map((row) => ctx.db.patch(row._id, { readAt: now })));
    return { marked: unread.length };
  },
});

export const savePortalMessageDocument = mutation({
  args: {
    messageId: v.id("portal_messages"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    const message = await ctx.db.get(args.messageId);
    if (!message) throw userError("message_not_found", "Message not found");
    const client = await ctx.db.get(message.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw forbiddenError();
    }
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_source_message", (q) => q.eq("sourceMessageId", args.messageId))
      .first();
    if (existing) return { documentId: existing._id, alreadySaved: true as const };
    const now = Date.now();
    const declaration = message.declarationId ? await ctx.db.get(message.declarationId) : null;
    const documentId = await ctx.db.insert("documents", {
      fileId: args.storageId,
      fileName: args.fileName.trim() || "portal-message.pdf",
      fileType: "correspondence",
      status: message.declarationId ? "pending_review" : "unlinked",
      auditStatus: "pending",
      uploadDate: new Date(now).toISOString(),
      userId: identity.subject,
      orgId: message.orgId ?? client.orgId,
      clientId: message.clientId,
      declarationId: message.declarationId,
      mrn: declaration?.mrn != null ? String(declaration.mrn) : undefined,
      sourceMessageId: args.messageId,
    });
    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "portal_message_saved_to_documents",
      details: { messageId: args.messageId, documentId, clientId: message.clientId },
      timestamp: now,
      archived: false,
    });
    return { documentId, alreadySaved: false as const };
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
    if (!identity) throw unauthenticatedError();

    const client = await ctx.db.get(args.clientId);
    if (!(await canAccessClient(ctx, identity.subject, client)) || !client) {
      throw forbiddenError();
    }

    const body = args.body.trim();
    if (body.length < 1) throw userError("message_is_empty", "Message is empty");
    if (body.length > 4000) throw userError("message_is_too_long", "Message is too long");

    const hasDeclaration = Boolean(args.declarationId);
    const hasAssessment = Boolean(args.assessmentId);
    if (hasDeclaration && hasAssessment) {
      throw userError("choose_either_a_declaration_or_an", "Choose either a declaration or an export case");
    }

    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw userError("declaration_not_found", "Declaration not found");
      }
      if (declaration.clientId !== args.clientId) {
        throw userError("declaration_is_not_linked_to_this", "Declaration is not linked to this client");
      }
    }

    if (args.assessmentId) {
      const assessment = await ctx.db.get(args.assessmentId);
      if (!assessment) throw userError("export_case_not_found", "Export case not found");
      if (assessment.clientId !== args.clientId) {
        throw userError("export_case_is_not_linked_to", "Export case is not linked to this client");
      }
      if (assessment.orgId && client.orgId && assessment.orgId !== client.orgId) {
        throw userError("export_case_is_not_linked_to", "Export case is not linked to this client");
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
