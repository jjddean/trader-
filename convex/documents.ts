import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  canAccessDeclaration,
  canAccessDocument,
  getActiveOrgId,
  listDocumentsForTenant,
  listDeclarationsForTenant,
  orgIdFromDeclaration,
} from "./lib/org_access";

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
    if (!identity) throw new Error("Unauthenticated");
    
    // Verify ownership of parent declaration
    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw new Error("Unauthorized");
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
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.storage.generateUploadUrl();
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
      throw new Error("Unauthenticated");
    }

    const declaration = args.declarationId ? await ctx.db.get(args.declarationId) : null;
    if (args.declarationId) {
      if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
        throw new Error("Unauthorized");
      }
    }

    const documentId = await ctx.db.insert("documents", {
      fileId: args.storageId,
      userId: identity.subject, // Enforce session ID
      orgId: orgIdFromDeclaration(declaration),
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
      throw new Error("Unauthenticated");
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
      throw new Error("Unauthorized");
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
      throw new Error("No file is attached to this document");
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
      throw new Error("Unauthenticated");
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
      throw new Error("Unauthorized");
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
      throw new Error("Unauthenticated");
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
      throw new Error("Unauthorized");
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
    if (!identity) throw new Error("Unauthenticated");

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      throw new Error("Unauthorized");
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
