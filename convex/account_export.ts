import { query } from "./_generated/server";
import {
  getTenantContext,
  listDeclarationsForTenant,
  listDeclarationPreviewsForTenant,
  listDocumentsForTenant,
  listNotificationsForTenant,
} from "./lib/org_access";

const MAX_DECLARATIONS = 500;
const MAX_NOTIFICATIONS = 500;
const MAX_DOCUMENTS = 500;
const MAX_AUDIT = 500;
const MAX_ITEMS_PER_DECL = 100;
const MAX_OCR_CHARS = 50_000;

function truncateOcr(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (value.length <= MAX_OCR_CHARS) return value;
  return `${value.slice(0, MAX_OCR_CHARS)}…[truncated]`;
}

export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const userId = identity.subject;
    const tenant = await getTenantContext(ctx, userId);
    const exportedAt = new Date().toISOString();

    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", userId))
      .unique();

    const hmrcRow = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let orgHmrcMode: string | null = null;
    if (tenant.activeOrgId) {
      const orgSettings = await ctx.db
        .query("org_hmrc_settings")
        .withIndex("by_org", (q) => q.eq("orgId", tenant.activeOrgId!))
        .unique();
      orgHmrcMode = orgSettings?.hmrcMode ?? "practice";
    }

    const declarations = await listDeclarationsForTenant(ctx, userId, MAX_DECLARATIONS);
    const declarationPreviews = await listDeclarationPreviewsForTenant(ctx, userId, MAX_DECLARATIONS);
    const documents = await listDocumentsForTenant(ctx, userId, MAX_DOCUMENTS);
    const notifications = await listNotificationsForTenant(ctx, userId, MAX_NOTIFICATIONS);

    const goodsItems: Record<string, unknown>[] = [];
    for (const decl of declarations) {
      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .take(MAX_ITEMS_PER_DECL);
      for (const item of items) {
        goodsItems.push({ ...item, declarationId: decl._id });
      }
    }

    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_AUDIT);

    return {
      export: {
        version: "1.0",
        exportedAt,
        scope: tenant.activeOrgId
          ? { mode: "organisation" as const, orgId: tenant.activeOrgId }
          : { mode: "personal" as const },
        limits: {
          declarations: MAX_DECLARATIONS,
          notifications: MAX_NOTIFICATIONS,
          documents: MAX_DOCUMENTS,
          auditLogs: MAX_AUDIT,
          goodsItemsPerDeclaration: MAX_ITEMS_PER_DECL,
        },
        note:
          "OAuth tokens are not included. Notification raw XML is omitted; structured fields are included. Switch organisation in the header before export to download a different workspace.",
      },
      account: {
        clerkId: userId,
        email: dbUser?.email ?? identity.email ?? null,
        name: dbUser?.name ?? identity.name ?? null,
        role: dbUser?.role ?? null,
        tenantMode: tenant.mode,
        activeOrgId: tenant.activeOrgId,
        personalMigratedAt: dbUser?.personalMigratedAt ?? null,
      },
      hmrcConnection: hmrcRow
        ? {
            connected: true,
            eori: hmrcRow.eori ?? null,
            expiresAt: hmrcRow.expiresAt ?? null,
          }
        : { connected: false },
      orgHmrcMode,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      counts: {
        declarations: declarations.length,
        goodsItems: goodsItems.length,
        documents: documents.length,
        notifications: notifications.length,
        auditLogs: auditLogs.length,
        declarationPreviews: declarationPreviews.length,
      },
      declarations,
      declarationPreviews,
      goodsItems,
      documents: documents.map((doc) => ({
        ...doc,
        ocrText: truncateOcr(doc.ocrText),
      })),
      notifications: notifications.map((row) => {
        const { rawPayload: _raw, ...rest } = row;
        return {
          ...rest,
          rawPayloadIncluded: Boolean(_raw),
        };
      }),
      auditLogs,
    };
  },
});
