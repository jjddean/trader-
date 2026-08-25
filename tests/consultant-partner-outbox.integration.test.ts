import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const NOW = 1_787_310_000_000;
const PARTNER_SLUG = "bec";
const PARTNER_INTAKE_URL = "https://partner.example/api/integrations/cases";
const PARTNER_CASE_ID = "partner-case-42";

const exporter = {
  subject: "user-exporter",
  tokenIdentifier: "test|user-exporter",
  org_id: "org-exporter",
};

const originalPartners = process.env.CONSULTANT_PARTNER_OUTBOUND;
const originalSourceSlug = process.env.CONSULTANT_SOURCE_SLUG;
const realFetch = globalThis.fetch;

interface CapturedRequest {
  url: string;
  method: string | undefined;
  headers: Headers;
  body: string;
  redirect: RequestRedirect | undefined;
}

let capturedRequests: CapturedRequest[];

function createHarness() {
  return convexTest({ schema, modules });
}

type Harness = ReturnType<typeof createHarness>;

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function seedAssessment(t: Harness): Promise<Id<"export_assessments">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("export_assessments", {
      userId: exporter.subject,
      orgId: exporter.org_id,
      reference: "EC-2026-OUTBOX",
      status: "draft",
      originJurisdiction: "GB",
      destinationCountry: "TR",
      createdAt: NOW,
      updatedAt: NOW,
    });
  });
}

async function seedRequest(
  t: Harness,
  deliveryStatus: "pending" | "delivered" = "delivered",
): Promise<Id<"expert_requests">> {
  const assessmentId = await seedAssessment(t);
  return await t.run(async (ctx) => {
    return await ctx.db.insert("expert_requests", {
      assessmentId,
      requestedBy: exporter.subject,
      reasonCode: "consultant_dispatch",
      status: "opened",
      assessmentSnapshot: {},
      consultantRole: "adviser",
      externalSystem: PARTNER_SLUG,
      deliveryStatus,
      expiresAt: NOW + 24 * 60 * 60 * 1000,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });
}

async function seedStatusOutbox(
  t: Harness,
  expertRequestId: Id<"expert_requests">,
  status: "in_review" | "completed" = "completed",
) {
  return await t.run(async (ctx) => {
    const eventId = crypto.randomUUID();
    const rawBody = JSON.stringify({
      eventId,
      eventType: "consultant.case.status_changed",
      occurredAt: NOW,
      sequence: 2,
      source: "freightcode",
      externalCaseId: String(expertRequestId),
      status,
    });
    const outboxId = await ctx.db.insert("consultant_partner_status_outbox", {
      expertRequestId,
      partnerSlug: PARTNER_SLUG,
      externalCaseId: String(expertRequestId),
      status,
      eventId,
      eventType: "consultant.case.status_changed",
      eventKind: "status",
      occurredAt: NOW,
      sequence: 2,
      rawBody,
      state: "pending",
      attempts: 0,
      nextAttemptAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    return { outboxId, rawBody };
  });
}

async function readOutbox(t: Harness, outboxId: Id<"consultant_partner_status_outbox">) {
  return await t.run(async (ctx) => ctx.db.get(outboxId));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  capturedRequests = [];
  vi.stubEnv("NODE_ENV", "test");
  process.env.CONSULTANT_SOURCE_SLUG = "freightcode";
  process.env.CONSULTANT_PARTNER_OUTBOUND = JSON.stringify([
    {
      slug: PARTNER_SLUG,
      name: "Test partner",
      intakeUrl: PARTNER_INTAKE_URL,
      outboundKey: "partner-outbound-bearer-key-with-32-bytes",
      outboundSigningKey: "partner-signing-key-with-at-least-32-bytes",
      keyId: "fc-test-1",
    },
  ]);
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedRequests.push({
      url: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: String(init?.body ?? ""),
      redirect: init?.redirect,
    });
    return new Response(JSON.stringify({ caseId: PARTNER_CASE_ID }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  globalThis.fetch = realFetch;
  restoreEnvironment("CONSULTANT_PARTNER_OUTBOUND", originalPartners);
  restoreEnvironment("CONSULTANT_SOURCE_SLUG", originalSourceSlug);
  vi.unstubAllEnvs();
});

describe("consultant partner outbox claims", () => {
  it("atomically grants only one concurrent delivery claim", async () => {
    const t = createHarness();
    const expertRequestId = await seedRequest(t);
    const { outboxId } = await seedStatusOutbox(t, expertRequestId);

    const claims = await Promise.all([
      t.mutation(internal.consultant_partner_sync.claimPartnerDelivery, { outboxId }),
      t.mutation(internal.consultant_partner_sync.claimPartnerDelivery, { outboxId }),
    ]);
    const winners = claims.filter((claim) => claim !== null);

    expect(winners).toHaveLength(1);
    const row = await readOutbox(t, outboxId);
    expect(row?.state).toBe("delivering");
    expect(row?.claimId).toBe(winners[0]?.claimId);
    expect(row?.leaseExpiresAt).toBeGreaterThan(NOW);

    const history = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_delivery_attempts")
        .withIndex("by_outbox", (q) => q.eq("outboxId", outboxId))
        .collect(),
    );
    expect(history.filter((attempt) => attempt.phase === "claimed")).toHaveLength(1);
  });

  it("reclaims an expired lease and ignores the crashed worker's late result", async () => {
    const t = createHarness();
    const expertRequestId = await seedRequest(t);
    const { outboxId, rawBody } = await seedStatusOutbox(t, expertRequestId);
    const crashedClaim = await t.mutation(
      internal.consultant_partner_sync.claimPartnerDelivery,
      { outboxId },
    );
    expect(crashedClaim).not.toBeNull();

    vi.setSystemTime((crashedClaim?.leaseExpiresAt ?? NOW) + 1);
    const delivered = await t.action(internal.consultant_partner_sync.deliverPartnerOutbox, {
      outboxId,
    });
    expect(delivered.ok).toBe(true);

    const lateResult = await t.mutation(
      internal.consultant_partner_sync.recordPartnerDeliveryResult,
      {
        outboxId,
        claimId: crashedClaim!.claimId,
        ok: false,
        error: "late failure from crashed worker",
      },
    );
    expect(lateResult === null || lateResult.accepted === false).toBe(true);

    const row = await readOutbox(t, outboxId);
    expect(row?.state).toBe("delivered");
    expect(row?.lastError).toBeUndefined();
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]).toMatchObject({
      url: `${PARTNER_INTAKE_URL}/status`,
      method: "POST",
      body: rawBody,
      redirect: "manual",
    });
    expect(capturedRequests[0].headers.get("authorization")).toBe(
      "Bearer partner-outbound-bearer-key-with-32-bytes",
    );
    expect(capturedRequests[0].headers.get("x-fc-signature-version")).toBe("v1");

    const phases = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("consultant_partner_delivery_attempts")
          .withIndex("by_outbox", (q) => q.eq("outboxId", outboxId))
          .collect()
      ).map((attempt) => attempt.phase),
    );
    expect(phases).toContain("lease_expired");
    expect(phases).toContain("delivered");
  });

  it("supersedes a claimed in-review event when a terminal event is queued", async () => {
    const t = createHarness();
    const expertRequestId = await seedRequest(t);
    const { outboxId } = await seedStatusOutbox(t, expertRequestId, "in_review");
    const claim = await t.mutation(internal.consultant_partner_sync.claimPartnerDelivery, {
      outboxId,
    });
    expect(claim).not.toBeNull();

    await t.mutation(internal.consultant_partner_sync.markDispatchExpired, {
      expertRequestId,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_status_outbox")
        .withIndex("by_expert_request", (q) => q.eq("expertRequestId", expertRequestId))
        .collect(),
    );
    const inReview = rows.find((row) => row.status === "in_review");
    const expired = rows.find((row) => row.status === "expired");
    expect(inReview?.state).toBe("superseded");
    expect(inReview?.claimId).toBeUndefined();
    expect(expired?.state).toBe("pending");
    expect(expired?.sequence).toBeGreaterThan(inReview?.sequence ?? 0);

    const staleResult = await t.mutation(
      internal.consultant_partner_sync.recordPartnerDeliveryResult,
      {
        outboxId,
        claimId: claim!.claimId,
        ok: true,
        httpStatus: 200,
      },
    );
    expect(staleResult === null || staleResult.accepted === false).toBe(true);
    expect((await readOutbox(t, outboxId))?.state).toBe("superseded");

    const history = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_delivery_attempts")
        .withIndex("by_outbox", (q) => q.eq("outboxId", outboxId))
        .collect(),
    );
    expect(history.some((attempt) => attempt.phase === "superseded")).toBe(true);
  });

  it("retries the same durable initial event after a worker crashes", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.createConsultantDispatch, {
        assessmentId,
        partnerSlug: PARTNER_SLUG,
        consultantRole: "eor",
        senderNote: "Check the frozen classification.",
      });

    const initial = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_status_outbox")
        .withIndex("by_request_status", (q) =>
          q.eq("expertRequestId", created.expertRequestId).eq("status", "received"),
        )
        .unique(),
    );
    expect(initial?.eventKind).toBe("initial");
    expect(initial?.state).toBe("pending");

    const crashedClaim = await t.mutation(
      internal.consultant_partner_sync.claimPartnerDelivery,
      { outboxId: initial!._id },
    );
    expect(crashedClaim).not.toBeNull();
    vi.setSystemTime((crashedClaim?.leaseExpiresAt ?? NOW) + 1);

    const result = await t.action(internal.consultant_partner_sync.deliverPartnerOutbox, {
      outboxId: initial!._id,
    });
    expect(result.ok).toBe(true);

    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(created.expertRequestId),
      outbox: await ctx.db.get(initial!._id),
      requests: await ctx.db
        .query("expert_requests")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
        .collect(),
    }));
    expect(state.requests).toHaveLength(1);
    expect(state.outbox?.eventId).toBe(initial?.eventId);
    expect(state.outbox?.rawBody).toBe(initial?.rawBody);
    expect(state.outbox?.state).toBe("delivered");
    expect(state.outbox?.responseCaseId).toBe(PARTNER_CASE_ID);
    expect(state.request?.deliveryStatus).toBe("delivered");
    expect(state.request?.externalCaseId).toBe(PARTNER_CASE_ID);
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]).toMatchObject({
      url: PARTNER_INTAKE_URL,
      method: "POST",
      body: initial?.rawBody,
      redirect: "manual",
    });
    expect(JSON.parse(capturedRequests[0].body)).toMatchObject({
      eventId: initial?.eventId,
      externalCaseId: String(created.expertRequestId),
      reviewRole: "eor",
    });
  });
});

/**
 * The exact bytes we put on a partner's wire.
 *
 * Two defects lived here, and neither was visible to a test that checked only
 * one side of the contract:
 *
 *   1. `source` carried the PARTNER's slug ("bec") instead of ours
 *      ("freightcode"). The partner authenticates the sender by that field, so
 *      every status update was rejected as an unknown source.
 *   2. `externalCaseId` carried the id the PARTNER generated and returned at
 *      intake, instead of the id we sent them. The partner keys the case on
 *      what we sent, so the lookup missed even once the slug was right.
 *
 * These assert the payload the production builders emit, against the contract
 * in BEC's docs/INTEGRATION.md. The second case only reproduces after a
 * delivered intake has written the partner's own id onto the request, which is
 * why it runs the initial delivery first.
 */
describe("outbound partner payload contract", () => {
  it("identifies us as the source on the initial case event", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.createConsultantDispatch, {
        assessmentId,
        partnerSlug: PARTNER_SLUG,
        consultantRole: "adviser",
      });

    const initial = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_status_outbox")
        .withIndex("by_request_status", (q) =>
          q.eq("expertRequestId", created.expertRequestId).eq("status", "received"),
        )
        .unique(),
    );

    const body = JSON.parse(initial!.rawBody!);
    expect(body.source).toBe("freightcode");
    expect(body.source).not.toBe(PARTNER_SLUG);
    expect(body.externalCaseId).toBe(String(created.expertRequestId));
  });

  it("sends the id we gave at intake, not the one the partner returned", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const created = await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.createConsultantDispatch, {
        assessmentId,
        partnerSlug: PARTNER_SLUG,
        consultantRole: "adviser",
      });

    const initial = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_status_outbox")
        .withIndex("by_request_status", (q) =>
          q.eq("expertRequestId", created.expertRequestId).eq("status", "received"),
        )
        .unique(),
    );
    await t.action(internal.consultant_partner_sync.deliverPartnerOutbox, {
      outboxId: initial!._id,
    });

    // The partner's own id is now on the request. A status event must still
    // carry ours.
    const afterIntake = await t.run(async (ctx) => ctx.db.get(created.expertRequestId));
    expect(afterIntake?.externalCaseId).toBe(PARTNER_CASE_ID);

    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, {
        expertRequestId: created.expertRequestId,
      });

    const revoked = await t.run(async (ctx) =>
      ctx.db
        .query("consultant_partner_status_outbox")
        .withIndex("by_request_status", (q) =>
          q.eq("expertRequestId", created.expertRequestId).eq("status", "revoked"),
        )
        .unique(),
    );

    const body = JSON.parse(revoked!.rawBody!);
    expect(body.source).toBe("freightcode");
    expect(body.externalCaseId).toBe(String(created.expertRequestId));
    expect(body.externalCaseId).not.toBe(PARTNER_CASE_ID);
  });
});
