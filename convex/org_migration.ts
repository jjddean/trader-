import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getActiveOrgId, isPersonalScopedRecord } from "./lib/org_access";
import { unauthenticatedError, userError } from "./lib/user_errors";

type MigrationCounts = {
  declarations: number;
  declarationPreviews: number;
  documents: number;
  notifications: number;
  conversations: number;
};

async function countPersonalDataForUser(ctx: { db: any }, userId: string): Promise<MigrationCounts> {
  const declarations = await ctx.db
    .query("declarations")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  const personalDeclIds = new Set(
    declarations.filter((row: { orgId?: unknown }) => isPersonalScopedRecord(row.orgId)).map((row: { _id: Id<"declarations"> }) => row._id),
  );

  const previews = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  const personalPreviews = previews.filter(
    (row: { orgId?: unknown; declarationId?: Id<"declarations"> }) =>
      isPersonalScopedRecord(row.orgId) || (row.declarationId && personalDeclIds.has(row.declarationId)),
  );

  const documents = await ctx.db
    .query("documents")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  const personalDocuments = documents.filter(
    (row: { orgId?: unknown; declarationId?: Id<"declarations"> }) =>
      isPersonalScopedRecord(row.orgId) ||
      (row.declarationId && personalDeclIds.has(row.declarationId as Id<"declarations">)),
  );

  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  const personalNotifications = notifications.filter(
    (row: { orgId?: unknown; declarationId?: Id<"declarations"> }) =>
      isPersonalScopedRecord(row.orgId) ||
      (row.declarationId && personalDeclIds.has(row.declarationId as Id<"declarations">)),
  );

  const personalScope = `user:${userId}`;
  const conversations = await ctx.db.query("conversations").take(5000);
  const personalConversations = conversations.filter(
    (row: { organizationId?: string; createdBy?: string }) =>
      row.createdBy === userId &&
      (row.organizationId === personalScope || row.organizationId === `org:${personalScope}`),
  );

  return {
    declarations: personalDeclIds.size,
    declarationPreviews: personalPreviews.length,
    documents: personalDocuments.length,
    notifications: personalNotifications.length,
    conversations: personalConversations.length,
  };
}

async function migratePersonalDataForUser(
  ctx: { db: any; runMutation: (ref: any, args: any) => Promise<any> },
  userId: string,
  orgId: string,
): Promise<MigrationCounts & { orgId: string; migratedAt: number }> {
  const targetOrgId = orgId.trim();
  if (!targetOrgId) throw userError("orgid_is_required", "orgId is required");

  const declarations = await ctx.db
    .query("declarations")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);

  const personalDeclarations = declarations.filter((row: { orgId?: unknown }) =>
    isPersonalScopedRecord(row.orgId),
  );
  const personalDeclIds = new Set(
    personalDeclarations.map((row: { _id: Id<"declarations"> }) => row._id),
  );

  for (const declaration of personalDeclarations) {
    await ctx.db.patch(declaration._id, { orgId: targetOrgId });
  }

  const previews = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  for (const preview of previews) {
    const linkedToPersonalDecl =
      preview.declarationId && personalDeclIds.has(preview.declarationId as Id<"declarations">);
    if (isPersonalScopedRecord(preview.orgId) || linkedToPersonalDecl) {
      await ctx.db.patch(preview._id, { orgId: targetOrgId });
    }
  }

  const documents = await ctx.db
    .query("documents")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  let documentsPatched = 0;
  for (const document of documents) {
    const linkedToPersonalDecl =
      document.declarationId &&
      personalDeclIds.has(document.declarationId as Id<"declarations">);
    if (isPersonalScopedRecord(document.orgId) || linkedToPersonalDecl) {
      await ctx.db.patch(document._id, { orgId: targetOrgId });
      documentsPatched += 1;
    }
  }

  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);
  let notificationsPatched = 0;
  for (const notification of notifications) {
    const linkedToPersonalDecl =
      notification.declarationId &&
      personalDeclIds.has(notification.declarationId as Id<"declarations">);
    if (isPersonalScopedRecord(notification.orgId) || linkedToPersonalDecl) {
      await ctx.db.patch(notification._id, { orgId: targetOrgId });
      notificationsPatched += 1;
    }
  }

  const personalScope = `user:${userId}`;
  const conversations = await ctx.db.query("conversations").take(5000);
  let conversationsPatched = 0;
  for (const conversation of conversations) {
    if (conversation.createdBy !== userId) continue;
    if (conversation.organizationId === personalScope) {
      await ctx.db.patch(conversation._id, { organizationId: targetOrgId });
      conversationsPatched += 1;
    } else if (conversation.organizationId === `org:${targetOrgId}`) {
      await ctx.db.patch(conversation._id, { organizationId: targetOrgId });
      conversationsPatched += 1;
    }
  }

  const dbUser = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q: any) => q.eq("clerkId", userId))
    .unique();
  if (dbUser) {
    await ctx.db.patch(dbUser._id, {
      orgId: targetOrgId,
      personalMigratedAt: Date.now(),
      legacyClaimedForOrgId: undefined,
    });
  }

  await ctx.runMutation(internal.declarations.rebuildReadModelsForDebug, { userId });

  return {
    orgId: targetOrgId,
    migratedAt: Date.now(),
    declarations: personalDeclarations.length,
    declarationPreviews: previews.filter(
      (row: { orgId?: unknown; declarationId?: Id<"declarations"> }) =>
        isPersonalScopedRecord(row.orgId) ||
        (row.declarationId && personalDeclIds.has(row.declarationId)),
    ).length,
    documents: documentsPatched,
    notifications: notificationsPatched,
    conversations: conversationsPatched,
  };
}

/** Preview personal-scoped rows before migrating into the active org. */
export const previewPersonalMigration = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const activeOrgId = await getActiveOrgId(ctx, identity.subject);
    const pending = await countPersonalDataForUser(ctx, identity.subject);

    return {
      activeOrgId,
      pending,
      totalPending: Object.values(pending).reduce((sum, n) => sum + n, 0),
      alreadyMigrated: Boolean(
        (await ctx.db
          .query("users")
          .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
          .unique())?.personalMigratedAt,
      ),
    };
  },
});

/** Move personal-scoped declarations/docs/notifications into the Clerk org in session. */
export const migratePersonalToActiveOrg = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticatedError();

    const activeOrgId = await getActiveOrgId(ctx, identity.subject);
    if (!activeOrgId) {
      throw userError("select_an_organisation_in_the_header", "Select an organisation in the header before migrating personal data.");
    }

    const pending = await countPersonalDataForUser(ctx, identity.subject);
    const totalPending = Object.values(pending).reduce((sum, n) => sum + n, 0);
    if (totalPending === 0) {
      const dbUser = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .unique();
      if (dbUser && !dbUser.personalMigratedAt) {
        await ctx.db.patch(dbUser._id, { personalMigratedAt: Date.now(), orgId: activeOrgId });
      }
      return { ...pending, orgId: activeOrgId, migratedAt: Date.now(), totalPending: 0 };
    }

    return await migratePersonalDataForUser(ctx, identity.subject, activeOrgId);
  },
});

/** One-shot CLI / dashboard run — e.g. convex run org_migration:migratePersonalToOrgInternal */
export const migratePersonalToOrgInternal = internalMutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    return await migratePersonalDataForUser(ctx, args.userId, args.orgId);
  },
});
