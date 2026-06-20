import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  canAccessDeclarationById,
  conversationScopeMatches,
  findGeneralConversationForScope,
  resolveConversationScopeId,
} from "./lib/org_access";

// Re-export normalize for declaration internal paths (local alias)
function declOrgScope(declaration: { orgId?: unknown; userId?: unknown }) {
  const org = typeof declaration.orgId === "string" ? declaration.orgId.trim() : "";
  if (org) return org;
  const owner = typeof declaration.userId === "string" ? declaration.userId.trim() : "";
  return owner ? `user:${owner}` : "user:system";
}

async function ensureConversationForScope(
  ctx: MutationCtx,
  userId: string,
  declarationId?: Id<"declarations">,
) {
  if (declarationId) {
    const access = await canAccessDeclarationById(ctx, userId, declarationId);
    if (!access.allowed || !access.declaration) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: Date.now(),
        status: existing.status || "active",
      });
      return existing;
    }

    const organizationId = await resolveConversationScopeId(ctx, userId, access.declaration);
    const now = Date.now();
    const title = access.declaration.mrn
      ? `Declaration ${String(access.declaration.mrn)}`
      : "Declaration Assistant";
    const conversationId = await ctx.db.insert("conversations", {
      organizationId,
      declarationId,
      createdBy: userId,
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(conversationId);
  }

  const existingGeneral = await findGeneralConversationForScope(ctx, userId);
  if (existingGeneral) {
    await ctx.db.patch(existingGeneral._id, {
      updatedAt: Date.now(),
      status: existingGeneral.status || "active",
    });
    return existingGeneral;
  }

  const organizationId = await resolveConversationScopeId(ctx, userId);
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    organizationId,
    createdBy: userId,
    title: "Freightcode Assistant",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(conversationId);
}

async function ensureConversationForDeclarationInternal(
  ctx: MutationCtx,
  declarationId: Id<"declarations">,
) {
  const declaration = await ctx.db.get(declarationId);
  if (!declaration) {
    throw new Error("Declaration not found");
  }

  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: Date.now() });
    return existing;
  }

  const createdBy = String(declaration.userId || "system");
  const organizationId = declOrgScope(declaration);
  const now = Date.now();
  const title = declaration.mrn ? `Declaration ${String(declaration.mrn)}` : "Declaration Assistant";
  const conversationId = await ctx.db.insert("conversations", {
    organizationId,
    declarationId,
    createdBy,
    title,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(conversationId);
}

async function assertConversationAccess(
  ctx: MutationCtx,
  userId: string,
  conversationId: Id<"conversations">,
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  if (conversation.declarationId) {
    const access = await canAccessDeclarationById(ctx, userId, conversation.declarationId);
    if (!access.allowed) throw new Error("Unauthorized");
    return conversation;
  }

  const scopeId = await resolveConversationScopeId(ctx, userId);
  if (!conversationScopeMatches(conversation.organizationId, scopeId)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export const ensureConversation = mutation({
  args: { declarationId: v.optional(v.id("declarations")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ensureConversationForScope(ctx, identity.subject, args.declarationId);
  },
});

export const setConversationStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertConversationAccess(ctx, identity.subject, args.conversationId);
    await ctx.db.patch(args.conversationId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const appendUserMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertConversationAccess(ctx, identity.subject, args.conversationId);

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      createdAt: now,
      streamed: false,
      metadata: args.metadata,
    });
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      status: "thinking",
    });
    return messageId;
  },
});

export const startAssistantMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertConversationAccess(ctx, identity.subject, args.conversationId);

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      createdAt: now,
      streamed: true,
      metadata: args.metadata,
    });
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      status: "streaming",
    });
    return messageId;
  },
});

export const updateAssistantMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    streamed: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    await assertConversationAccess(ctx, identity.subject, message.conversationId);

    await ctx.db.patch(args.messageId, {
      content: args.content,
      streamed: args.streamed,
      metadata: args.metadata,
    });
    await ctx.db.patch(message.conversationId, {
      updatedAt: Date.now(),
      status: "streaming",
    });
  },
});

export const finalizeAssistantMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    await assertConversationAccess(ctx, identity.subject, message.conversationId);

    await ctx.db.patch(args.messageId, {
      content: args.content,
      streamed: false,
      metadata: args.metadata,
    });
    await ctx.db.patch(message.conversationId, {
      updatedAt: Date.now(),
      status: "active",
    });
  },
});

export const appendAssistantEvent = mutation({
  args: {
    conversationId: v.id("conversations"),
    declarationId: v.optional(v.id("declarations")),
    eventType: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertConversationAccess(ctx, identity.subject, args.conversationId);
    return await ctx.db.insert("assistantEvents", {
      conversationId: args.conversationId,
      declarationId: args.declarationId,
      eventType: args.eventType,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

export const recordDeclarationEvent = internalMutation({
  args: {
    declarationId: v.id("declarations"),
    eventType: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conversation = await ensureConversationForDeclarationInternal(ctx, args.declarationId);
    if (!conversation) throw new Error("Conversation not found");
    await ctx.db.insert("assistantEvents", {
      conversationId: conversation._id,
      declarationId: args.declarationId,
      eventType: args.eventType,
      payload: args.payload,
      createdAt: Date.now(),
    });
    await ctx.db.patch(conversation._id, {
      updatedAt: Date.now(),
    });
  },
});
