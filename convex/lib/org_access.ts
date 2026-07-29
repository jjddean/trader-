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

export async function listFinancialObligationsForTenant(ctx: Ctx, userId: string, take = 500) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    return await ctx.db
      .query("financial_obligations")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);
  }

  const rows = await ctx.db
    .query("financial_obligations")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

export async function listDeclarationPreviewsForTenant(ctx: Ctx, userId: string, take = 500) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    const rows = await ctx.db
      .query("declaration_preview")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);
    return rows.sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  const rows = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows
    .filter((row) => isPersonalScopedRecord(row.orgId))
    .sort((a, b) => b.lastUpdated - a.lastUpdated);
}

export async function listDocumentsForTenant(ctx: Ctx, userId: string, take = 500) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    const orgRows = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);

    const userRows = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(take);

    const legacy = userRows.filter((row) => isPersonalScopedRecord(row.orgId));
    const seen = new Set(orgRows.map((row) => row._id));
    const merged = [...orgRows];
    for (const row of legacy) {
      if (!seen.has(row._id)) merged.push(row);
    }

    merged.sort((a, b) => documentSortKey(b) - documentSortKey(a));
    return merged.slice(0, take);
  }

  const rows = await ctx.db
    .query("documents")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

function documentSortKey(doc: { uploadDate?: unknown; _creationTime?: number }): number {
  const raw = doc.uploadDate;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return doc._creationTime ?? 0;
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

export async function canAccessAssessment(
  ctx: Ctx,
  userId: string,
  assessment: { userId?: unknown; orgId?: unknown } | null | undefined,
): Promise<boolean> {
  if (!assessment) return false;
  if (String(assessment.userId ?? "") === userId) return true;

  const activeOrgId = await getActiveOrgId(ctx, userId);
  const assessmentOrgId = normalizeOrgId(assessment.orgId);
  return Boolean(activeOrgId && assessmentOrgId && activeOrgId === assessmentOrgId);
}

export async function assertAssessmentAccess(
  ctx: Ctx,
  userId: string,
  assessment: { userId?: unknown; orgId?: unknown } | null | undefined,
): Promise<void> {
  if (!(await canAccessAssessment(ctx, userId, assessment))) {
    throw new Error("Unauthorized");
  }
}

export async function listAssessmentsForTenant(ctx: Ctx, userId: string, take = 200) {
  const activeOrgId = await getActiveOrgId(ctx, userId);
  if (activeOrgId) {
    return await ctx.db
      .query("export_assessments")
      .withIndex("by_org", (q) => q.eq("orgId", activeOrgId))
      .order("desc")
      .take(take);
  }

  const rows = await ctx.db
    .query("export_assessments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(take);

  return rows.filter((row) => isPersonalScopedRecord(row.orgId));
}

