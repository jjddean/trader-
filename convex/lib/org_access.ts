import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;
type Identity = NonNullable<Awaited<ReturnType<Ctx["auth"]["getUserIdentity"]>>>;

function readOrgIdFromIdentity(identity: Identity | null): string {
  if (!identity) return "";
  const record = identity as Record<string, unknown>;
  return normalizeOrgId(record.org_id ?? record.orgId);
}

export async function getActiveOrgId(ctx: Ctx, _userId: string): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  const jwtOrgId = readOrgIdFromIdentity(identity);
  return jwtOrgId || null;
}

function normalizeOrgId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isPersonalScopedRecord(orgId: unknown): boolean {
  return normalizeOrgId(orgId) === "";
}

export async function canAccessDeclaration(
  ctx: Ctx,
  userId: string,
  declaration: { userId?: unknown; orgId?: unknown } | null | undefined,
): Promise<boolean> {
  if (!declaration) return false;
  if (String(declaration.userId ?? "") === userId) return true;

  const activeOrgId = await getActiveOrgId(ctx, userId);
  const declOrgId = normalizeOrgId(declaration.orgId);
  return Boolean(activeOrgId && declOrgId && activeOrgId === declOrgId);
}

export async function assertDeclarationAccess(
  ctx: Ctx,
  userId: string,
  declaration: { userId?: unknown; orgId?: unknown } | null | undefined,
): Promise<void> {
  if (!(await canAccessDeclaration(ctx, userId, declaration))) {
    throw new Error("Unauthorized");
  }
}

export async function resolveOrgIdForNewRecord(ctx: Ctx, userId: string): Promise<string | undefined> {
  return (await getActiveOrgId(ctx, userId)) ?? undefined;
}

export async function listDeclarationsForTenant(ctx: Ctx, userId: string, take = 200) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    return await ctx.db
      .query("declarations")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);
  }

  const rows = await ctx.db
    .query("declarations")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

export async function listDeclarationPreviewsForTenant(ctx: Ctx, userId: string, take = 500) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    return await ctx.db
      .query("declaration_preview")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .take(take);
  }

  const rows = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

export async function listDocumentsForTenant(ctx: Ctx, userId: string, take = 500) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    return await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);
  }

  const rows = await ctx.db
    .query("documents")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

export async function listNotificationsForTenant(ctx: Ctx, userId: string, take = 50) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    return await ctx.db
      .query("notifications")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);
  }

  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

export async function canAccessDocument(
  ctx: Ctx,
  userId: string,
  document: { userId?: unknown; orgId?: unknown; declarationId?: unknown } | null | undefined,
): Promise<boolean> {
  if (!document) return false;
  if (String(document.userId ?? "") === userId) return true;

  const activeOrgId = await getActiveOrgId(ctx, userId);
  const docOrgId = normalizeOrgId(document.orgId);
  if (activeOrgId && docOrgId && activeOrgId === docOrgId) return true;

  if (document.declarationId) {
    const declaration = await ctx.db.get(document.declarationId as Id<"declarations">);
    return canAccessDeclaration(ctx, userId, declaration);
  }

  return false;
}

export function orgIdFromDeclaration(declaration: Doc<"declarations"> | null | undefined) {
  const orgId = normalizeOrgId(declaration?.orgId);
  return orgId || undefined;
}

/** Shared assistant / org chat scope — raw Clerk org id, or personal `user:{clerkId}`. */
export async function resolveConversationScopeId(
  ctx: Ctx,
  userId: string,
  declaration?: { orgId?: unknown } | null,
): Promise<string> {
  const declOrg = normalizeOrgId(declaration?.orgId);
  if (declOrg) return declOrg;

  const sessionOrg = await getActiveOrgId(ctx, userId);
  if (sessionOrg) return sessionOrg;

  return `user:${userId}`;
}

export function conversationScopeMatches(storedScope: unknown, activeScope: string): boolean {
  const stored = typeof storedScope === "string" ? storedScope.trim() : "";
  if (!stored || !activeScope) return false;
  if (stored === activeScope) return true;
  // Legacy rows stored `org:{clerkOrgId}` before aligning with Clerk org ids.
  if (stored === `org:${activeScope}`) return true;
  return false;
}

export function conversationScopeCandidates(activeScope: string): string[] {
  const candidates = new Set<string>([activeScope]);
  if (!activeScope.startsWith("user:")) {
    candidates.add(`org:${activeScope}`);
  }
  return [...candidates];
}

export async function findGeneralConversationForScope(ctx: Ctx, userId: string) {
  const scopeId = await resolveConversationScopeId(ctx, userId);

  for (const candidate of conversationScopeCandidates(scopeId)) {
    const recent = await ctx.db
      .query("conversations")
      .withIndex("by_organization", (q) => q.eq("organizationId", candidate))
      .order("desc")
      .take(40);

    const general = recent.find((conversation) => !conversation.declarationId);
    if (general) return general;
  }

  return null;
}

export async function getTenantContext(ctx: Ctx, userId: string) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  return {
    userId,
    activeOrgId,
    mode: activeOrgId ? ("org" as const) : ("personal" as const),
  };
}

export async function requireSameOrg(
  ctx: Ctx,
  userId: string,
  recordOrgId: unknown,
): Promise<boolean> {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (!activeOrgId) return isPersonalScopedRecord(recordOrgId);
  return normalizeOrgId(recordOrgId) === activeOrgId;
}

export async function canAccessDeclarationById(ctx: Ctx, userId: string, declarationId: Id<"declarations">) {
  const declaration = await ctx.db.get(declarationId);
  if (!declaration) return { allowed: false as const, declaration: null };
  const allowed = await canAccessDeclaration(ctx, userId, declaration);
  return { allowed, declaration: allowed ? declaration : null };
}

