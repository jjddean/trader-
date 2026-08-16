import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  canAccessDeclaration,
  canAccessDocument,
  getActiveOrgId,
  resolveOrgIdForNewRecord,
  listDocumentsForTenant,
  listDeclarationsForTenant,
  orgIdFromDeclaration,
} from "./lib/org_access";
import { clientDocumentAttachmentConflict } from "./lib/portal_document_policy";
import { forbiddenError, unauthenticatedError, userError } from "./lib/user_errors";

const DOC_CODE_REGEX = /(?:^|[^A-Z0-9])([A-Z]\d{3}|\d{4})(?:[^A-Z0-9]|$)/;

function extractDocumentCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.toUpperCase().match(DOC_CODE_REGEX);
  return match ? match[1] : null;
}

async function logDocActionError(
  ctx: any,
  payload: {
    userId?: string;
    action: string;
    code: string;
    message: string;
    documentId?: string;
    declarationId?: string;
    status?: number;
  },
) {
  try {
    await ctx.db.insert("auditLogs", {
      userId: payload.userId || "anonymous",
      action: "doc_action_error",
      details: payload,
      timestamp: Date.now(),
      archived: false,
    });
  } catch {
    // Never block primary action on telemetry write failure.
  }
}

async function updateRequirementStatusForDeclaration(
  ctx: any,
  declarationId: any,
  code: string,
  nextStatus: "missing" | "uploaded" | "waived",
  linkedDocumentId?: any,
) {
  const requirement = await ctx.db
    .query("document_requirements")
    .withIndex("by_declaration_code", (q: any) =>
      q.eq("declarationId", declarationId).eq("code", code),
    )
    .first();

  if (!requirement) return;

  await ctx.db.patch(requirement._id, {
    status: nextStatus,
    linkedDocumentId,
    updatedAt: Date.now(),
  });
}

export const trackUpload = mutation({
  args: {
    declarationId: v.id("declarations"),
    fileName: v.string(),
    fileSize: v.number(),
    documentType: v.string(),
    uploadStatus: v.string(),
    hmrcUploadReference: v.optional(v.string()),
    hmrcConversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    
    // Verify ownership of parent declaration
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    return await ctx.db.insert("documents", {
      declarationId: args.declarationId,
      userId: identity.subject,
      orgId: orgIdFromDeclaration(declaration),
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.documentType,
      status: args.uploadStatus,
      uploadDate: new Date().toISOString(),
      mrn: declaration.mrn,
      hmrcUploadReference: args.hmrcUploadReference,
      hmrcConversationId: args.hmrcConversationId,
    });
  }
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Delete a just-uploaded file that no row ended up claiming.
 *
 * Uploads are two steps — POST to storage, then insert the row. If the insert
 * fails the bytes stay in storage forever with nothing referencing them: no
 * owner, no tenancy check, and they still count against storage. Callers invoke
 * this from their failure path.
 *
 * Refuses when a documents row claims the file, so a save that actually landed
 * can never be deleted by a late or duplicated discard.
 */
export const discardOrphanedUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const claimed = await ctx.db
      .query("documents")
      .withIndex("by_file", (q) => q.eq("fileId", args.storageId))
      .first();
    if (claimed) return { deleted: false };

    await ctx.storage.delete(args.storageId);
    return { deleted: true };
  },
});

export const saveDocument = mutation({
  args: {
    storageId: v.id("_storage"),
    userId: v.string(),
    fileName: v.string(),
    mrn: v.optional(v.string()),
    declarationId: v.optional(v.id("declarations")),
    auditStatus: v.optional(v.string()),
    fileType: v.optional(v.string()),
    ocrText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      await logDocActionError(ctx, {
        action: "saveDocument",
        code: "UNAUTHENTICATED",
        message: "Unauthenticated session attempted to save document.",
        declarationId: args.declarationId ? String(args.declarationId) : undefined,
        status: 401,
      });
      throw unauthenticatedError();
    }

    const declaration = args.declarationId ? await ctx.db.get(args.declarationId) : null;
    if (args.declarationId) {
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw forbiddenError();
      }
    }

    const orgFromDeclaration = orgIdFromDeclaration(declaration);
    const orgId =
      orgFromDeclaration ?? (await resolveOrgIdForNewRecord(ctx, identity.subject));

    const documentId = await ctx.db.insert("documents", {
      fileId: args.storageId,
      userId: identity.subject, // Enforce session ID
      ...(orgId ? { orgId } : {}),
      fileName: args.fileName,
      mrn: args.mrn,
      declarationId: args.declarationId,
      status: "pending_hmrc",
      auditStatus: args.auditStatus || "pending",
      fileType: args.fileType,
      ocrText: args.ocrText,
      uploadDate: new Date().toISOString()
    });

    const code = extractDocumentCode(args.fileName) || extractDocumentCode(args.fileType);
    if (args.declarationId && code) {
      await updateRequirementStatusForDeclaration(
        ctx,
        args.declarationId,
        code,
        "uploaded",
        documentId,
      );
    }

    return documentId;
  }
});

export const recordDocumentAudit = mutation({
  args: {
    documentId: v.id("documents"),
    auditStatus: v.string(),
    auditResult: v.optional(v.any()),
    ocrText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const document = await ctx.db.get(args.documentId);
    if (!document || !(await canAccessDocument(ctx, identity.subject, document))) {
      throw forbiddenError();
    }

    await ctx.db.patch(args.documentId, {
      auditStatus: args.auditStatus,
      auditResult: args.auditResult,
      ocrText: args.ocrText ?? document.ocrText,
    });

    return args.documentId;
  },
});

export const getDocuments = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await listDocumentsForTenant(ctx, identity.subject, 200);
  }
});

export const getDocumentDownloadUrl = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      await logDocActionError(ctx, {
        action: "getDocumentDownloadUrl",
        code: "UNAUTHENTICATED",
        message: "Unauthenticated session attempted to download document.",
        documentId: String(args.documentId),
        status: 401,
      });
      throw unauthenticatedError();
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || !(await canAccessDocument(ctx, identity.subject, document))) {
      await logDocActionError(ctx, {
        userId: identity.subject,
        action: "getDocumentDownloadUrl",
        code: "UNAUTHORIZED",
        message: "Unauthorized document download request.",
        documentId: String(args.documentId),
        status: 403,
      });
      throw forbiddenError();
    }
    if (!document.fileId) {
      await logDocActionError(ctx, {
        userId: identity.subject,
        action: "getDocumentDownloadUrl",
        code: "NO_FILE",
        message: "Download requested for document with no file attachment.",
        documentId: String(args.documentId),
        declarationId: document.declarationId ? String(document.declarationId) : undefined,
        status: 400,
      });
      throw userError("no_file_is_attached_to_this", "No file is attached to this document");
    }

    return await ctx.storage.getUrl(document.fileId);
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      await logDocActionError(ctx, {
        action: "deleteDocument",
        code: "UNAUTHENTICATED",
        message: "Unauthenticated session attempted to delete document.",
        documentId: String(args.documentId),
        status: 401,
      });
      throw unauthenticatedError();
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || !(await canAccessDocument(ctx, identity.subject, document))) {
      await logDocActionError(ctx, {
        userId: identity.subject,
        action: "deleteDocument",
        code: "UNAUTHORIZED",
        message: "Unauthorized document delete request.",
        documentId: String(args.documentId),
        status: 403,
      });
      throw forbiddenError();
    }

    if (document.fileId) {
      await ctx.storage.delete(document.fileId);
    }
    await ctx.db.delete(args.documentId);

    if (document.declarationId) {
      const code = extractDocumentCode(document.fileName) || extractDocumentCode(document.fileType);
      if (code) {
        const remainingDocs = await ctx.db
          .query("documents")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", document.declarationId))
          .take(50);
        const hasSameCode = remainingDocs.some(
          (doc: any) =>
            (extractDocumentCode(doc.fileName) || extractDocumentCode(doc.fileType)) === code,
        );
        if (!hasSameCode) {
          await updateRequirementStatusForDeclaration(ctx, document.declarationId, code, "missing");
        }
      }
    }
    return { success: true };
  },
});

export const replaceDocument = mutation({
  args: {
    documentId: v.id("documents"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mrn: v.optional(v.string()),
    declarationId: v.optional(v.id("declarations")),
    auditStatus: v.optional(v.string()),
    fileType: v.optional(v.string()),
    ocrText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      await logDocActionError(ctx, {
        action: "replaceDocument",
        code: "UNAUTHENTICATED",
        message: "Unauthenticated session attempted to replace document.",
        documentId: String(args.documentId),
        declarationId: args.declarationId ? String(args.declarationId) : undefined,
        status: 401,
      });
      throw unauthenticatedError();
    }

    const existing = await ctx.db.get(args.documentId);
    if (!existing || !(await canAccessDocument(ctx, identity.subject, existing))) {
      await logDocActionError(ctx, {
        userId: identity.subject,
        action: "replaceDocument",
        code: "UNAUTHORIZED",
        message: "Unauthorized document replace request.",
        documentId: String(args.documentId),
        declarationId: args.declarationId ? String(args.declarationId) : undefined,
        status: 403,
      });
      throw forbiddenError();
    }

    if (existing.fileId) {
      await ctx.storage.delete(existing.fileId);
    }

    await ctx.db.patch(args.documentId, {
      fileId: args.storageId,
      fileName: args.fileName,
      mrn: args.mrn,
      declarationId: args.declarationId,
      auditStatus: args.auditStatus || "pending",
      fileType: args.fileType,
      ocrText: args.ocrText,
      uploadDate: new Date().toISOString(),
      status: "pending_hmrc",
    });

    const code = extractDocumentCode(args.fileName) || extractDocumentCode(args.fileType);
    if (args.declarationId && code) {
      await updateRequirementStatusForDeclaration(
        ctx,
        args.declarationId,
        code,
        "uploaded",
        args.documentId,
      );
    }

    return { success: true, documentId: args.documentId };
  },
});

/**
 * Attach an already-uploaded document to a declaration.
 *
 * Linking normally happens at upload time (portal `saveMyDocument`, broker
 * `saveDocument`). This covers the case it cannot reach: a client sends a file
 * through the portal before the filing exists, so the row arrives with a
 * clientId and no declaration. The stored file is untouched — only the link,
 * the mirrored MRN and the affected requirement rows move.
 */
export const linkDocumentToDeclaration = mutation({
  args: {
    documentId: v.id("documents"),
    declarationId: v.id("declarations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      await logDocActionError(ctx, {
        action: "linkDocumentToDeclaration",
        code: "UNAUTHENTICATED",
        message: "Unauthenticated session attempted to link document.",
        documentId: String(args.documentId),
        declarationId: String(args.declarationId),
        status: 401,
      });
      throw unauthenticatedError();
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || !(await canAccessDocument(ctx, identity.subject, document))) {
      await logDocActionError(ctx, {
        userId: identity.subject,
        action: "linkDocumentToDeclaration",
        code: "UNAUTHORIZED",
        message: "Unauthorized document link request.",
        documentId: String(args.documentId),
        declarationId: String(args.declarationId),
        status: 403,
      });
      throw forbiddenError();
    }

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      await logDocActionError(ctx, {
        userId: identity.subject,
        action: "linkDocumentToDeclaration",
        code: "UNAUTHORIZED_DECLARATION",
        message: "Unauthorized declaration target for document link.",
        documentId: String(args.documentId),
        declarationId: String(args.declarationId),
        status: 403,
      });
      throw forbiddenError();
    }

    const isClientUpload = Boolean(document.clientId);
    if (document.clientId) {
      const client = await ctx.db.get(document.clientId);
      if (!client) throw userError("document_client_not_found", "Document client not found");

      const attachmentConflict = clientDocumentAttachmentConflict({
        clientId: client._id,
        clientOrgId: client.orgId,
        documentClientId: document.clientId,
        documentOrgId: document.orgId,
        declarationClientId: declaration.clientId,
        declarationOrgId: declaration.orgId,
      });
      if (attachmentConflict === "declaration_client_mismatch") {
        throw userError("the_filing_belongs_to_a_different", "The filing belongs to a different client");
      }
      if (
        attachmentConflict === "tenant_mismatch" ||
        attachmentConflict === "document_tenant_mismatch"
      ) {
        throw userError("the_document_client_and_filing_must", "The document client and filing must belong to the same organisation");
      }
      if (attachmentConflict) throw userError("document_client_mismatch", "Document client mismatch");
    }

    const previousDeclarationId = document.declarationId;
    if (previousDeclarationId && String(previousDeclarationId) === String(args.declarationId)) {
      return { success: true, declarationId: String(args.declarationId) };
    }
    if (isClientUpload && previousDeclarationId) {
      throw userError("client_upload_is_already_attached_to", "Client upload is already attached to a filing");
    }

    const now = Date.now();

    // A portal upload arriving on an unclaimed draft also settles who the
    // filing belongs to — matches clients.attachUnlinkedDocument.
    if (isClientUpload && !declaration.clientId) {
      await ctx.db.patch(args.declarationId, {
        clientId: document.clientId,
        lastUpdated: now,
      });
    }

    await ctx.db.patch(args.documentId, {
      declarationId: args.declarationId,
      mrn: declaration.mrn,
      // Only a client upload enters the broker's review queue; a document the
      // broker filed themselves keeps whatever status it had earned.
      ...(isClientUpload ? { status: "pending_review" } : {}),
      linkedBy: identity.subject,
      linkedAt: now,
    });

    try {
      await ctx.db.insert("auditLogs", {
        userId: identity.subject,
        action: isClientUpload ? "portal_document_attached" : "document_linked",
        details: {
          clientId: document.clientId ? String(document.clientId) : undefined,
          documentId: String(args.documentId),
          declarationId: String(args.declarationId),
          previousDeclarationId: previousDeclarationId
            ? String(previousDeclarationId)
            : undefined,
        },
        timestamp: now,
        archived: false,
      });
    } catch {
      // Never block the link on a telemetry write failure.
    }

    const code = extractDocumentCode(document.fileName) || extractDocumentCode(document.fileType);
    if (code) {
      await updateRequirementStatusForDeclaration(
        ctx,
        args.declarationId,
        code,
        "uploaded",
        args.documentId,
      );

      // Re-linking leaves the old declaration short of evidence unless another
      // document still covers the code — same reasoning as deleteDocument.
      if (previousDeclarationId) {
        const remainingDocs = await ctx.db
          .query("documents")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", previousDeclarationId))
          .take(50);
        const hasSameCode = remainingDocs.some(
          (doc: any) =>
            (extractDocumentCode(doc.fileName) || extractDocumentCode(doc.fileType)) === code,
        );
        if (!hasSameCode) {
          await updateRequirementStatusForDeclaration(ctx, previousDeclarationId, code, "missing");
        }
      }
    }

    return { success: true, declarationId: String(args.declarationId) };
  },
});

export const upsertRequirementsForDeclaration = mutation({
  args: {
    declarationId: v.id("declarations"),
    requirements: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        type: v.optional(v.string()),
        source: v.optional(v.string()),
        requirementLevel: v.optional(v.string()),
        deReference: v.optional(v.string()),
        hmrcGuidance: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw forbiddenError();
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("document_requirements")
      .withIndex("by_declaration", (q: any) => q.eq("declarationId", args.declarationId))
      .take(300);
    const declarationDocs = await ctx.db
      .query("documents")
      .withIndex("by_declaration", (q: any) => q.eq("declarationId", args.declarationId))
      .take(500);

    const existingByCode = new Map<string, any>();
    for (const row of existing) {
      existingByCode.set(String(row.code), row);
    }

    const incomingCodes = new Set<string>();
    const ops: Promise<unknown>[] = [];

    for (const requirement of args.requirements) {
      const code = String(requirement.code).toUpperCase();
      incomingCodes.add(code);
      const existingRow = existingByCode.get(code);

      const hasExistingDoc = declarationDocs.some(
        (doc: any) =>
          (extractDocumentCode(doc.fileName) || extractDocumentCode(doc.fileType)) === code,
      );

      if (existingRow) {
        const currentStatus = String(existingRow.status || "missing");
        const preserveStatus = currentStatus === "uploaded" || currentStatus === "verified";
        const nextStatus = preserveStatus
          ? currentStatus
          : hasExistingDoc
            ? "uploaded"
            : "missing";
        ops.push(ctx.db.patch(existingRow._id, {
          name: requirement.name,
          type: requirement.type,
          source: requirement.source || "preference_tool",
          requirementLevel: requirement.requirementLevel || existingRow.requirementLevel || "blocking",
          deReference: requirement.deReference || existingRow.deReference || "DE 2/3",
          hmrcGuidance: requirement.hmrcGuidance || existingRow.hmrcGuidance,
          status: nextStatus,
          updatedAt: now,
        }));
      } else {
        ops.push(ctx.db.insert("document_requirements", {
          declarationId: args.declarationId,
          userId: identity.subject,
          code,
          name: requirement.name,
          type: requirement.type,
          source: requirement.source || "preference_tool",
          requirementLevel: requirement.requirementLevel || "blocking",
          deReference: requirement.deReference || "DE 2/3",
          hmrcGuidance: requirement.hmrcGuidance,
          status: hasExistingDoc ? "uploaded" : "missing",
          createdAt: now,
          updatedAt: now,
        }));
      }
    }

    const incomingSources = new Set(
      args.requirements.map((req) => String(req.source || "preference_tool")),
    );
    for (const row of existing) {
      if (incomingSources.has(String(row.source || "preference_tool")) && !incomingCodes.has(String(row.code))) {
        ops.push(ctx.db.delete(row._id));
      }
    }

    await Promise.all(ops);

    return { success: true, count: args.requirements.length };
  },
});

export const getDocumentRequirements = query({
  args: { declarationId: v.optional(v.id("declarations")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    if (args.declarationId) {
      const declaration = await ctx.db.get(args.declarationId);
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        return [];
      }
      return await ctx.db
        .query("document_requirements")
        .withIndex("by_declaration", (q: any) => q.eq("declarationId", args.declarationId))
        .take(300);
    }

    const declarations = await listDeclarationsForTenant(ctx, identity.subject, 200);
    const accessibleIds = new Set(declarations.map((declaration) => declaration._id));
    if (accessibleIds.size === 0) return [];

    const activeOrgId = await getActiveOrgId(ctx, identity.subject);
    if (!activeOrgId) {
      const rows = await ctx.db
        .query("document_requirements")
        .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
        .take(6000);
      return rows.filter((row) => accessibleIds.has(row.declarationId));
    }

    const batches = await Promise.all(
      declarations.map((declaration) =>
        ctx.db
          .query("document_requirements")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", declaration._id))
          .take(100),
      ),
    );
    return batches.flat();
  },
});

function toDateKeyFromMs(timestamp: number) {
  const d = new Date(timestamp);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseUploadDateToMs(value: any): number | null {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export const getRequirementTelemetry = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const declarations = await listDeclarationsForTenant(ctx, identity.subject, 600);
    const docs = await listDocumentsForTenant(ctx, identity.subject, 2000);
    const requirements = [];
    for (const declaration of declarations) {
      const rows = await ctx.db
        .query("document_requirements")
        .withIndex("by_declaration", (q: any) => q.eq("declarationId", declaration._id))
        .take(300);
      requirements.push(...rows);
    }
    const days = 7;
    const dayKeys: string[] = [];
    const now = Date.now();
    const sevenDaysAgoMs = now - days * 24 * 60 * 60 * 1000;

    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .filter((q: any) => q.gte(q.field("timestamp"), sevenDaysAgoMs))
      .take(400);
    for (let i = days - 1; i >= 0; i--) {
      dayKeys.push(toDateKeyFromMs(now - i * 24 * 60 * 60 * 1000));
    }

    const trendByDay = new Map<string, { requirementUpdates: number; docsSaved: number; unresolvedMismatches: number }>();
    for (const key of dayKeys) {
      trendByDay.set(key, { requirementUpdates: 0, docsSaved: 0, unresolvedMismatches: 0 });
    }

    const docsByDeclAndCode = new Set<string>();
    let unmappedDocsCount = 0;
    for (const doc of docs) {
      const code = extractDocumentCode(doc.fileType) || extractDocumentCode(doc.fileName);
      const declId = String(doc.declarationId || "");
      if (code && declId) {
        docsByDeclAndCode.add(`${declId}:${code}`);
      } else if (declId) {
        unmappedDocsCount += 1;
      }

      const docMs = parseUploadDateToMs(doc.uploadDate);
      if (docMs) {
        const key = toDateKeyFromMs(docMs);
        const bucket = trendByDay.get(key);
        if (bucket) bucket.docsSaved += 1;
      }
    }

    let blockingMissingCount = 0;
    let advisoryMissingCount = 0;
    const declarationsWithBlockingMissing = new Set<string>();
    let potentialMismatchCount = 0;

    for (const req of requirements) {
      const code = String(req.code || "").toUpperCase();
      const declId = String(req.declarationId || "");
      const requirementLevel = String(req.requirementLevel || "blocking");
      const isMissing = String(req.status || "") === "missing";
      const hasMatchingDoc = docsByDeclAndCode.has(`${declId}:${code}`);

      if (isMissing && requirementLevel === "blocking") {
        blockingMissingCount += 1;
        declarationsWithBlockingMissing.add(declId);
      }
      if (isMissing && requirementLevel === "advisory") advisoryMissingCount += 1;
      if (isMissing && hasMatchingDoc) potentialMismatchCount += 1;

      const updatedMs = Number(req.updatedAt || req.createdAt || 0);
      if (updatedMs > 0) {
        const key = toDateKeyFromMs(updatedMs);
        const bucket = trendByDay.get(key);
        if (bucket) {
          bucket.requirementUpdates += 1;
          if (isMissing && hasMatchingDoc) bucket.unresolvedMismatches += 1;
        }
      }
    }

    const activeDeclarations = declarations.filter((decl: any) => String(decl.status || "Draft") !== "Draft");
    const blockingDeclRatio = activeDeclarations.length > 0
      ? declarationsWithBlockingMissing.size / activeDeclarations.length
      : 0;

    const relevantErrorLogs = auditLogs
      .filter((row: any) => ["doc_action_error", "smart_upload_error"].includes(String(row.action || "")));

    const signatureMap = new Map<string, { count: number; lastSeen: number }>();
    for (const row of relevantErrorLogs) {
      const details = row.details || {};
      const code = String(details.code || "UNKNOWN");
      const action = String(details.action || row.action || "unknown_action");
      const signature = `${action}:${code}`;
      const existing = signatureMap.get(signature) || { count: 0, lastSeen: 0 };
      existing.count += 1;
      existing.lastSeen = Math.max(existing.lastSeen, Number(row.timestamp || 0));
      signatureMap.set(signature, existing);
    }

    const topSignatures = Array.from(signatureMap.entries())
      .map(([signature, value]) => ({
        signature,
        count: value.count,
        lastSeen: value.lastSeen,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const docsSaved7d = dayKeys.reduce((acc, key) => acc + (trendByDay.get(key)?.docsSaved || 0), 0);
    const totalErrors7d = relevantErrorLogs.length;
    const errorRatePercent = docsSaved7d > 0 ? (totalErrors7d / docsSaved7d) * 100 : 0;

    const alerts: Array<{ level: "warning" | "critical"; key: string; message: string }> = [];
    if (blockingDeclRatio > 0.2) {
      alerts.push({
        level: "critical",
        key: "blocking_decl_ratio",
        message: `Blocking-missing ratio is ${(blockingDeclRatio * 100).toFixed(1)}% (>20%).`,
      });
    }
    if (potentialMismatchCount > 0) {
      alerts.push({
        level: "warning",
        key: "requirements_docs_mismatch",
        message: `${potentialMismatchCount} potential requirement/document mismatch(es) detected.`,
      });
    }
    if (unmappedDocsCount > 0) {
      alerts.push({
        level: "warning",
        key: "unmapped_docs",
        message: `${unmappedDocsCount} document(s) linked to a declaration are not mapped to a requirement code.`,
      });
    }
    if (errorRatePercent > 10) {
      alerts.push({
        level: "warning",
        key: "doc_action_error_rate",
        message: `Document action error rate is ${errorRatePercent.toFixed(1)}% over the last 7 days.`,
      });
    }

    return {
      summary: {
        totalRequirements: requirements.length,
        blockingMissingCount,
        advisoryMissingCount,
        declarationsWithBlockingMissing: declarationsWithBlockingMissing.size,
        activeDeclarations: activeDeclarations.length,
        potentialMismatchCount,
        unmappedDocsCount,
      },
      trend: dayKeys.map((key) => ({
        date: key,
        requirementUpdates: trendByDay.get(key)?.requirementUpdates || 0,
        docsSaved: trendByDay.get(key)?.docsSaved || 0,
        unresolvedMismatches: trendByDay.get(key)?.unresolvedMismatches || 0,
      })),
      alerts,
      thresholds: {
        blockingDeclarationRatioCritical: 0.2,
      },
      errorPanel: {
        totalErrors7d,
        docsSaved7d,
        errorRatePercent: Number(errorRatePercent.toFixed(2)),
        topSignatures,
      },
      runbook: "docs/operational-readiness-runbook.md",
    };
  },
});

/**
 * Delete stored files that no `documents` row references.
 *
 * `discardOrphanedUpload` only covers failures the browser survives. A refresh
 * or a closed tab between the storage POST and the row insert kills the page
 * before the discard can run, leaving bytes with no owner, no orgId and no
 * tenancy check. This is the backstop.
 *
 * `documents.fileId` is the only schema field that references a stored file —
 * verified before writing this. If another table ever stores a storage id, this
 * sweep must learn about it or it will delete live data.
 */
export const sweepOrphanedFiles = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
    scanLimit: v.optional(v.number()),
    deleteLimit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    deleted: v.number(),
    referenced: v.number(),
    tooRecent: v.number(),
  }),
  handler: async (ctx, args) => {
    // Generous grace period so an upload still mid-flight is never touched.
    const cutoff = Date.now() - (args.olderThanMs ?? 24 * 60 * 60 * 1000);
    const deleteLimit = args.deleteLimit ?? 50;

    const files = await ctx.db.system.query("_storage").take(args.scanLimit ?? 500);

    let scanned = 0;
    let deleted = 0;
    let referenced = 0;
    let tooRecent = 0;

    for (const file of files) {
      scanned += 1;
      if (file._creationTime > cutoff) {
        tooRecent += 1;
        continue;
      }
      const claimed = await ctx.db
        .query("documents")
        .withIndex("by_file", (q) => q.eq("fileId", file._id))
        .first();
      if (claimed) {
        referenced += 1;
        continue;
      }
      await ctx.storage.delete(file._id);
      deleted += 1;
      if (deleted >= deleteLimit) break;
    }

    if (deleted > 0) {
      console.warn("[storage-sweep] deleted orphaned files", { deleted, scanned, referenced });
    }
    return { scanned, deleted, referenced, tooRecent };
  },
});
