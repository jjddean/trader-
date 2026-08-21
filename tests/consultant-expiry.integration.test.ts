/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import { api, internal } from "../convex/_generated/api";
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

function createHarness() {
  return convexTest({ schema, modules });
}
type Harness = ReturnType<typeof createHarness>;

async function seedAssessment(t: Harness): Promise<Id<"export_assessments">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("export_assessments", {
      userId: exporter.subject,
      orgId: exporter.org_id,
      reference: "EC-2026-77002",
      status: "draft",
      originJurisdiction: "GB",
      destinationCountry: "TR",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function dispatch(t: Harness, assessmentId: Id<"export_assessments">) {
  const asExporter = t.withIdentity(exporter);
  const created = await asExporter.mutation(api.compliance_consultant.createConsultantDispatch, {
    assessmentId,
    partnerSlug: PARTNER_SLUG,
    consultantRole: "adviser",
  });
  await asExporter.mutation(api.compliance_consultant.markDispatchDelivered, {
    expertRequestId: created.expertRequestId,
    externalSystem: PARTNER_SLUG,
    externalCaseId: "bec-case-1",
  });
  return created;
}

async function lapse(t: Harness, expertRequestId: Id<"expert_requests">) {
  await t.run(async (ctx) => {
    await ctx.db.patch(expertRequestId, { expiresAt: Date.now() - 60_000 });
  });
}

beforeEach(() => {
  process.env.CONSULTANT_PARTNER_SECRET = PARTNER_SECRET;
  process.env.CONSULTANT_PARTNER_OUTBOUND = PARTNER_OUTBOUND;
});

describe("expiry sweep", () => {
  it("finds a dispatch past its expiry", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await lapse(t, created.expertRequestId);

    const lapsed = await t.query(internal.consultant_partner_sync.listLapsedDispatches, {});
    expect(lapsed).toHaveLength(1);
    // OUR dispatch id, not the id BEC returned. The partner keys the case on
    // what we sent at intake, so an expiry push carrying "bec-case-1" would
    // find nothing. This assertion previously encoded that defect.
    expect(lapsed[0].externalCaseId).toBe(String(created.expertRequestId));
    expect(lapsed[0].externalCaseId).not.toBe("bec-case-1");
  });

  it("ignores a dispatch still within its window", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    await dispatch(t, assessmentId);

    const lapsed = await t.query(internal.consultant_partner_sync.listLapsedDispatches, {});
    expect(lapsed).toHaveLength(0);
  });

  it("ignores a completed dispatch", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await t.run(async (ctx) => {
      await ctx.db.patch(created.expertRequestId, {
        expiresAt: Date.now() - 60_000,
        completedAt: Date.now() - 30_000,
      });
    });

    const lapsed = await t.query(internal.consultant_partner_sync.listLapsedDispatches, {});
    expect(lapsed).toHaveLength(0);
  });

  it("ignores a withdrawn dispatch", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, {
        expertRequestId: created.expertRequestId,
      });
    await lapse(t, created.expertRequestId);

    const lapsed = await t.query(internal.consultant_partner_sync.listLapsedDispatches, {});
    expect(lapsed).toHaveLength(0);
  });

  it("marks a lapsed dispatch expired and audits it", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await lapse(t, created.expertRequestId);

    await t.mutation(internal.consultant_partner_sync.markDispatchExpired, {
      expertRequestId: created.expertRequestId,
    });

    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(created.expertRequestId),
      logs: await ctx.db.query("auditLogs").collect(),
    }));

    expect(state.request?.status).toBe("expired");
    expect(state.request?.deliveryStatus).toBe("expired");
    expect(state.logs.some((log) => log.action === "consultant_dispatch_expired")).toBe(true);
  });

  it("retains a failed expiry status for bounded retry", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await lapse(t, created.expertRequestId);

    await t.mutation(internal.consultant_partner_sync.markDispatchExpired, {
      expertRequestId: created.expertRequestId,
    });
    const queued = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_status_outbox")
        .withIndex("by_request_status", (q) =>
          q.eq("expertRequestId", created.expertRequestId).eq("status", "expired"),
        )
        .unique(),
    );
    expect(queued?.state).toBe("pending");

    /**
     * Delivery is claim-then-record: `recordPartnerDeliveryResult` only accepts
     * a result from the worker currently holding the claim, so each retry has
     * to claim first. The row is made due before each claim rather than
     * sleeping out the real exponential backoff.
     */
    async function failOneDelivery(error: string) {
      await t.run(async (ctx) => ctx.db.patch(queued!._id, { nextAttemptAt: Date.now() }));
      const claim = await t.mutation(internal.consultant_partner_sync.claimPartnerDelivery, {
        outboxId: queued!._id,
      });
      expect(claim).not.toBeNull();
      await t.mutation(internal.consultant_partner_sync.recordPartnerDeliveryResult, {
        outboxId: queued!._id,
        claimId: claim!.claimId,
        ok: false,
        error,
      });
    }

    const beforeAttempt = Date.now();
    await failOneDelivery("partner unavailable");
    const retained = await t.run(async (ctx) => ctx.db.get(queued!._id));
    expect(retained?.state).toBe("pending");
    expect(retained?.attempts).toBe(1);
    expect(retained?.lastError).toBe("partner unavailable");
    expect(retained?.nextAttemptAt).toBeGreaterThan(beforeAttempt);

    for (let attempt = 1; attempt < 6; attempt += 1) {
      await failOneDelivery("still unavailable");
    }
    const exhausted = await t.run(async (ctx) => ctx.db.get(queued!._id));
    expect(exhausted?.state).toBe("exhausted");
    expect(exhausted?.attempts).toBe(6);
  });

  /** Sweeping twice must not re-expire or double-audit. */
  it("is idempotent", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await lapse(t, created.expertRequestId);

    await t.mutation(internal.consultant_partner_sync.markDispatchExpired, {
      expertRequestId: created.expertRequestId,
    });
    const afterFirst = await t.query(internal.consultant_partner_sync.listLapsedDispatches, {});
    expect(afterFirst).toHaveLength(0);
  });

  it("will not expire a completed dispatch", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);
    await t.run(async (ctx) => {
      await ctx.db.patch(created.expertRequestId, {
        completedAt: Date.now(),
        status: "completed",
      });
    });

    await t.mutation(internal.consultant_partner_sync.markDispatchExpired, {
      expertRequestId: created.expertRequestId,
    });

    const request = await t.run(async (ctx) => ctx.db.get(created.expertRequestId));
    expect(request?.status).toBe("completed");
  });

  /**
   * Expiry has to close the consultant's door too, not merely relabel the
   * dispatch — otherwise a token issued earlier still resolves.
   */
  it("revokes any live review token for the dispatch", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await dispatch(t, assessmentId);

    await t.mutation(api.consultant_handoff.issueHandoff, {
      partnerSecret: PARTNER_SECRET,
      partnerSlug: PARTNER_SLUG,
      expertRequestId: created.expertRequestId,
      codeHash: "d".repeat(64),
      expiresAt: Date.now() + 60_000,
      consultantExternalId: "supabase-user-9f3c",
      consultantEmail: "consultant@britishexportcontrol.co.uk",
    });
    const tokenHash = "e".repeat(64);
    await t.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: PARTNER_SECRET,
      codeHash: "d".repeat(64),
      tokenHash,
    });

    await lapse(t, created.expertRequestId);
    await t.mutation(internal.consultant_partner_sync.markDispatchExpired, {
      expertRequestId: created.expertRequestId,
    });

    const review = await t.query(api.compliance_consultant.getReviewByToken, {
      tokenHash,
      partnerSecret: PARTNER_SECRET,
    });
    expect(review).toBeNull();
  });
});

describe("delivery failure is retained", () => {
  it("keeps the frozen snapshot so the send can be retried", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const asExporter = t.withIdentity(exporter);

    const created = await asExporter.mutation(
      api.compliance_consultant.createConsultantDispatch,
      { assessmentId, partnerSlug: PARTNER_SLUG, consultantRole: "adviser" },
    );
    await asExporter.mutation(api.compliance_consultant.markDispatchDeliveryFailed, {
      expertRequestId: created.expertRequestId,
      externalSystem: PARTNER_SLUG,
      deliveryError: "connect ETIMEDOUT",
    });

    const request = await t.run(async (ctx) => ctx.db.get(created.expertRequestId));
    expect(request?.deliveryStatus).toBe("failed");
    expect(request?.deliveryError).toBe("connect ETIMEDOUT");
    expect(request?.assessmentSnapshot).toBeTruthy();
    expect(request?.completedAt).toBeUndefined();

    const retried = await asExporter.mutation(
      api.compliance_consultant.retryConsultantDispatch,
      { expertRequestId: created.expertRequestId },
    );
    expect(retried.expertRequestId).toBe(created.expertRequestId);
    expect(retried.snapshot).toEqual(request?.assessmentSnapshot);
    // A retry re-queues the same request: the frozen snapshot is kept, the
    // failure is cleared, and delivery goes back to pending.
    const requeued = await t.run(async (ctx) => ctx.db.get(created.expertRequestId));
    expect(requeued?.deliveryStatus).toBe("pending");
    expect(requeued?.deliveryError).toBeUndefined();
    expect(requeued?.assessmentSnapshot).toEqual(request?.assessmentSnapshot);
  });

  it("clears the error once a later attempt succeeds", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const asExporter = t.withIdentity(exporter);

    const created = await asExporter.mutation(
      api.compliance_consultant.createConsultantDispatch,
      { assessmentId, partnerSlug: PARTNER_SLUG, consultantRole: "adviser" },
    );
    await asExporter.mutation(api.compliance_consultant.markDispatchDeliveryFailed, {
      expertRequestId: created.expertRequestId,
      externalSystem: PARTNER_SLUG,
      deliveryError: "connect ETIMEDOUT",
    });
    await asExporter.mutation(api.compliance_consultant.markDispatchDelivered, {
      expertRequestId: created.expertRequestId,
      externalSystem: PARTNER_SLUG,
      externalCaseId: "bec-case-retry",
    });

    const request = await t.run(async (ctx) => ctx.db.get(created.expertRequestId));
    expect(request?.deliveryStatus).toBe("delivered");
    expect(request?.deliveryError).toBeUndefined();
    expect(request?.externalCaseId).toBe("bec-case-retry");
  });

  it("refuses a delivery mark from outside the org", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.createConsultantDispatch, {
        assessmentId,
        partnerSlug: PARTNER_SLUG,
        consultantRole: "adviser",
      });

    await expect(
      t
        .withIdentity({
          subject: "user-intruder",
          tokenIdentifier: "test|user-intruder",
          org_id: "org-other",
        })
        .mutation(api.compliance_consultant.markDispatchDelivered, {
          expertRequestId: created.expertRequestId,
          externalSystem: PARTNER_SLUG,
          externalCaseId: "hijack",
        }),
    ).rejects.toThrow();
  });
});
