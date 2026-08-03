import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";
import { FINANCIAL_LABELS as FL } from "./lib/financial_labels";
import { orgIdFromDeclaration } from "./lib/org_access";
import {
  hmrcStatusForDeclaration,
  loadDeclarationFinancialEstimate,
} from "./declarations";
import { resolveSubmissionRoute } from "./lib/export_routing";

type Ctx = QueryCtx | MutationCtx;

const PORTAL_UPLOAD_CATEGORIES = new Set([
  "invoice",
  "packing_list",
  "certificate",
  "invoices",
  "packing lists",
  "certificates",
  "portal_upload",
]);

function isPortalVisibleDocument(
  doc: Doc<"documents">,
  portalClerkId: string | undefined,
): boolean {
  // Client's own uploads are always visible.
  if (portalClerkId && String(doc.userId ?? "") === portalClerkId) return true;
  const fileType = String(doc.fileType ?? "")
    .trim()
    .toLowerCase();
  return Boolean(fileType && PORTAL_UPLOAD_CATEGORIES.has(fileType));
}

function normalizeEmail(value: string | null | undefined): string | undefined {
  const trimmed = String(value ?? "")
    .trim()
    .toLowerCase();
  return trimmed || undefined;
}

/** JWT email first; fall back to users row (UserSync) — Clerk session tokens often omit email. */
async function resolveSignedInEmail(
  ctx: Ctx,
  identity: { subject: string; email?: string | null },
): Promise<string | undefined> {
  const fromJwt = normalizeEmail(typeof identity.email === "string" ? identity.email : undefined);
  if (fromJwt) return fromJwt;

  const dbUser = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return normalizeEmail(typeof dbUser?.email === "string" ? dbUser.email : undefined);
}

/**
 * Resolve the portal client for the signed-in Clerk user.
 * Auth is by clients.portalClerkId / portalEmail — never by broker org.
 * Does not write (queries cannot patch); call ensurePortalClerkBinding to bind clerkId.
 */
export async function resolvePortalClient(ctx: Ctx): Promise<Doc<"clients"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const byClerk = await ctx.db
    .query("clients")
    .withIndex("by_portal_clerk", (q) => q.eq("portalClerkId", identity.subject))
    .first();
  if (byClerk && byClerk.status === "active" && byClerk.portalEmail) {
    return byClerk;
  }

  const email = await resolveSignedInEmail(ctx, identity);
  if (!email) return null;

  const byEmail = await ctx.db
    .query("clients")
    .withIndex("by_portal_email", (q) => q.eq("portalEmail", email))
    .first();
  if (!byEmail || byEmail.status !== "active" || !byEmail.portalEmail) return null;

  // If already bound to a different Clerk user, deny.
  if (byEmail.portalClerkId && byEmail.portalClerkId !== identity.subject) {
    return null;
  }

  return byEmail;
}

async function requireOwnedDeclaration(
  ctx: Ctx,
  portalClient: Doc<"clients">,
  declarationId: Id<"declarations">,
): Promise<Doc<"declarations"> | null> {
  const declaration = await ctx.db.get(declarationId);
  if (!declaration) return null;
  if (declaration.clientId !== portalClient._id) return null;
  return declaration;
}

async function requireOwnedAssessment(
  ctx: Ctx,
  portalClient: Doc<"clients">,
  assessmentId: Id<"export_assessments">,
): Promise<Doc<"export_assessments"> | null> {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) return null;
  if (!(await portalCanSeeAssessment(ctx, portalClient, assessment))) return null;
  return assessment;
}

function portalDeclarationSummary(
  decl: Doc<"declarations">,
  statusLabel: string,
) {
  return {
    _id: decl._id,
    mrn: decl.mrn ? String(decl.mrn) : null,
    status: statusLabel,
    rawStatus: decl.status != null ? String(decl.status) : null,
    declarationType: decl.declarationType != null ? String(decl.declarationType) : null,
    lastUpdated: decl.lastUpdated ?? null,
    createdAt: decl._creationTime,
  };
}

/** Bind portalClerkId on first successful email match (mutation — queries cannot patch). */
export const ensurePortalClerkBinding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const email = await resolveSignedInEmail(ctx, identity);
    if (!email) return { ok: false as const, reason: "no_email" };

    const existing = await ctx.db
      .query("clients")
      .withIndex("by_portal_clerk", (q) => q.eq("portalClerkId", identity.subject))
      .first();
    if (existing?.portalEmail) {
      return { ok: true as const, clientId: existing._id };
    }

    const byEmail = await ctx.db
      .query("clients")
      .withIndex("by_portal_email", (q) => q.eq("portalEmail", email))
      .first();
    if (!byEmail || byEmail.status !== "active" || !byEmail.portalEmail) {
      return { ok: false as const, reason: "no_portal_access" };
    }
    if (byEmail.portalClerkId && byEmail.portalClerkId !== identity.subject) {
      return { ok: false as const, reason: "bound_to_other_user" };
    }

    if (!byEmail.portalClerkId) {
      await ctx.db.patch(byEmail._id, {
        portalClerkId: identity.subject,
        updatedAt: Date.now(),
      });
    }

    return { ok: true as const, clientId: byEmail._id };
  },
});

export const getMyClientProfile = query({
  args: {},
  handler: async (ctx) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return null;

    // Redact broker-only fields (notes, creator userId).
    return {
      _id: client._id,
      name: client.name,
      eori: client.eori ?? null,
      addressLine: client.addressLine ?? null,
      city: client.city ?? null,
      postcode: client.postcode ?? null,
      country: client.country ?? null,
      contactName: client.contactName ?? null,
      contactEmail: client.contactEmail ?? null,
      contactPhone: client.contactPhone ?? null,
      portalEmail: client.portalEmail ?? null,
    };
  },
});

export const listMyDeclarations = query({
  args: {},
  handler: async (ctx) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(200);

    const summaries = [];
    for (const decl of declarations) {
      if (decl.clientId !== client._id) continue;
      const notifications = await collectDeclarationNotifications(ctx.db, {
        declarationId: decl._id,
        conversationId: decl.conversationId != null ? String(decl.conversationId) : null,
        mrn: decl.mrn != null ? String(decl.mrn) : null,
      });
      const { status } = hmrcStatusForDeclaration(decl, notifications);
      summaries.push(portalDeclarationSummary(decl, status));
    }
    return summaries;
  },
});

/** Home: attention items + recent declarations (no fake KPIs). */
export const getMyDashboard = query({
  args: {},
  handler: async (ctx) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return null;

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(50);

    type AttentionItem = {
      kind: "declaration_action" | "missing_document" | "unread_message";
      title: string;
      subtitle: string;
      href: string;
    };

    const attention: AttentionItem[] = [];
    const recent = [];

    for (const decl of declarations) {
      if (decl.clientId !== client._id) continue;
      const notifications = await collectDeclarationNotifications(ctx.db, {
        declarationId: decl._id,
        conversationId: decl.conversationId != null ? String(decl.conversationId) : null,
        mrn: decl.mrn != null ? String(decl.mrn) : null,
      });
      const { status } = hmrcStatusForDeclaration(decl, notifications);
      const summary = portalDeclarationSummary(decl, status);
      if (recent.length < 5) recent.push(summary);

      const label = summary.mrn || "Declaration";
      const href = `/portal/declarations/${decl._id}`;

      if (status === "Action Required") {
        attention.push({
          kind: "declaration_action",
          title: `${label} needs action`,
          subtitle: status,
          href,
        });
      }

      const requirements = await ctx.db
        .query("document_requirements")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .take(30);
      for (const req of requirements) {
        if (String(req.status) !== "missing") continue;
        attention.push({
          kind: "missing_document",
          title: `${req.name || req.code} missing`,
          subtitle: label,
          href: "/portal/documents",
        });
        if (attention.length >= 20) break;
      }
      if (attention.length >= 20) break;
    }

    const messages = await ctx.db
      .query("portal_messages")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(50);
    const unreadFromBroker = messages.filter(
      (row) =>
        row.clientId === client._id &&
        row.senderRole === "broker" &&
        row.readAt == null,
    );
    if (unreadFromBroker.length > 0) {
      const first = unreadFromBroker[0]!;
      let messagesHref = "/portal/messages";
      if (first.declarationId) {
        messagesHref = `/portal/messages?declarationId=${first.declarationId}`;
      } else if (first.assessmentId) {
        messagesHref = `/portal/messages?assessmentId=${first.assessmentId}`;
      }
      attention.unshift({
        kind: "unread_message",
        title:
          unreadFromBroker.length === 1
            ? "Unread message from your broker"
            : `${unreadFromBroker.length} unread messages from your broker`,
        subtitle: first.body.length > 80 ? `${first.body.slice(0, 80)}…` : first.body,
        href: messagesHref,
      });
    }

    return {
      attention: attention.slice(0, 20),
      recent,
    };
  },
});

export const getMyDeclaration = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return null;

    const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
    if (!declaration) return null;

    const notifications = await collectDeclarationNotifications(ctx.db, {
      declarationId: declaration._id,
      conversationId:
        declaration.conversationId != null ? String(declaration.conversationId) : null,
      mrn: declaration.mrn != null ? String(declaration.mrn) : null,
    });
    const { status } = hmrcStatusForDeclaration(declaration, notifications);

    return {
      ...portalDeclarationSummary(declaration, status),
      transportMode: declaration.transportMode != null ? String(declaration.transportMode) : null,
      invoiceCurrency:
        declaration.invoiceCurrency != null ? String(declaration.invoiceCurrency) : null,
      invoiceTotal:
        declaration.invoiceTotal != null ? Number(declaration.invoiceTotal) : null,
      originCountry:
        declaration.originCountry != null ? String(declaration.originCountry) : null,
      dispatchCountry:
        declaration.dispatchCountry != null ? String(declaration.dispatchCountry) : null,
      representationType:
        declaration.representationType != null ? String(declaration.representationType) : "self",
      importerName: client.name,
      importerCountry: client.country != null ? String(client.country) : null,
      representativeName:
        declaration.representativeName != null ? String(declaration.representativeName) : null,
      representativeEori:
        declaration.representativeEori != null ? String(declaration.representativeEori) : null,
    };
  },
});

/** Cross-declaration document library for the portal Documents page. */
export const listMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(50);

    const out: Array<{
      _id: Id<"documents">;
      declarationId: Id<"declarations">;
      mrn: string | null;
      fileName: string;
      fileType: string | null;
      uploadDate: string | null;
      hasFile: boolean;
    }> = [];
    const seen = new Set<string>();

    for (const decl of declarations) {
      if (decl.clientId !== client._id) continue;
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .take(40);
      for (const doc of docs) {
        if (seen.has(doc._id)) continue;
        if (!isPortalVisibleDocument(doc, client.portalClerkId)) continue;
        seen.add(doc._id);
        const fileId = doc.fileId != null ? String(doc.fileId).trim() : "";
        out.push({
          _id: doc._id,
          declarationId: decl._id,
          mrn: decl.mrn ? String(decl.mrn) : null,
          fileName: doc.fileName != null ? String(doc.fileName) : "Document",
          fileType: doc.fileType != null ? String(doc.fileType) : null,
          uploadDate: doc.uploadDate != null ? String(doc.uploadDate) : null,
          hasFile: fileId.length > 0,
        });
        if (out.length >= 200) return out;
      }
    }
    return out;
  },
});

/** Duty/VAT rows for portal Charges page (estimate vs HMRC confirmed). */
export const listMyCharges = query({
  args: {},
  handler: async (ctx) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(40);

    const rows = [];
    for (const decl of declarations) {
      if (decl.clientId !== client._id) continue;
      const buildAsUserId = String(decl.userId ?? "");
      const payload = await loadDeclarationFinancialEstimate(
        ctx,
        decl,
        decl._id,
        buildAsUserId,
      );
      if (!payload) continue;
      if (payload.dutyAmount == null && payload.vatAmount == null) continue;
      rows.push({
        declarationId: decl._id,
        mrn: decl.mrn ? String(decl.mrn) : null,
        dutyAmount: payload.dutyAmount ?? null,
        vatAmount: payload.vatAmount ?? null,
        source:
          payload.financialSource === "hmrc_confirmed"
            ? ("hmrc_confirmed" as const)
            : ("estimate" as const),
      });
    }
    return rows;
  },
});

async function portalCanSeeAssessment(
  ctx: Ctx,
  client: Doc<"clients">,
  assessment: Doc<"export_assessments">,
): Promise<boolean> {
  if (assessment.clientId === client._id) return true;
  if (!assessment.declarationId) return false;
  const declaration = await ctx.db.get(assessment.declarationId);
  return Boolean(declaration && declaration.clientId === client._id);
}

/** Portal export-controls list. */
export const listMyComplianceAssessments = query({
  args: {},
  handler: async (ctx) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    const byClient = await ctx.db
      .query("export_assessments")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(100);

    const seen = new Set(byClient.map((a) => a._id));
    const merged = [...byClient];

    // Legacy: assessments linked only via declaration.clientId.
    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(40);
    for (const decl of declarations) {
      if (decl.clientId !== client._id) continue;
      const linked = await ctx.db
        .query("export_assessments")
        .withIndex("by_declaration", (q) => q.eq("declarationId", decl._id))
        .take(10);
      for (const row of linked) {
        if (seen.has(row._id)) continue;
        seen.add(row._id);
        merged.push(row);
      }
    }

    merged.sort((a, b) => b.updatedAt - a.updatedAt);

    return merged.slice(0, 100).map((a) => ({
      _id: a._id,
      reference: a.reference,
      status: a.status,
      destinationCountry: a.destinationCountry ?? null,
      detail: a.destinationCountry
        ? `Destination ${a.destinationCountry}`
        : a.submissionRoute
          ? `Route ${a.submissionRoute.toUpperCase()}`
          : "Export assessment",
      updatedAt: a.updatedAt,
    }));
  },
});

/** Portal export-controls detail + EUSU / GOV.UK links. */
export const getMyComplianceAssessment = query({
  args: { assessmentId: v.id("export_assessments") },
  handler: async (ctx, args) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return null;

    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) return null;
    if (!(await portalCanSeeAssessment(ctx, client, assessment))) return null;

    const runs = await ctx.db
      .query("export_classification_runs")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .take(50);
    const controlEntries = runs
      .map((r) => (r.finalControlEntry != null ? String(r.finalControlEntry) : ""))
      .filter((e) => e.length > 0);
    const controlEntry = controlEntries[0] ?? null;

    const screenings = await ctx.db
      .query("sanctions_screenings")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .take(50);
    const confirmedHits = screenings.filter((s) => s.reviewStatus === "confirmed").length;
    const pendingHits = screenings.filter(
      (s) => s.reviewStatus === "pending" && (s.score ?? 0) >= 0.65,
    ).length;
    let screeningSummary = "No screening recorded";
    if (screenings.length > 0) {
      if (confirmedHits > 0) screeningSummary = `${confirmedHits} confirmed hit(s)`;
      else if (pendingHits > 0) screeningSummary = `${pendingHits} pending review`;
      else screeningSummary = "Screened — no confirmed hits";
    }

    const licences = await ctx.db
      .query("export_licences")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .take(10);
    const latestLicence = licences.sort((a, b) => b.recordedAt - a.recordedAt)[0];
    const licenceRef =
      latestLicence?.licenceRef ?? latestLicence?.applicationRef ?? null;

    const tokens = await ctx.db
      .query("export_end_user_tokens")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .take(20);
    const now = Date.now();
    const openEusu = tokens.find(
      (t) => !t.revoked && t.completedAt == null && t.expiresAt > now,
    );
    const eusuPath = openEusu ? `/r/end-user/${openEusu.token}` : null;

    const routing = resolveSubmissionRoute({
      originJurisdiction: assessment.originJurisdiction,
      destinationCountry: assessment.destinationCountry,
      approvedControlEntries: controlEntries,
      licenceType: latestLicence?.licenceType,
    });
    const govUkApplyUrl = routing.route === "none" ? null : routing.govUkUrl;

    return {
      _id: assessment._id,
      reference: assessment.reference,
      status: assessment.status,
      destinationCountry: assessment.destinationCountry ?? null,
      controlEntry,
      screeningSummary,
      licenceRef,
      eusuPath,
      govUkApplyUrl,
      govUkHeadline: routing.headline,
      submissionRoute: assessment.submissionRoute ?? routing.route,
      eusuCompleted: Boolean(assessment.endUserStatement),
    };
  },
});

export const getMyDeclarationDocuments = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
    if (!declaration) return [];

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .take(200);

    return docs
      .filter((doc) => isPortalVisibleDocument(doc, client.portalClerkId))
      .map((doc) => ({
        _id: doc._id,
        fileName: doc.fileName != null ? String(doc.fileName) : "Document",
        fileType: doc.fileType != null ? String(doc.fileType) : null,
        fileSize: doc.fileSize ?? null,
        uploadDate: doc.uploadDate ?? null,
        status: doc.status != null ? String(doc.status) : null,
        hasFile: Boolean(doc.fileId),
      }));
  },
});

export const getMyDeclarationFinancials = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return null;

    const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
    if (!declaration) return null;

    // Rebuild under the filing broker's userId (declaration owner), not the portal client.
    const buildAsUserId = String(declaration.userId ?? "");
    const payload = await loadDeclarationFinancialEstimate(
      ctx,
      declaration,
      args.declarationId,
      buildAsUserId,
    );
    if (!payload) return null;

    const isConfirmed = payload.financialSource === "hmrc_confirmed";
    // Strict DTO — no deferment account, payment method, or raw estimate internals.
    return {
      declarationId: payload.declarationId,
      dutyAmount: payload.dutyAmount,
      vatAmount: payload.vatAmount,
      customsValue: payload.customsValue,
      financialSource: payload.financialSource,
      estimateIncomplete: payload.estimateIncomplete ?? false,
      provenanceLabel: isConfirmed ? FL.confirmedProvenance : FL.estimatedProvenance,
      badgeLabel: isConfirmed ? FL.confirmedProvenance : FL.estimateOnlyBadge,
      isHmrcConfirmed: isConfirmed,
      updatedAt: payload.updatedAt ?? null,
    };
  },
});

export const getMyDeclarationStatusTimeline = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
    if (!declaration) return [];

    const notifications = await collectDeclarationNotifications(ctx.db, {
      declarationId: declaration._id,
      conversationId:
        declaration.conversationId != null ? String(declaration.conversationId) : null,
      mrn: declaration.mrn != null ? String(declaration.mrn) : null,
    });

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
      .order("desc")
      .take(50);

    type TimelineEvent = {
      kind: "notification" | "submission";
      at: number;
      label: string;
      detail?: string | null;
    };

    const events: TimelineEvent[] = [];

    for (const n of notifications) {
      const at = (() => {
        const issue = new Date(String(n.issueDateTime ?? "")).getTime();
        if (Number.isFinite(issue)) return issue;
        const ts = new Date(String(n.timestamp ?? 0)).getTime();
        return Number.isFinite(ts) ? ts : 0;
      })();
      events.push({
        kind: "notification",
        at,
        label: String(n.notificationType || "Notification"),
        detail: null,
      });
    }

    for (const s of submissions) {
      // Redact requestXml / snapshots — never send to portal.
      events.push({
        kind: "submission",
        at: s.createdAt,
        label: `${s.operation}${s.outcome ? ` · ${s.outcome}` : ""}`,
        detail: s.lrn ? `LRN ${s.lrn}` : null,
      });
    }

    events.sort((a, b) => b.at - a.at);
    return events.slice(0, 100);
  },
});

export const getMyMessages = query({
  args: {
    declarationId: v.optional(v.id("declarations")),
    assessmentId: v.optional(v.id("export_assessments")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const client = await resolvePortalClient(ctx);
    if (!client) return [];

    if (args.declarationId && args.assessmentId) return [];

    if (args.declarationId) {
      const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
      if (!declaration) return [];
    }
    if (args.assessmentId) {
      const assessment = await requireOwnedAssessment(ctx, client, args.assessmentId);
      if (!assessment) return [];
    }

    const rows = await ctx.db
      .query("portal_messages")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(Math.min(args.limit ?? 100, 200));

    return rows
      .filter((row) => {
        if (row.clientId !== client._id) return false;
        if (args.declarationId) return row.declarationId === args.declarationId;
        if (args.assessmentId) return row.assessmentId === args.assessmentId;
        return !row.declarationId && !row.assessmentId;
      })
      .map((row) => ({
        _id: row._id,
        declarationId: row.declarationId ?? null,
        assessmentId: row.assessmentId ?? null,
        senderRole: row.senderRole,
        body: row.body,
        createdAt: row.createdAt,
        readAt: row.readAt ?? null,
      }));
  },
});

export const sendMyMessage = mutation({
  args: {
    body: v.string(),
    declarationId: v.optional(v.id("declarations")),
    assessmentId: v.optional(v.id("export_assessments")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await resolvePortalClient(ctx);
    if (!client) throw new Error("No portal access");

    const body = args.body.trim();
    if (body.length < 1) throw new Error("Message is empty");
    if (body.length > 4000) throw new Error("Message is too long");

    const hasDeclaration = Boolean(args.declarationId);
    const hasAssessment = Boolean(args.assessmentId);
    if (hasDeclaration && hasAssessment) {
      throw new Error("Choose either a declaration or an export case");
    }

    let orgId = client.orgId;
    if (args.declarationId) {
      const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
      if (!declaration) throw new Error("Declaration not found");
      orgId = orgIdFromDeclaration(declaration) ?? orgId;
    }
    if (args.assessmentId) {
      const assessment = await requireOwnedAssessment(ctx, client, args.assessmentId);
      if (!assessment) throw new Error("Export case not found");
      orgId = assessment.orgId ?? orgId;
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("portal_messages", {
      declarationId: args.declarationId,
      assessmentId: args.assessmentId,
      clientId: client._id,
      orgId,
      senderRole: "client",
      senderId: identity.subject,
      body,
      createdAt: now,
    });

    return { messageId };
  },
});

export const getMyDocumentDownloadUrl = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await resolvePortalClient(ctx);
    if (!client) throw new Error("No portal access");

    const document = await ctx.db.get(args.documentId);
    if (!document?.declarationId) throw new Error("Document not found");

    const declarationId = ctx.db.normalizeId("declarations", String(document.declarationId));
    if (!declarationId) throw new Error("Document not found");

    const declaration = await requireOwnedDeclaration(ctx, client, declarationId);
    if (!declaration) throw new Error("Unauthorized");

    if (!isPortalVisibleDocument(document, client.portalClerkId)) {
      throw new Error("Unauthorized");
    }

    if (!document.fileId) throw new Error("No file is attached to this document");
    return await ctx.storage.getUrl(document.fileId);
  },
});

export const generateMyUploadUrl = mutation({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const client = await resolvePortalClient(ctx);
    if (!client) throw new Error("No portal access");
    const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
    if (!declaration) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveMyDocument = mutation({
  args: {
    storageId: v.id("_storage"),
    declarationId: v.id("declarations"),
    fileName: v.string(),
    fileType: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const client = await resolvePortalClient(ctx);
    if (!client) throw new Error("No portal access");

    const declaration = await requireOwnedDeclaration(ctx, client, args.declarationId);
    if (!declaration) throw new Error("Unauthorized");

    const category = String(args.category ?? args.fileType ?? "")
      .trim()
      .toLowerCase();
    if (category && !PORTAL_UPLOAD_CATEGORIES.has(category)) {
      throw new Error("Only invoices, packing lists, and certificates can be uploaded");
    }

    const fileName = args.fileName.trim();
    if (!fileName) throw new Error("File name is required");

    const orgId = orgIdFromDeclaration(declaration) ?? client.orgId;
    const documentId = await ctx.db.insert("documents", {
      fileId: args.storageId,
      userId: identity.subject,
      ...(orgId ? { orgId } : {}),
      fileName,
      declarationId: args.declarationId,
      mrn: declaration.mrn != null ? String(declaration.mrn) : undefined,
      status: "pending_review",
      auditStatus: "pending",
      fileType: args.fileType ?? args.category ?? "portal_upload",
      uploadDate: new Date().toISOString(),
    });

    await ctx.db.insert("auditLogs", {
      userId: identity.subject,
      action: "portal_document_uploaded",
      details: {
        documentId,
        declarationId: args.declarationId,
        clientId: client._id,
        fileName,
      },
      timestamp: Date.now(),
      archived: false,
    });

    return { documentId };
  },
});
