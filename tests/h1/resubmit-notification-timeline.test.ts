import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectDeclarationNotifications } from "../../convex/lib/collect_declaration_notifications";

type Row = {
  _id: string;
  mrn?: string | null;
  conversationId?: string | null;
  declarationId?: string | null;
  notificationType?: string | null;
  timestamp?: string | number;
};

// Copy of the makeDb mock from tests/h1/collect-declaration-notifications.test.ts
function makeDb(rows: Row[]) {
  return {
    query(_table: string) {
      return {
        withIndex(_indexName: string, fn: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) {
          let field = "";
          let value: unknown = undefined;
          const q = {
            eq(f: string, v: unknown) {
              field = f;
              value = v;
              return q;
            },
          };
          fn(q);
          return {
            async take(n: number) {
              return rows
                .filter((r) => (r as Record<string, unknown>)[field] === value)
                .slice(0, n);
            },
          };
        },
      };
    },
  } as never;
}

describe("resubmit notification timeline", () => {
  const CONV_OLD = "CONV_OLD";
  const CONV_NEW = "CONV_NEW";
  const MRN_OLD = "MRN_OLD";
  const MRN_NEW = "MRN_NEW";
  const DECL = "decl_1";

  it("Re-submit scenario: returns only new conversation rows", async () => {
    const rows: Row[] = [
      { _id: "n_old_acc", mrn: MRN_NEW, conversationId: CONV_OLD, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-05T09:00:00Z" },
      { _id: "n_new_acc", mrn: MRN_NEW, conversationId: CONV_NEW, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T10:00:00Z" },
    ];

    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, { declarationId: DECL as never, conversationId: CONV_NEW, mrn: MRN_NEW });
    const ids = result.map((r) => r._id).sort();
    assert.deepEqual(ids, ["n_new_acc"]);
  });

  it("MRN-only rows included when called by MRN", async () => {
    const rows: Row[] = [
      { _id: "n_mrn_only", mrn: MRN_OLD, conversationId: undefined, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-04T09:00:00Z" },
    ];
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, { declarationId: undefined as never, conversationId: undefined, mrn: MRN_OLD });
    const ids = result.map((r) => r._id).sort();
    assert.deepEqual(ids, ["n_mrn_only"]);
  });

  it("Stale MRN excluded when newer conversation+MRN provided", async () => {
    const rows: Row[] = [
      { _id: "n_stale", mrn: MRN_OLD, conversationId: CONV_OLD, declarationId: DECL, notificationType: "DMSINV", timestamp: "2026-06-01T09:00:00Z" },
      { _id: "n_current", mrn: MRN_NEW, conversationId: CONV_NEW, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T10:00:00Z" },
    ];
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, { declarationId: DECL as never, conversationId: CONV_NEW, mrn: MRN_NEW });
    assert.equal(result.some((r) => r._id === "n_stale"), false);
    assert.equal(result.some((r) => r._id === "n_current"), true);
  });

  it("Dedup by _id when returned from multiple indexes", async () => {
    // Simulate the same row being returned from both index paths by including
    // it duplicate in the source set but with same _id — makeDb filters by
    // field equality so the collector's seen set should dedupe it.
    const dupRow: Row = { _id: "n_dup", mrn: MRN_NEW, conversationId: CONV_NEW, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T10:00:00Z" };
    const rows: Row[] = [dupRow, dupRow];
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, { declarationId: DECL as never, conversationId: CONV_NEW, mrn: MRN_NEW });
    const count = result.filter((r) => r._id === "n_dup").length;
    assert.equal(count, 1);
  });
});
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectDeclarationNotifications } from "../../convex/lib/collect_declaration_notifications";

type Row = {
  _id: string;
  mrn?: string | null;
  conversationId?: string | null;
  declarationId?: string | null;
  notificationType?: string | null;
  timestamp?: string | number;
};

function makeDb(rows: Row[]) {
  return {
    query(_table: string) {
      return {
        withIndex(_indexName: string, fn: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) {
          let field = "";
          let value: unknown = undefined;
          const q = {
            eq(f: string, v: unknown) {
              field = f;
              value = v;
              return q;
            },
          };
          fn(q);
          return {
            async take(n: number) {
              return rows
                .filter((r) => (r as Record<string, unknown>)[field] === value)
                .slice(0, n);
            },
          };
        },
      };
    },
  } as never;
}

describe("resubmit timeline case", () => {
  it("returns new-MRN notifications when declarationId/conversationId provided despite stale mrn arg", async () => {
    const DECL = "decl_42";
    const OLD_MRN = "26GBOLDMRN123456789";
    const NEW_MRN = "26GBNEWMRN987654321";
    const NEW_CONV = "conv-new-1";

    const rows: Row[] = [
      // New accepted notification (arrived under NEW_MRN + NEW_CONV)
      { _id: "n_new_acc", mrn: NEW_MRN, conversationId: NEW_CONV, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T12:00:00Z" },
      // Old notification tied to OLD_MRN (should not block visibility of the new one)
      { _id: "n_old", mrn: OLD_MRN, conversationId: "conv-old", declarationId: DECL, notificationType: "DMSREJ", timestamp: "2026-06-05T11:00:00Z" },
    ];

    const db = makeDb(rows);

    // Simulate declarations.getWebhooks path where declarationId and conversationId are available
    const result = await collectDeclarationNotifications(db, {
      declarationId: DECL as never,
      conversationId: NEW_CONV,
      mrn: OLD_MRN, // stale MRN stored on the declaration
    });

    const ids = result.map((r) => r._id);
    assert.ok(ids.includes("n_new_acc"), "expected new DMSACC to be present in timeline");
  });
});
