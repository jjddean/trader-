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

async function seedAssessment(
  t: Harness,
  options: { destinationCountry?: string; controlEntry?: string } = {},
): Promise<Id<"export_assessments">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const assessmentId = await ctx.db.insert("export_assessments", {
      userId: exporter.subject,
      orgId: exporter.org_id,
      reference: "EC-2026-77001",
      status: "draft",
      originJurisdiction: "GB",
      destinationCountry: options.destinationCountry ?? "TR",
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
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("export_classification_runs", {
      productId,
      assessmentId,
      finalControlEntry: options.controlEntry ?? "6A003",
      requiresReview: false,
      createdAt: now,
    });

    return assessmentId;
  });
}

/** Dispatch, hand off, redeem — the full path a consultant actually arrives by. */
async function reviewToken(
  t: Harness,
  assessmentId: Id<"export_assessments">,
): Promise<{ token: string; expertRequestId: Id<"expert_requests"> }> {
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
  await t.mutation(api.consultant_handoff.issueHandoff, {
    partnerSecret: PARTNER_SECRET,
    partnerSlug: PARTNER_SLUG,
    expertRequestId: created.expertRequestId,
    codeHash: "b".repeat(64),
    expiresAt: Date.now() + 120_000,
    consultantExternalId: consultant.id,
    consultantEmail: consultant.email,
    consultantName: consultant.name,
  });
  await t.mutation(api.consultant_handoff.redeemHandoff, {
    partnerSecret: PARTNER_SECRET,
    codeHash: "b".repeat(64),
    tokenHash: "a".repeat(64),
  });
  return { token: "a".repeat(64), expertRequestId: created.expertRequestId };
}

beforeEach(() => {
  process.env.CONSULTANT_PARTNER_SECRET = PARTNER_SECRET;
  process.env.CONSULTANT_PARTNER_OUTBOUND = PARTNER_OUTBOUND;
});

function credential(tokenHash: string) {
  return { tokenHash, partnerSecret: PARTNER_SECRET };
}

/**
 * `createEndUserDispatch` requires a 64-hex redemption-code hash and rejects a
 * duplicate via the `by_redemption_code_hash` index, so each dispatch in a
 * harness needs its own.
 */
function redemptionCodeHash(seed: string): string {
  let hex = "";
  for (let i = 0; i < seed.length; i += 1) {
    hex += seed.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return (hex + "0".repeat(64)).slice(0, 64);
}

describe("review credential security", () => {
  it("renders the frozen dispatch snapshot after live assessment edits", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    await t.run(async (ctx) => {
      await ctx.db.patch(assessmentId, {
        destinationCountry: "US",
        intendedUse: "Changed after dispatch",
        updatedAt: Date.now(),
      });
      const product = (
        await ctx.db
          .query("export_products")
          .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
          .collect()
      )[0];
      await ctx.db.patch(product._id, { name: "Changed product", updatedAt: Date.now() });
    });

    const review = await t.query(api.compliance_consultant.getReviewByToken, credential(token));
    expect(review?.assessment.destinationCountry).toBe("TR");
    expect(review?.assessment.intendedUse).toBe("Ground surveillance");
    expect(review?.products[0].name).toBe("Thermal imaging module");
    expect(review).not.toHaveProperty("token");
    expect(review).not.toHaveProperty("tokenHash");
    expect(review).not.toHaveProperty("expertRequests");
  });

  it("does not return a plaintext or hashed review credential in sender status", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    const status = await t
      .withIdentity(exporter)
      .query(api.compliance_consultant.getConsultantDispatchStatus, { assessmentId });
    expect(status?.activeToken).toBeTruthy();
    expect(status?.activeToken).not.toHaveProperty("token");
    expect(status?.activeToken).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(status)).not.toContain(token);
    expect(status?.latestRequest).not.toHaveProperty("assessmentSnapshot");
    expect(status?.latestRequest).not.toHaveProperty("requestedBy");
    expect(status?.latestRequest).not.toHaveProperty("externalCaseId");
  });

  it("rejects completed, revoked and expired review credentials for EUSU creation", async () => {
    const completedHarness = createHarness();
    const completedAssessment = await seedAssessment(completedHarness);
    const completed = await reviewToken(completedHarness, completedAssessment);
    await completedHarness.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(completed.token),
      advisoryNotes: "Complete.",
      outcome: "cleared",
    });
    await expect(
      completedHarness.mutation(api.compliance_end_user.createEndUserDispatch, {
        ...credential(completed.token),
        redemptionCodeHash: redemptionCodeHash("completed"),
        recipientEmail: "buyer@example.com",
      }),
    ).rejects.toThrow();

    const revokedHarness = createHarness();
    const revokedAssessment = await seedAssessment(revokedHarness);
    const revoked = await reviewToken(revokedHarness, revokedAssessment);
    await revokedHarness
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, {
        expertRequestId: revoked.expertRequestId,
      });
    await expect(
      revokedHarness.mutation(api.compliance_end_user.createEndUserDispatch, {
        ...credential(revoked.token),
        redemptionCodeHash: redemptionCodeHash("revoked"),
        recipientEmail: "buyer@example.com",
      }),
    ).rejects.toThrow();

    const expiredHarness = createHarness();
    const expiredAssessment = await seedAssessment(expiredHarness);
    const expired = await reviewToken(expiredHarness, expiredAssessment);
    await expiredHarness.run(async (ctx) => {
      await ctx.db.patch(expired.expertRequestId, { expiresAt: Date.now() - 1 });
    });
    await expect(
      expiredHarness.mutation(api.compliance_end_user.createEndUserDispatch, {
        ...credential(expired.token),
        redemptionCodeHash: redemptionCodeHash("expired"),
        recipientEmail: "buyer@example.com",
      }),
    ).rejects.toThrow();
  });

  it("completion closes an EUSU credential derived from the review", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);
    const endUser = await t.mutation(api.compliance_end_user.createEndUserDispatch, {
      ...credential(token),
      redemptionCodeHash: redemptionCodeHash("derived"),
        recipientEmail: "buyer@example.com",
    });

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Complete.",
      outcome: "cleared",
    });
    // `token` is a legacy field new rows never write — read the row by id.
    const row = await t.run(async (ctx) =>
      ctx.db.get(endUser.tokenId as Id<"export_end_user_tokens">),
    );
    expect(row?.revoked).toBe(true);
  });

  it("completion closes every review credential for the dispatch", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const first = await reviewToken(t, assessmentId);
    const secondHash = "b".repeat(64);
    await t.mutation(api.consultant_handoff.issueHandoff, {
      partnerSecret: PARTNER_SECRET,
      partnerSlug: PARTNER_SLUG,
      expertRequestId: first.expertRequestId,
      codeHash: "c".repeat(64),
      expiresAt: Date.now() + 120_000,
      // A dispatch binds to the first consultant to claim it, so a second
      // credential is a second session for that same consultant.
      consultantExternalId: consultant.id,
    });
    await t.mutation(api.consultant_handoff.redeemHandoff, {
      partnerSecret: PARTNER_SECRET,
      codeHash: "c".repeat(64),
      tokenHash: secondHash,
    });

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(first.token),
      advisoryNotes: "Complete.",
      outcome: "cleared",
    });
    const second = await t.run(async (ctx) =>
      ctx.db
        .query("export_review_tokens")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", secondHash))
        .unique(),
    );
    expect(second?.revoked).toBe(true);
    expect(second?.completedAt).toBeTypeOf("number");
    await expect(
      t.mutation(api.compliance_end_user.createEndUserDispatch, {
        ...credential(secondHash),
        redemptionCodeHash: redemptionCodeHash("second"),
        recipientEmail: "buyer@example.com",
      }),
    ).rejects.toThrow();
  });
});

describe("clear", () => {
  it("writes assessment, request, licence and audit", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    const result = await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "6A003 confirmed. Proceed with SIEL.",
      outcome: "cleared",
      applicationRef: "GBSIEL/2026/0012345",
      licenceRef: "SIEL-99887",
    });
    expect(result.outcome).toBe("cleared");

    const state = await t.run(async (ctx) => ({
      assessment: await ctx.db.get(assessmentId),
      request: await ctx.db.get(expertRequestId),
      licences: await ctx.db.query("export_licences").collect(),
      logs: await ctx.db.query("auditLogs").collect(),
      outbox: await ctx.db.query("consultant_partner_status_outbox").collect(),
    }));

    expect(state.assessment?.status).toBe("clear");
    expect(state.request?.status).toBe("completed");
    expect(state.request?.outcome).toBe("cleared");
    expect(state.request?.advisoryNotes).toBe("6A003 confirmed. Proceed with SIEL.");
    expect(state.request?.applicationRef).toBe("GBSIEL/2026/0012345");
    expect(state.request?.licenceRef).toBe("SIEL-99887");

    expect(state.licences).toHaveLength(1);
    expect(state.licences[0].applicationRef).toBe("GBSIEL/2026/0012345");
    expect(state.licences[0].licenceRef).toBe("SIEL-99887");

    expect(state.logs.some((log) => log.action === "consultant_review_completed")).toBe(true);
    expect(state.outbox.find((row) => row.status === "in_review")?.state).toBe("superseded");
    expect(state.outbox.find((row) => row.status === "completed")?.state).toBe("pending");
  });

  /** The requester has to learn the review came back. */
  it("notifies the requester", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Cleared.",
      outcome: "cleared",
    });

    const notifications = await t.run(async (ctx) =>
      ctx.db.query("app_notifications").collect(),
    );
    const review = notifications.find(
      (n) => n.event === "export_controls.consultant_review_completed",
    );
    expect(review).toBeTruthy();
    expect(review?.userId).toBe(exporter.subject);
  });

  it("records no licence when no reference was given", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Not controlled. No licence needed.",
      outcome: "cleared",
    });

    const licences = await t.run(async (ctx) => ctx.db.query("export_licences").collect());
    expect(licences).toHaveLength(0);
  });
});

describe("block", () => {
  it("flags the assessment and records the reason", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "End user linked to a listed entity. Do not ship.",
      outcome: "blocked",
    });

    const state = await t.run(async (ctx) => ({
      assessment: await ctx.db.get(assessmentId),
      request: await ctx.db.get(expertRequestId),
    }));

    expect(state.assessment?.status).toBe("flagged");
    expect(state.request?.status).toBe("blocked");
    expect(state.request?.outcome).toBe("blocked");
  });
});

describe("verified reviewer identity", () => {
  /**
   * The point of the handoff: the audit record names an identity the partner
   * proved, not an address a FreightCode sender typed into a box.
   */
  it("reaches the request, the licence and the audit log", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Cleared.",
      outcome: "cleared",
      applicationRef: "GBSIEL/2026/0012345",
    });

    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(expertRequestId),
      licence: (await ctx.db.query("export_licences").collect())[0],
      log: (await ctx.db.query("auditLogs").collect()).find(
        (entry) => entry.action === "consultant_review_completed",
      ),
    }));

    expect(state.request?.reviewerVerified).toBe(true);
    expect(state.request?.reviewerSystem).toBe(PARTNER_SLUG);
    expect(state.request?.reviewerExternalId).toBe(consultant.id);
    expect(state.request?.reviewerEmail).toBe(consultant.email);

    expect(state.licence.recordedBy).toBe(consultant.email);
    expect(state.log?.userId).toBe(consultant.email);
    expect((state.log?.details as Record<string, unknown>).reviewerVerified).toBe(true);
    expect((state.log?.details as Record<string, unknown>).reviewerExternalId).toBe(consultant.id);
  });
});

describe("licence type never contradicts the route", () => {
  it("records SIEL on a LITE-eligible case", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t, { destinationCountry: "TR" });
    const { token } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Cleared.",
      outcome: "cleared",
      applicationRef: "GBSIEL/2026/0012345",
    });

    const licence = await t.run(async (ctx) =>
      (await ctx.db.query("export_licences").collect())[0],
    );
    expect(licence.route).toBe("lite");
    expect(licence.licenceType).toBe("siel");
  });

  /**
   * The defect: sign-off hardcoded "siel", so a sanctioned-destination case
   * recorded a SIEL that was never a SIEL application.
   */
  it("does not record SIEL on a sanctioned-destination SPIRE case", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t, { destinationCountry: "RU" });
    const { token } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Requires SPIRE handling.",
      outcome: "cleared",
      applicationRef: "SPIRE/2026/1",
    });

    const licence = await t.run(async (ctx) =>
      (await ctx.db.query("export_licences").collect())[0],
    );
    expect(licence.route).toBe("spire");
    expect(licence.licenceType).not.toBe("siel");
    expect(licence.licenceType).toBe("other");
  });
});

describe("a review can only be completed once, and only while open", () => {
  it("refuses a second completion", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Cleared.",
      outcome: "cleared",
    });

    await expect(
      t.mutation(api.compliance_consultant.completeConsultantReview, {
        ...credential(token),
        advisoryNotes: "Changed my mind.",
        outcome: "blocked",
      }),
    ).rejects.toThrow();

    const assessment = await t.run(async (ctx) => ctx.db.get(assessmentId));
    expect(assessment?.status).toBe("clear");
  });

  it("requires advisory notes", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    await expect(
      t.mutation(api.compliance_consultant.completeConsultantReview, {
        ...credential(token),
        advisoryNotes: "   ",
        outcome: "cleared",
      }),
    ).rejects.toThrow();
  });

  /** Withdrawal has to stop a consultant already holding a live token. */
  it("refuses after the review is withdrawn", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, { expertRequestId });

    await expect(
      t.mutation(api.compliance_consultant.completeConsultantReview, {
        ...credential(token),
        advisoryNotes: "Too late.",
        outcome: "cleared",
      }),
    ).rejects.toThrow();

    const assessment = await t.run(async (ctx) => ctx.db.get(assessmentId));
    expect(assessment?.status).not.toBe("clear");
  });

  it("refuses after the dispatch expires", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t.run(async (ctx) => {
      await ctx.db.patch(expertRequestId, { expiresAt: Date.now() - 1_000 });
    });

    await expect(
      t.mutation(api.compliance_consultant.completeConsultantReview, {
        ...credential(token),
        advisoryNotes: "Too late.",
        outcome: "cleared",
      }),
    ).rejects.toThrow();
  });

  it("cannot be completed with a withdrawn review's token reused later", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, { expertRequestId });

    const review = await t.query(api.compliance_consultant.getReviewByToken, credential(token));
    expect(review).toBeNull();
  });

  it("marks a completed sign-off historical when the assessment later changes", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);
    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Cleared frozen packet.",
      outcome: "cleared",
    });

    await t.withIdentity(exporter).mutation(api.export_controls.addExportEvidence, {
      assessmentId,
      kind: "web_page",
      label: "New post-review evidence",
      url: "https://example.test/new-evidence",
    });

    const status = await t
      .withIdentity(exporter)
      .query(api.compliance_consultant.getConsultantDispatchStatus, { assessmentId });
    expect(status?.latestRequest?.status).toBe("superseded");

    await expect(
      t.withIdentity(exporter).mutation(api.compliance_consultant.createConsultantDispatch, {
        assessmentId,
        partnerSlug: PARTNER_SLUG,
        consultantRole: "adviser",
      }),
    ).resolves.toBeTruthy();
  });
});

describe("withdrawal", () => {
  it("cannot revoke an unrelated expert request", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const expertRequestId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("expert_requests", {
        assessmentId,
        requestedBy: exporter.subject,
        reasonCode: "internal_flag",
        status: "pending",
        assessmentSnapshot: {},
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      t
        .withIdentity(exporter)
        .mutation(api.compliance_consultant.revokeConsultantDispatch, { expertRequestId }),
    ).rejects.toThrow();
  });

  it("cannot withdraw a completed review", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Cleared.",
      outcome: "cleared",
    });

    await expect(
      t
        .withIdentity(exporter)
        .mutation(api.compliance_consultant.revokeConsultantDispatch, { expertRequestId }),
    ).rejects.toThrow();
  });

  it("refuses a withdrawal from someone outside the org", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { expertRequestId } = await reviewToken(t, assessmentId);

    await expect(
      t
        .withIdentity({
          subject: "user-intruder",
          tokenIdentifier: "test|user-intruder",
          org_id: "org-other",
        })
        .mutation(api.compliance_consultant.revokeConsultantDispatch, { expertRequestId }),
    ).rejects.toThrow();
  });
});

describe("evidence access", () => {
  async function seedEvidence(t: Harness, assessmentId: Id<"export_assessments">) {
    return await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["datasheet bytes"]));
      const documentId = await ctx.db.insert("documents", {
        userId: exporter.subject,
        // Same tenant as the assessment, or the document is correctly refused
        // entry to the review packet.
        orgId: exporter.org_id,
        fileName: "tim9.pdf",
        fileType: "application/pdf",
        fileId,
        fileSize: 15,
        uploadDate: new Date().toISOString(),
      });
      return await ctx.db.insert("export_evidence", {
        assessmentId,
        kind: "datasheet",
        label: "TIM-9 datasheet",
        documentId,
        addedBy: exporter.subject,
        addedAt: Date.now(),
      });
    });
  }

  it("rejects a document from another tenant before it can enter a review packet", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const foreignDocumentId = await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["foreign bytes"]));
      return await ctx.db.insert("documents", {
        userId: "user-intruder",
        orgId: "org-other",
        fileName: "foreign.pdf",
        fileType: "application/pdf",
        fileId,
        fileSize: 13,
        uploadDate: new Date().toISOString(),
      });
    });

    await expect(
      t.withIdentity(exporter).mutation(api.export_controls.addExportEvidence, {
        assessmentId,
        kind: "datasheet",
        label: "Foreign document",
        documentId: foreignDocumentId,
      }),
    ).rejects.toThrow();
  });

  it("keeps the frozen storage bytes after the live document is replaced", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const seeded = await t.run(async (ctx) => {
      const originalFileId = await ctx.storage.store(new Blob(["original bytes"]));
      const documentId = await ctx.db.insert("documents", {
        userId: exporter.subject,
        orgId: exporter.org_id,
        fileName: "original.pdf",
        fileType: "application/pdf",
        fileId: originalFileId,
        fileSize: 14,
        uploadDate: new Date().toISOString(),
      });
      const evidenceId = await ctx.db.insert("export_evidence", {
        assessmentId,
        orgId: exporter.org_id,
        kind: "datasheet",
        label: "Frozen document",
        documentId,
        addedBy: exporter.subject,
        addedAt: Date.now(),
      });
      return { documentId, evidenceId, originalFileId };
    });
    const { token } = await reviewToken(t, assessmentId);

    const expectedUrl = await t.run(async (ctx) => await ctx.storage.getUrl(seeded.originalFileId));
    await t.run(async (ctx) => {
      const replacementFileId = await ctx.storage.store(new Blob(["replacement bytes"]));
      await ctx.db.patch(seeded.documentId, {
        fileId: replacementFileId,
        fileName: "replacement.pdf",
      });
    });

    const file = await t.mutation(api.compliance_consultant.getReviewEvidenceByToken, {
      ...credential(token),
      evidenceId: seeded.evidenceId,
    });
    expect(file?.url).toBe(expectedUrl);
    expect(file?.fileName).toBe("original.pdf");
  });

  /**
   * The regression this guards: handing the browser a Convex storage URL leaves
   * a standing unauthenticated link to the file, outliving the review.
   */
  it("gives the review page a proxy path, never a storage URL", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    await seedEvidence(t, assessmentId);
    const { token } = await reviewToken(t, assessmentId);

    const review = await t.query(api.compliance_consultant.getReviewByToken, credential(token));
    const item = review!.evidence[0];

    expect(item.downloadUrl).toBe(
      `/api/export-controls/review-evidence/session/${item._id}`,
    );
    expect(item.downloadUrl?.startsWith("http")).toBe(false);
  });

  it("resolves the file for a valid token", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const evidenceId = await seedEvidence(t, assessmentId);
    const { token } = await reviewToken(t, assessmentId);

    const file = await t.mutation(api.compliance_consultant.getReviewEvidenceByToken, {
      ...credential(token),
      evidenceId,
    });
    expect(file?.fileName).toBe("tim9.pdf");
    expect(file?.contentType).toBe("application/pdf");
    expect(file?.url).toBeTruthy();
  });

  it("refuses an unknown token", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const evidenceId = await seedEvidence(t, assessmentId);

    const file = await t.mutation(api.compliance_consultant.getReviewEvidenceByToken, {
      token: "0".repeat(64),
      evidenceId,
    });
    expect(file).toBeNull();
  });

  /** Access must die with the review, not linger with the file. */
  it("refuses after the review is withdrawn", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const evidenceId = await seedEvidence(t, assessmentId);
    const { token, expertRequestId } = await reviewToken(t, assessmentId);

    await t
      .withIdentity(exporter)
      .mutation(api.compliance_consultant.revokeConsultantDispatch, { expertRequestId });

    const file = await t.mutation(api.compliance_consultant.getReviewEvidenceByToken, {
      ...credential(token),
      evidenceId,
    });
    expect(file).toBeNull();
  });

  /** A token opens one assessment's evidence, not the whole table. */
  it("refuses evidence belonging to another assessment", async () => {
    const t = createHarness();
    const mine = await seedAssessment(t);
    const theirs = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("export_assessments", {
        userId: "someone-else",
        reference: "EC-2026-99999",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
    });
    const foreignEvidenceId = await seedEvidence(t, theirs);
    const { token } = await reviewToken(t, mine);

    const file = await t.mutation(api.compliance_consultant.getReviewEvidenceByToken, {
      ...credential(token),
      evidenceId: foreignEvidenceId,
    });
    expect(file).toBeNull();
  });
});

/**
 * The review form makes the end-user acknowledgement mandatory once a statement
 * has been submitted, and posts which statement was ticked. That field reached
 * the completion route rejected — it was absent from the allowed-key list — so
 * any assessment carrying a completed undertaking could not be signed off at
 * all. These cover both halves: the field is accepted, and the gate it
 * represents is enforced here rather than only in the browser.
 */
describe("end-user statement acknowledgement", () => {
  async function reviewWithCompletedStatement(t: ReturnType<typeof createHarness>) {
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);
    const endUser = await t.mutation(api.compliance_end_user.createEndUserDispatch, {
      ...credential(token),
      redemptionCodeHash: redemptionCodeHash("acknowledged"),
      recipientEmail: "buyer@example.com",
    });
    const tokenId = endUser.tokenId as Id<"export_end_user_tokens">;
    await t.run(async (ctx) => ctx.db.patch(tokenId, { completedAt: Date.now() }));
    return { token, tokenId };
  }

  it("completes when the acknowledged statement is named", async () => {
    const t = createHarness();
    const { token, tokenId } = await reviewWithCompletedStatement(t);

    await t.mutation(api.compliance_consultant.completeConsultantReview, {
      ...credential(token),
      advisoryNotes: "Undertaking read and accepted.",
      outcome: "cleared",
      acknowledgedEndUserTokenId: tokenId,
    });

    const request = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("export_review_tokens")
        .withIndex("by_token_hash")
        .collect();
      const review = row.find((entry) => entry.assessmentId);
      return review ? ctx.db.get(review.expertRequestId) : null;
    });
    expect(request?.acknowledgedEndUserTokenId).toBe(tokenId);
    expect(typeof request?.acknowledgedEndUserAt).toBe("number");
  });

  it("refuses to complete when the statement is not acknowledged", async () => {
    const t = createHarness();
    const { token } = await reviewWithCompletedStatement(t);

    await expect(
      t.mutation(api.compliance_consultant.completeConsultantReview, {
        ...credential(token),
        advisoryNotes: "Cleared without reading the undertaking.",
        outcome: "cleared",
      }),
    ).rejects.toThrow();
  });

  it("refuses an acknowledgement naming a superseded statement", async () => {
    const t = createHarness();
    const assessmentId = await seedAssessment(t);
    const { token } = await reviewToken(t, assessmentId);

    const first = await t.mutation(api.compliance_end_user.createEndUserDispatch, {
      ...credential(token),
      redemptionCodeHash: redemptionCodeHash("first"),
      recipientEmail: "buyer@example.com",
    });
    const second = await t.mutation(api.compliance_end_user.createEndUserDispatch, {
      ...credential(token),
      redemptionCodeHash: redemptionCodeHash("second"),
      recipientEmail: "buyer@example.com",
    });
    await t.run(async (ctx) =>
      ctx.db.patch(second.tokenId as Id<"export_end_user_tokens">, {
        completedAt: Date.now(),
      }),
    );

    // The reviewer must acknowledge the statement that was actually returned,
    // not an earlier one that was superseded.
    await expect(
      t.mutation(api.compliance_consultant.completeConsultantReview, {
        ...credential(token),
        advisoryNotes: "Acknowledged the wrong undertaking.",
        outcome: "cleared",
        acknowledgedEndUserTokenId: first.tokenId as Id<"export_end_user_tokens">,
      }),
    ).rejects.toThrow();
  });
});
