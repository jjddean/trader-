import { query } from "./_generated/server";
import { v } from "convex/values";

async function getDbUser(ctx: any, userId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk", (q: any) => q.eq("clerkId", userId))
    .unique();
}

async function resolveOrganizationId(ctx: any, userId: string, preferredWorkspaceId?: unknown) {
  if (preferredWorkspaceId) {
    return `workspace:${String(preferredWorkspaceId)}`;
  }

  const dbUser = await getDbUser(ctx, userId);
  const explicitOrgId = typeof dbUser?.orgId === "string" ? dbUser.orgId.trim() : "";
  if (explicitOrgId) {
    return `org:${explicitOrgId}`;
  }

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (membership?.workspaceId) {
    return `workspace:${String(membership.workspaceId)}`;
  }

  const ownedWorkspace = await ctx.db
    .query("workspaces")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", userId))
    .first();
  if (ownedWorkspace?._id) {
    return `workspace:${String(ownedWorkspace._id)}`;
  }

  return `user:${userId}`;
}

async function canAccessDeclaration(ctx: any, userId: string, declarationId: any) {
  const declaration = await ctx.db.get(declarationId);
  if (!declaration) return { allowed: false, declaration: null };
  if (String(declaration.userId || "") === userId) {
    return { allowed: true, declaration };
  }

  if (declaration.workspaceId) {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const match = membership.some((row: any) => String(row.workspaceId) === String(declaration.workspaceId));
    if (match) {
      return { allowed: true, declaration };
    }
  }

  return { allowed: false, declaration: null };
}

async function findConversationForScope(ctx: any, userId: string, declarationId?: any) {
  if (declarationId) {
    return await ctx.db
      .query("conversations")
      .withIndex("by_declaration", (q: any) => q.eq("declarationId", declarationId))
      .first();
  }

  const organizationId = await resolveOrganizationId(ctx, userId);
  const recentConversations = await ctx.db
    .query("conversations")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(40);
  const recentGeneralConversation = recentConversations.find((conversation: any) => !conversation.declarationId);
  if (recentGeneralConversation) {
    return recentGeneralConversation;
  }

  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", organizationId))
    .collect();

  return conversations
    .filter((conversation: any) => !conversation.declarationId)
    .sort((a: any, b: any) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] ?? null;
}

async function listConversationMessages(ctx: any, conversationId: any) {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q: any) => q.eq("conversationId", conversationId))
    .order("desc")
    .take(80);

  return rows.sort((a: any, b: any) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
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

    let declaration: any = null;
    if (args.declarationId) {
      const access = await canAccessDeclaration(ctx, identity.subject, args.declarationId);
      if (!access.allowed || !access.declaration) {
        throw new Error("Unauthorized");
      }
      declaration = access.declaration;
    }

    const conversation = await findConversationForScope(ctx, identity.subject, args.declarationId);
    const messages = conversation ? await listConversationMessages(ctx, conversation._id) : [];
    const events = args.declarationId
      ? await ctx.db
          .query("assistantEvents")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", args.declarationId))
          .order("desc")
          .take(40)
      : conversation
        ? await ctx.db
            .query("assistantEvents")
            .withIndex("by_conversation", (q: any) => q.eq("conversationId", conversation._id))
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
      events: events.sort((a: any, b: any) => Number(a.createdAt || 0) - Number(b.createdAt || 0)),
    };
  },
});

export const getAssistantContext = query({
  args: { declarationId: v.optional(v.id("declarations")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    let declaration: any = null;
    if (args.declarationId) {
      const access = await canAccessDeclaration(ctx, identity.subject, args.declarationId);
      if (!access.allowed || !access.declaration) {
        throw new Error("Unauthorized");
      }
      declaration = access.declaration;
    }

    const organizationId = await resolveOrganizationId(ctx, identity.subject, declaration?.workspaceId);
    const conversation = await findConversationForScope(ctx, identity.subject, args.declarationId);
    const chatHistory = conversation ? await listConversationMessages(ctx, conversation._id) : [];

    const declarationPreviews = await ctx.db
      .query("declaration_preview")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .take(20);
    const documents = args.declarationId
      ? await ctx.db
          .query("documents")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", args.declarationId))
          .take(10)
      : await ctx.db
          .query("documents")
          .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
          .take(10);
    const notifications = args.declarationId
      ? await ctx.db
          .query("notifications")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", args.declarationId))
          .take(10)
      : await ctx.db
          .query("notifications")
          .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
          .take(10);
    const validationFailures = args.declarationId
      ? await ctx.db
          .query("validation_results")
          .withIndex("by_declaration_status", (q: any) =>
            q.eq("declarationId", args.declarationId).eq("status", "fail"),
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
            workspaceId: declaration.workspaceId ?? null,
            eori: declaration.eori ?? null,
          }
        : null,
      openDeclarations: declarationPreviews
        .filter((row: any) => row.status && row.status !== "Cleared" && row.status !== "Accepted")
        .slice(0, 10),
      recentDocuments: documents.slice(0, 5),
      recentNotifications: notifications.slice(0, 5),
      validationFailures: validationFailures.slice(0, 10),
      chatHistory: chatHistory.slice(-12).map((message: any) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  },
});
