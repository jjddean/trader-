/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const PARTNER_SECRET = "test-partner-secret-0123456789-strong";
const PARTNER_SLUG = "bec";

/**
 * Convex reads outbound-only partner configuration. `createConsultantDispatch`
 * refuses to dispatch unless the partner has an intake URL, a strong outbound
 * key and a valid signing key id, so every dispatch test needs this set.
 */
const PARTNER_OUTBOUND = JSON.stringify([
  {
    slug: PARTNER_SLUG,
    name: "British Export Control",
    intakeUrl: "https://partner.example/api/integrations/cases",
    outboundKey: "partner-outbound-bearer-key-with-32-bytes",
    outboundSigningKey: "partner-signing-key-with-at-least-32-bytes",
    keyId: "fc-test-1",
  },
]);

const exporter = {
  subject: "user-exporter",
  tokenIdentifier: "test|user-exporter",
  org_id: "org-exporter",
};

const consultant = {
  id: "supabase-user-9f3c",
  email: "consultant@britishexportcontrol.co.uk",
  name: "A Consultant",
};

function createHarness() {
  return convexTest({ schema, modules });
}

type Harness = ReturnType<typeof createHarness>;

/** Deterministic stand-in for the SHA-256 the API route computes. */
function codeHashFor(code: string): string {
  return tokenHashFor(`code:${code}`);
}

function tokenHashFor(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .padEnd(64, "0")
    .slice(0, 64);
}

async function seedAssessment(t: Harness): Promise<Id<"export_assessments">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const assessmentId = await ctx.db.insert("export_assessments", {
      userId: exporter.subject,
      orgId: exporter.org_id,
      reference: "EC-2026-77001",
      status: "draft",
      originJurisdiction: "GB",
      destinationCountry: "TR",
      consignee: { name: "Aselsan Ltd", country: "TR" },
      endUser: { name: "MoD Turkey", country: "TR" },
      intendedUse: "Ground surveillance",
      createdAt: now,
      updatedAt: now,
    });

    const productId = await ctx.db.insert("export_products", {
      assessmentId,
      name: "Thermal imaging module",
      quantity: 4,
      valueGbp: 18500,
      techDescription: "Uncooled microbolometer",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("export_classification_runs", {
      productId,
      assessmentId,
      finalControlEntry: "6A003",
      requiresReview: false,
      createdAt: now,
    });

    return assessmentId;
  });
}

async function dispatch(t: Harness, assessmentId: Id<"export_assessments">) {
  const asExporter = t.withIdentity(exporter);
  const created = await asExporter.mutation(api.compliance_consultant.createConsultantDispatch, {
    assessmentId,
    partnerSlug: PARTNER_SLUG,
    senderNote: "Please check 6A003.",
    consultantRole: "eor",
  });
  await asExporter.mutation(api.compliance_consultant.markDispatchDelivered, {
    expertRequestId: created.expertRequestId,
    externalSystem: PARTNER_SLUG,
    externalCaseId: "bec-case-1",
  });
  return created;
}

async function issue(t: Harness, expertRequestId: Id<"expert_requests">, code: string, ttlMs = 120_000) {
  return await t.mutation(api.consultant_handoff.issueHandoff, {
    partnerSecret: PARTNER_SECRET,
    partnerSlug: PARTNER_SLUG,
    expertRequestId,
    codeHash: codeHashFor(code),
    expiresAt: Date.now() + ttlMs,
    consultantExternalId: consultant.id,
    consultantEmail: consultant.email,
    consultantName: consultant.name,
  });
}

beforeEach(() => {
  process.env.CONSULTANT_PARTNER_SECRET = PARTNER_SECRET;
  process.env.CONSULTANT_PARTNER_OUTBOUND = PARTNER_OUTBOUND;
});

describe("dispatch exclusivity", () => {
  it("atomically rejects a second open consultant dispatch for the assessment", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const asExporter = t.withIdentity(exporter);

    await asExporter.mutation(api.compliance_consultant.createConsultantDispatch, {
      assessmentId,
      partnerSlug: PARTNER_SLUG,
      consultantRole: "adviser",
    });

    await expect(
      asExporter.mutation(api.compliance_consultant.createConsultantDispatch, {
        assessmentId,
        partnerSlug: PARTNER_SLUG,
        consultantRole: "adviser",
      }),
    ).rejects.toThrow();
  });
});

describe("partner request replay claims", () => {
  const claim = (t: Harness, overrides: Partial<{
    requestId: string;
    digest: string;
    timestamp: number;
  }> = {}) =>
    t.mutation(api.consultant_handoff.claimPartnerRequest, {
      partnerSecret: PARTNER_SECRET,
      partnerSlug: PARTNER_SLUG,
      requestId: overrides.requestId ?? "request-1",
      digest: overrides.digest ?? "a".repeat(64),
      timestamp: overrides.timestamp ?? Date.now(),
    });

  it("persists the first request id", async () => {
    const t = createHarness();
    await expect(claim(t)).resolves.toMatchObject({ accepted: true });
    const rows = await t.run(async (ctx) => ctx.db.query("consultant_partner_requests").collect());
    expect(rows[0]).toMatchObject({ partnerSlug: PARTNER_SLUG, requestId: "request-1" });
  });

  it("rejects an identical replay", async () => {
    const t = createHarness();
    await claim(t);
    await expect(claim(t)).rejects.toThrow();
  });

  it("rejects a duplicate id carrying a different digest", async () => {
    const t = createHarness();
    await claim(t);
    await expect(claim(t, { digest: "b".repeat(64) })).rejects.toThrow();
  });

  it("rejects stale and future timestamps", async () => {
    const t = createHarness();
    await expect(
      claim(t, { requestId: "stale", timestamp: Date.now() - 5 * 60 * 1000 - 1_000 }),
    ).rejects.toThrow();
    await expect(
      claim(t, { requestId: "future", timestamp: Date.now() + 60_000 + 1_000 }),
    ).rejects.toThrow();
  });

  it("rejects a non-integer timestamp", async () => {
    const t = createHarness();
    await expect(
      claim(t, { requestId: "fractional", timestamp: Date.now() + 0.5 }),
    ).rejects.toThrow();
  });

  it("caps durable partner claims per minute", async () => {
    const t = createHarness();
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let index = 0; index < 120; index += 1) {
        await ctx.db.insert("consultant_partner_requests", {
          partnerSlug: PARTNER_SLUG,
          requestId: `seed-${index}`,
          digest: `digest-${index}`,
          requestTimestamp: now,
          receivedAt: now,
        });
      }
    });
    await expect(
      claim(t, { requestId: "over-cap", timestamp: now }),
    ).rejects.toThrow();
  });
});

describe("handoff issue", () => {
  it("refuses without the partner secret", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);

    await expect(
      t.mutation(api.consultant_handoff.issueHandoff, {
        partnerSecret: "wrong-secret",
        partnerSlug: PARTNER_SLUG,
        expertRequestId: created.expertRequestId,
        codeHash: codeHashFor("c1"),
        expiresAt: Date.now() + 60_000,
        consultantExternalId: consultant.id,
      }),
    ).rejects.toThrow();
  });

  /** A partner may only launch cases that were sent to that partner. */
  it("refuses a case belonging to a different partner", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);

    await expect(
      t.mutation(api.consultant_handoff.issueHandoff, {
        partnerSecret: PARTNER_SECRET,
        partnerSlug: "someone-else",
        expertRequestId: created.expertRequestId,
        codeHash: codeHashFor("c2"),
        expiresAt: Date.now() + 60_000,
        consultantExternalId: consultant.id,
      }),
    ).rejects.toThrow();
  });

  it("requires a consultant identity", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);

    await expect(
      t.mutation(api.consultant_handoff.issueHandoff, {
        partnerSecret: PARTNER_SECRET,
        partnerSlug: PARTNER_SLUG,
        expertRequestId: created.expertRequestId,
        codeHash: codeHashFor("c3"),
        expiresAt: Date.now() + 60_000,
        consultantExternalId: "   ",
      }),
    ).rejects.toThrow();
  });

  it("issues a code for an open case and audits it", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);

    const result = await issue(t, created.expertRequestId, "good-code");
    expect(result.handoffId).toBeTruthy();

    const logged = await t.run(async (ctx) => {
      const logs = await ctx.db.query("auditLogs").collect();
      return logs.some((log) => log.action === "consultant_handoff_issued");
    });
    expect(logged).toBe(true);
  });

  it("binds the case to the first partner-authenticated consultant", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "assigned-first");

    await expect(
      t.mutation(api.consultant_handoff.issueHandoff, {
        partnerSecret: PARTNER_SECRET,
        partnerSlug: PARTNER_SLUG,
        expertRequestId: created.expertRequestId,
        codeHash: codeHashFor("assigned-second"),
        expiresAt: Date.now() + 60_000,
        consultantExternalId: "different-consultant",
        consultantEmail: "different@example.test",
      }),
    ).rejects.toThrow();
  });
});

describe("handoff redemption", () => {
  it("mints a review token bound to the verified consultant", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "code-a");

    const redeemed = await t.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: PARTNER_SECRET,
      codeHash: codeHashFor("code-a"),
      tokenHash: tokenHashFor("session-a"),
    });

    expect(redeemed).not.toHaveProperty("token");

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("export_review_tokens")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHashFor("session-a")))
        .unique(),
    );
    expect(row?.token).toBeUndefined();
    expect(row?.tokenHash).toBe(tokenHashFor("session-a"));
    expect(row?.issuedVia).toBe("handoff");
    expect(row?.partnerSlug).toBe(PARTNER_SLUG);
    expect(row?.consultantExternalId).toBe(consultant.id);
    expect(row?.consultantVerified).toBe(true);
    expect(row?.consultantRole).toBe("eor");
    expect(row?.senderNote).toBe("Please check 6A003.");
  });

  /**
   * The security property the whole handoff rests on. A copied link, a back
   * button or a second tab must all fail.
   */
  it("cannot be redeemed twice", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "code-b");

    await t.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: PARTNER_SECRET,
      codeHash: codeHashFor("code-b"),
      tokenHash: tokenHashFor("session-b"),
    });

    await expect(
      t.mutation(api.consultant_handoff.redeemHandoff, {
        partnerSecret: PARTNER_SECRET,
        codeHash: codeHashFor("code-b"),
        tokenHash: tokenHashFor("session-b-duplicate"),
      }),
    ).rejects.toThrow();

    const tokenCount = await t.run(async (ctx) =>
      (await ctx.db.query("export_review_tokens").collect()).length,
    );
    expect(tokenCount).toBe(1);
  });

  it("refuses an expired code", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    const issued = await issue(t, created.expertRequestId, "code-c");
    await t.run(async (ctx) => {
      await ctx.db.patch(issued.handoffId, { expiresAt: Date.now() - 1_000 });
    });

    await expect(
      t.mutation(api.consultant_handoff.redeemHandoff, {
        partnerSecret: PARTNER_SECRET,
        codeHash: codeHashFor("code-c"),
        tokenHash: tokenHashFor("session-c"),
      }),
    ).rejects.toThrow();
  });

  it("refuses an unknown code", async () => {
    const t = createHarness();
    await expect(
      t.mutation(api.consultant_handoff.redeemHandoff, {
        partnerSecret: PARTNER_SECRET,
        codeHash: codeHashFor("never-issued"),
        tokenHash: tokenHashFor("session-unknown"),
      }),
    ).rejects.toThrow();
  });

  it("refuses without the partner secret", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "code-d");

    await expect(
      t.mutation(api.consultant_handoff.redeemHandoff, {
        partnerSecret: "wrong",
        codeHash: codeHashFor("code-d"),
        tokenHash: tokenHashFor("session-d"),
      }),
    ).rejects.toThrow();
  });

  it("marks the dispatch opened", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "code-e");
    await t.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: PARTNER_SECRET,
      codeHash: codeHashFor("code-e"),
      tokenHash: tokenHashFor("session-e"),
    });

    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(created.expertRequestId),
      outbox: await ctx.db.query("consultant_partner_status_outbox").collect(),
    }));
    expect(state.request?.status).toBe("opened");
    // The dispatch queues the initial case event; redemption adds the status
    // event. Assert on the status row rather than the whole outbox.
    const statusEvents = state.outbox.filter((row) => row.eventKind === "status");
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0]).toMatchObject({ status: "in_review", state: "pending" });
  });

  /** The review token must never outlive the dispatch that authorised it. */
  it("never issues a token outliving the dispatch", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "code-f");

    const redeemed = await t.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: PARTNER_SECRET,
      codeHash: codeHashFor("code-f"),
      tokenHash: tokenHashFor("session-f"),
    });
    expect(redeemed.expiresAt).toBeLessThanOrEqual(created.expiresAt);
  });
});

describe("revocation closes the handoff", () => {
  it("locks sender edits until the frozen review is withdrawn", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    const asExporter = t.withIdentity(exporter);

    await expect(
      asExporter.mutation(api.export_controls.updateAssessment, {
        assessmentId,
        destinationCountry: "RU",
      }),
    ).rejects.toThrow();

    await asExporter.mutation(api.compliance_consultant.revokeConsultantDispatch, {
      expertRequestId: created.expertRequestId,
    });

    await expect(
      asExporter.mutation(api.export_controls.updateAssessment, {
        assessmentId,
        destinationCountry: "RU",
      }),
    ).resolves.toBe(assessmentId);
  });

  it("refuses to issue a code after the review is withdrawn", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);

    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, {
        expertRequestId: created.expertRequestId,
        reason: "Assessment withdrawn",
      });

    await expect(issue(t, created.expertRequestId, "code-after-revoke")).rejects.toThrow();
  });

  /** A code already in flight must stop working the moment the review is pulled. */
  it("refuses to redeem a code issued before the withdrawal", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await issue(t, created.expertRequestId, "code-inflight");

    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, {
        expertRequestId: created.expertRequestId,
      });

    await expect(
      t.mutation(api.consultant_handoff.redeemHandoff, {
        partnerSecret: PARTNER_SECRET,
        codeHash: codeHashFor("code-inflight"),
        tokenHash: tokenHashFor("session-inflight"),
      }),
    ).rejects.toThrow();
  });
});
