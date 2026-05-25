import { internalMutation, mutation } from "./_generated/server";
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

async function ensureConversationForScope(
  ctx: any,
  userId: string,
  declarationId?: any,
) {
  if (declarationId) {
    const access = await canAccessDeclaration(ctx, userId, declarationId);
    if (!access.allowed || !access.declaration) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_declaration", (q: any) => q.eq("declarationId", declarationId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: Date.now(),
        status: existing.status || "active",
      });
      return existing;
    }

    const organizationId = await resolveOrganizationId(ctx, userId, access.declaration.workspaceId);
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

  const organizationId = await resolveOrganizationId(ctx, userId);
  const existingGeneral = (await ctx.db
    .query("conversations")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", organizationId))
    .collect())
    .filter((conversation: any) => !conversation.declarationId)
    .sort((a: any, b: any) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];

  if (existingGeneral) {
    await ctx.db.patch(existingGeneral._id, {
      updatedAt: Date.now(),
      status: existingGeneral.status || "active",
    });
    return existingGeneral;
  }

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

async function ensureConversationForDeclarationInternal(ctx: any, declarationId: any) {
  const declaration = await ctx.db.get(declarationId);
  if (!declaration) {
    throw new Error("Declaration not found");
  }

  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_declaration", (q: any) => q.eq("declarationId", declarationId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: Date.now() });
    return existing;
  }

  const createdBy = String(declaration.userId || "system");
  const organizationId = await resolveOrganizationId(ctx, createdBy, declaration.workspaceId);
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

async function assertConversationAccess(ctx: any, userId: string, conversationId: any) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  if (conversation.declarationId) {
    const access = await canAccessDeclaration(ctx, userId, conversation.declarationId);
    if (!access.allowed) throw new Error("Unauthorized");
    return conversation;
  }

  const organizationId = await resolveOrganizationId(ctx, userId);
  if (conversation.organizationId !== organizationId) {
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
