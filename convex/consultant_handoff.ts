/**
 * One-time launch codes for the consultant handoff.
 *
 * A consultant partner holds only case metadata. When their consultant clicks
 * "Open review", their server asks us for a launch URL, we hand back a code
 * good for one use and a couple of minutes, and their browser follows it here.
 * Redeeming it mints a short-lived review token carrying the consultant
 * identity the partner proved, so the completion lands with a verified
 * reviewer instead of an address somebody typed.
 *
 * Codes are never stored in the clear — the API route hashes before calling in,
 * so a database reader cannot replay one inside its window.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertConsultantPartnerSecret } from "./lib/secret_compare";
import { userError } from "./lib/user_errors";
import { CONSULTANT_DISPATCH_REASON, dispatchIsOpen } from "./compliance_consultant";
import { enqueuePartnerCaseStatus } from "./lib/consultant_partner_outbox";

/** How long a minted review token lasts. Long enough to do the review once. */
const REVIEW_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const PARTNER_REQUEST_MAX_AGE_MS = 5 * 60 * 1000;
const PARTNER_REQUEST_MAX_FUTURE_SKEW_MS = 60 * 1000;
const PARTNER_REQUEST_RATE_WINDOW_MS = 60 * 1000;
const PARTNER_REQUEST_RATE_LIMIT = 120;

/** Atomically claim one signed request id so it cannot be replayed. */
export const claimPartnerRequest = mutation({
  args: {
    partnerSecret: v.string(),
    partnerSlug: v.string(),
    requestId: v.string(),
    digest: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    assertConsultantPartnerSecret(args.partnerSecret);

    const partnerSlug = args.partnerSlug.trim().toLowerCase();
    const requestId = args.requestId.trim();
    const digest = args.digest.trim();
    if (!partnerSlug || partnerSlug.length > 64 || !requestId || requestId.length > 200) {
      throw userError("invalid_partner_request", "Invalid partner request");
    }
    if (!/^[0-9a-f]{64}$/.test(digest) || !Number.isSafeInteger(args.timestamp)) {
      throw userError("invalid_partner_request", "Invalid partner request");
    }

    const now = Date.now();
    if (
      args.timestamp < now - PARTNER_REQUEST_MAX_AGE_MS ||
      args.timestamp > now + PARTNER_REQUEST_MAX_FUTURE_SKEW_MS
    ) {
      throw userError("partner_request_timestamp_invalid", "Partner request timestamp invalid");
    }

    const existing = await ctx.db
      .query("consultant_partner_requests")
      .withIndex("by_partner_request", (q) =>
        q.eq("partnerSlug", partnerSlug).eq("requestId", requestId),
      )
      .unique();
    if (existing) {
      if (existing.digest !== digest) {
        throw userError("partner_request_id_conflict", "Partner request ID conflict");
      }
      throw userError("partner_request_replayed", "Partner request already used");
    }

    const recent = await ctx.db
      .query("consultant_partner_requests")
      .withIndex("by_partner_received_at", (q) =>
        q.eq("partnerSlug", partnerSlug).gte("receivedAt", now - PARTNER_REQUEST_RATE_WINDOW_MS),
      )
      .take(PARTNER_REQUEST_RATE_LIMIT);
    if (recent.length >= PARTNER_REQUEST_RATE_LIMIT) {
      throw userError("partner_request_rate_limited", "Partner request rate limit exceeded");
    }

    await ctx.db.insert("consultant_partner_requests", {
      partnerSlug,
      requestId,
      digest,
      requestTimestamp: args.timestamp,
      receivedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      userId: `partner:${partnerSlug}`,
      action: "consultant_partner_request_accepted",
      details: { partnerSlug, requestId, digest, requestTimestamp: args.timestamp },
      timestamp: now,
      archived: false,
    });
    return { accepted: true as const, receivedAt: now };
  },
});

/**
 * Issue a launch code for a case.
 *
 * Refuses anything not currently open — completed, revoked, expired, or
 * belonging to a different partner than the one asking.
 */
export const issueHandoff = mutation({
  args: {
    partnerSecret: v.string(),
    partnerSlug: v.string(),
    expertRequestId: v.id("expert_requests"),
    codeHash: v.string(),
    expiresAt: v.number(),
    consultantExternalId: v.string(),
    consultantEmail: v.optional(v.string()),
    consultantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertConsultantPartnerSecret(args.partnerSecret);

    const partnerSlug = args.partnerSlug.trim().toLowerCase();
    if (
      !partnerSlug ||
      partnerSlug.length > 64 ||
      !/^[a-z0-9][a-z0-9_-]*$/.test(partnerSlug)
    ) {
      throw userError("review_not_found", "Review request not found");
    }

    const request = await ctx.db.get(args.expertRequestId);
    if (!request || request.reasonCode !== CONSULTANT_DISPATCH_REASON) {
      throw userError("review_not_found", "Review request not found");
    }
    // A partner may only launch cases we sent to that partner.
    if (!request.externalSystem || request.externalSystem !== partnerSlug) {
      throw userError("review_not_found", "Review request not found");
    }
    if (!dispatchIsOpen(request, Date.now())) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }

    const consultantExternalId = args.consultantExternalId.trim();
    if (!consultantExternalId || consultantExternalId.length > 128) {
      throw userError("reviewer_required", "A verified reviewer is required");
    }
    const consultantEmail = args.consultantEmail?.trim() || undefined;
    const consultantName = args.consultantName?.trim() || undefined;
    if (consultantEmail && consultantEmail.length > 254) {
      throw userError("invalid_reviewer", "Invalid reviewer");
    }
    if (consultantName && consultantName.length > 160) {
      throw userError("invalid_reviewer", "Invalid reviewer");
    }

    const now = Date.now();
    const codeHash = args.codeHash.trim().toLowerCase();
    if (
      !/^[0-9a-f]{64}$/.test(codeHash) ||
      !Number.isSafeInteger(args.expiresAt) ||
      args.expiresAt <= now ||
      args.expiresAt > now + 5 * 60 * 1000
    ) {
      throw userError("invalid_handoff", "Invalid handoff");
    }
    const duplicateCode = await ctx.db
      .query("consultant_handoffs")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (duplicateCode) throw userError("invalid_handoff", "Invalid handoff");
    if (
      request.assignedConsultantExternalId &&
      request.assignedConsultantExternalId !== consultantExternalId
    ) {
      throw userError("review_assigned_to_another_consultant", "Review is assigned to another consultant");
    }

    const assignedEmail = request.assignedConsultantEmail ?? consultantEmail;
    const assignedName = request.assignedConsultantName ?? consultantName;
    if (!request.assignedConsultantExternalId) {
      await ctx.db.patch(request._id, {
        assignedConsultantExternalId: consultantExternalId,
        assignedConsultantEmail: assignedEmail,
        assignedConsultantName: assignedName,
        assignedConsultantAt: now,
        updatedAt: now,
      });
    }

    const handoffId = await ctx.db.insert("consultant_handoffs", {
      codeHash,
      expertRequestId: args.expertRequestId,
      assessmentId: request.assessmentId,
      partnerSlug,
      consultantExternalId,
      consultantEmail: assignedEmail,
      consultantName: assignedName,
      expiresAt: args.expiresAt,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      userId: `${partnerSlug}:${consultantExternalId}`,
      action: "consultant_handoff_issued",
      details: {
        assessmentId: request.assessmentId,
        expertRequestId: args.expertRequestId,
        handoffId,
        partnerSlug,
        consultantEmail: assignedEmail,
      },
      timestamp: now,
      archived: false,
    });

    return { handoffId, expiresAt: args.expiresAt };
  },
});

/**
 * Redeem a launch code, once.
 *
 * Consumes the row and mints the review token in the same transaction, so a
 * replayed code finds `consumedAt` already set and gets nothing.
 */
export const redeemHandoff = mutation({
  args: {
    partnerSecret: v.string(),
    codeHash: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertConsultantPartnerSecret(args.partnerSecret);

    const codeHash = args.codeHash.trim().toLowerCase();
    const tokenHash = args.tokenHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(codeHash) || !/^[0-9a-f]{64}$/.test(tokenHash)) {
      throw userError("link_expired_or_invalid", "This link has expired or was already used");
    }

    const handoff = await ctx.db
      .query("consultant_handoffs")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
      .unique();

    const now = Date.now();
    if (!handoff || handoff.consumedAt || handoff.expiresAt <= now) {
      throw userError("link_expired_or_invalid", "This link has expired or was already used");
    }

    const request = await ctx.db.get(handoff.expertRequestId);
    if (!request) throw userError("review_not_found", "Review request not found");
    if (
      request.assignedConsultantExternalId !== handoff.consultantExternalId ||
      request.externalSystem !== handoff.partnerSlug
    ) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }
    if (!dispatchIsOpen(request, now)) {
      throw userError("review_no_longer_open", "This review is no longer open");
    }

    const assessment = await ctx.db.get(handoff.assessmentId);
    if (!assessment) throw userError("assessment_not_found", "Assessment not found");

    const existingToken = await ctx.db
      .query("export_review_tokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (existingToken) {
      throw userError("link_expired_or_invalid", "This link has expired or was already used");
    }

    // Never outlives the dispatch itself.
    const expiresAt = Math.min(
      now + REVIEW_TOKEN_TTL_MS,
      request.expiresAt ?? now + REVIEW_TOKEN_TTL_MS,
    );

    const tokenId = await ctx.db.insert("export_review_tokens", {
      assessmentId: handoff.assessmentId,
      expertRequestId: handoff.expertRequestId,
      orgId: typeof assessment.orgId === "string" ? assessment.orgId : undefined,
      tokenHash,
      consultantEmail: handoff.consultantEmail ?? "",
      consultantName: handoff.consultantName,
      consultantRole: request.consultantRole ?? "applies_on_behalf",
      senderNote: request.senderNote,
      expiresAt,
      createdBy: `${handoff.partnerSlug}:${handoff.consultantExternalId}`,
      createdAt: now,
      openedAt: now,
      issuedVia: "handoff",
      partnerSlug: handoff.partnerSlug,
      consultantExternalId: handoff.consultantExternalId,
      consultantVerified: true,
    });

    await ctx.db.patch(handoff._id, { consumedAt: now, issuedTokenId: tokenId });

    if (request.status === "sent") {
      await ctx.db.patch(request._id, { status: "opened", updatedAt: now });
    }

    if (request.externalSystem) {
      await enqueuePartnerCaseStatus(ctx, {
        expertRequestId: request._id,
        partnerSlug: request.externalSystem,
        status: "in_review",
        now,
      });
    }

    await ctx.db.insert("auditLogs", {
      userId: `${handoff.partnerSlug}:${handoff.consultantExternalId}`,
      action: "consultant_handoff_redeemed",
      details: {
        assessmentId: handoff.assessmentId,
        expertRequestId: handoff.expertRequestId,
        handoffId: handoff._id,
        tokenId,
        partnerSlug: handoff.partnerSlug,
        consultantEmail: handoff.consultantEmail,
      },
      timestamp: now,
      archived: false,
    });

    return { expiresAt, expertRequestId: handoff.expertRequestId };
  },
});
