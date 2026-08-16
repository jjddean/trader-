import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  canAccessDeclarationById,
  findGeneralConversationForScope,
  listDeclarationPreviewsForTenant,
  listDocumentsForTenant,
  listNotificationsForTenant,
  resolveConversationScopeId,
} from "./lib/org_access";
import { forbiddenError, unauthenticatedError } from "./lib/user_errors";

async function findConversationForScope(
  ctx: Parameters<typeof findGeneralConversationForScope>[0],
  userId: string,
  declarationId?: Id<"declarations">,
) {
  if (declarationId) {
    return await ctx.db
      .query("conversations")
      .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
      .first();
  }

  return await findGeneralConversationForScope(ctx, userId);
}

async function listConversationMessages(
  ctx: Parameters<typeof findGeneralConversationForScope>[0],
  conversationId: Id<"conversations">,
) {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .order("desc")
    .take(80);

  return rows.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

export const getAssistantWorkspace = query({
  args: { declarationId: v.optional(v.id("declarations")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        conversation: null,
        messages: [],
        events: [],
      };
    }

    let declaration = null;
    if (args.declarationId) {
      const access = await canAccessDeclarationById(ctx, identity.subject, args.declarationId);
      if (!access.allowed || !access.declaration) {
        throw forbiddenError();
      }
      declaration = access.declaration;
    }

    const conversation = await findConversationForScope(ctx, identity.subject, args.declarationId);
    const messages = conversation ? await listConversationMessages(ctx, conversation._id) : [];
    const events = args.declarationId
      ? await ctx.db
          .query("assistantEvents")
          .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
          .order("desc")
          .take(40)
      : conversation
        ? await ctx.db
            .query("assistantEvents")
            .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
            .order("desc")
            .take(40)
        : [];

    return {
      conversation,
      declaration: declaration
        ? {
            id: declaration._id,
            mrn: declaration.mrn ?? null,
            status: declaration.status ?? "Draft",
          }
        : null,
      messages,
      events: events.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)),
    };
  },
});

export const getAssistantContext = query({
  args: { declarationId: v.optional(v.id("declarations")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    let declaration = null;
    if (args.declarationId) {
      const access = await canAccessDeclarationById(ctx, identity.subject, args.declarationId);
      if (!access.allowed || !access.declaration) {
        throw forbiddenError();
      }
      declaration = access.declaration;
    }

    const organizationId = await resolveConversationScopeId(ctx, identity.subject, declaration);
    const conversation = await findConversationForScope(ctx, identity.subject, args.declarationId);
    const chatHistory = conversation ? await listConversationMessages(ctx, conversation._id) : [];

    const declarationPreviews = await listDeclarationPreviewsForTenant(ctx, identity.subject, 20);
    const documents = args.declarationId
      ? await ctx.db
          .query("documents")
          .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
          .take(10)
      : await listDocumentsForTenant(ctx, identity.subject, 10);
    const notifications = args.declarationId
      ? await ctx.db
          .query("notifications")
          .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
          .take(10)
      : await listNotificationsForTenant(ctx, identity.subject, 10);
    const validationFailures =
      args.declarationId != null
        ? await ctx.db
            .query("validation_results")
            .withIndex("by_declaration_status", (q) =>
              q.eq("declarationId", args.declarationId!).eq("status", "fail"),
            )
            .collect()
        : [];

    return {
      organizationId,
      conversationId: conversation?._id ?? null,
      declaration: declaration
        ? {
            id: declaration._id,
            mrn: declaration.mrn ?? null,
            status: declaration.status ?? "Draft",
            conversationId: declaration.conversationId ?? null,
            orgId: declaration.orgId ?? null,
            eori: declaration.eori ?? null,
          }
        : null,
      openDeclarations: declarationPreviews
        .filter((row) => row.status && row.status !== "Cleared" && row.status !== "Accepted")
        .slice(0, 10),
      recentDocuments: documents.slice(0, 5),
      recentNotifications: notifications.slice(0, 5),
      validationFailures: validationFailures.slice(0, 10),
      chatHistory: chatHistory.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  },
});
