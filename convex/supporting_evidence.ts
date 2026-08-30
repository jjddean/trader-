/**
 * HMRC supporting evidence — what HMRC asked for, and what we already hold.
 *
 * Sources, retrieved 2026-08-23:
 * - https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html
 * - https://www.gov.uk/guidance/send-documents-to-support-declarations-for-the-customs-declaration-service
 *
 * Parsing and matching live in `src/lib/hmrc-supporting-evidence.ts` so they
 * are testable without a Convex runtime. This module supplies the data and
 * enforces access.
 *
 * The documentary request is read from the stored DMSDOC notification rather
 * than a derived field: the `notifications` table is immutable append-only and
 * holds HMRC's own words, which is what an audit needs to see.
 */

import { v } from "convex/values";

import { query } from "./_generated/server";
import { canAccessDeclaration } from "./lib/org_access";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";
import {
  matchRequestedEvidence,
  parseDocumentaryRequest,
  type DeclarationSupportingDocument,
} from "../src/lib/hmrc-supporting-evidence";

function normalisedDocs(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  return [];
}

/**
 * The open documentary check for a declaration, with each requested document
 * correlated to the declaration's own DE 2/3 data where that can be done
 * reliably.
 *
 * Returns `null` when HMRC has not asked for anything. The caller then offers
 * proactive upload, which HMRC permits at any time:
 *
 * > "An authenticated trader may use the service at any time to submit files."
 */
export const getDocumentaryRequest = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      return null;
    }

    const notifications = await collectDeclarationNotifications(ctx.db, {
      declarationId: args.declarationId,
      conversationId: declaration.conversationId as string | undefined,
      mrn: declaration.mrn as string | undefined,
    });

    // Most recent DMSDOC wins: a later documentary check supersedes an earlier
    // one, and HMRC re-states everything it still wants.
    const dmsdoc = notifications
      .filter((n) => String(n.notificationType ?? "").toUpperCase() === "DMSDOC")
      .sort((a, b) => {
        const at = Date.parse(String(a.issueDateTime ?? "")) || Number(a.timestamp ?? 0) || 0;
        const bt = Date.parse(String(b.issueDateTime ?? "")) || Number(b.timestamp ?? 0) || 0;
        return bt - at;
      })[0];

    if (!dmsdoc) return null;

    const parsed = parseDocumentaryRequest(
      String(dmsdoc.rawPayload ?? ""),
      String(declaration.mrn ?? ""),
    );
    if (parsed.items.length === 0) {
      // A DMSDOC with no ACA detail is still a documentary check; surface it
      // with no line items rather than fabricating any.
      return {
        mrn: parsed.mrn,
        issueDateTime: dmsdoc.issueDateTime ?? null,
        notificationId: dmsdoc._id,
        items: [],
      };
    }

    // DE 2/3 supporting-document references, per goods item.
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .collect();

    const requirements = await ctx.db
      .query("document_requirements")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(300);

    const supporting: DeclarationSupportingDocument[] = [];

    for (const [index, item] of items.entries()) {
      const goodsItemNumber = Number(item.sequenceNumber ?? index + 1);
      for (const doc of normalisedDocs(item.additionalDocuments)) {
        supporting.push({
          code: doc.code ? String(doc.code) : undefined,
          reference: doc.reference ? String(doc.reference) : undefined,
          name: doc.name ? String(doc.name) : undefined,
          goodsItemNumber,
        });
      }
    }

    // Requirements carry the link to an actual uploaded file, so they are the
    // second source and override a bare DE 2/3 entry with the same code.
    for (const requirement of requirements) {
      const linked = requirement.linkedDocumentId
        ? await ctx.db.get(requirement.linkedDocumentId)
        : null;
      supporting.push({
        code: requirement.code,
        name: requirement.name,
        linkedDocumentId: requirement.linkedDocumentId ?? undefined,
        linkedFileName: linked?.fileName ? String(linked.fileName) : undefined,
      });
    }

    return {
      mrn: parsed.mrn,
      issueDateTime: dmsdoc.issueDateTime ?? null,
      notificationId: dmsdoc._id,
      items: matchRequestedEvidence(parsed.items, supporting),
    };
  },
});

/**
 * Files sent to HMRC against this declaration, with their group position and
 * HMRC reference, newest first.
 *
 * The reference is what ties a row to its outcome notification — HMRC uses it
 * as the ConversationId for that file's success or failure message.
 */
export const listEvidenceUploads = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      return [];
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(200);

    return documents
      .filter((doc) => Boolean(doc.hmrcUploadReference))
      .map((doc) => ({
        _id: doc._id,
        fileName: doc.fileName ? String(doc.fileName) : "",
        fileType: doc.fileType ? String(doc.fileType) : undefined,
        fileSize: doc.fileSize,
        status: doc.status ? String(doc.status) : undefined,
        uploadDate: doc.uploadDate ? String(doc.uploadDate) : undefined,
        hmrcUploadReference: doc.hmrcUploadReference,
        hmrcConversationId: doc.hmrcConversationId,
        fileSequenceNo: doc.fileSequenceNo,
        fileGroupSize: doc.fileGroupSize,
        requestedStatementCode: doc.requestedStatementCode,
      }))
      .sort((a, b) => String(b.uploadDate ?? "").localeCompare(String(a.uploadDate ?? "")));
  },
});
