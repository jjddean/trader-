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
