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

/**
 * Minimal mock of the Convex db surface used by collectDeclarationNotifications:
 * db.query(table).withIndex(name, q => q.eq(field, value)).take(n)
 */
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

describe("collectDeclarationNotifications", () => {
  const CONV_CURRENT = "75b5e784-current";
  const CONV_OLD = "01382a81-old";
  const MRN = "26GB664W3BLIFZFAR4";
  const DECL = "decl_1";

  const rows: Row[] = [
    // Current submit cycle — should appear when conversationId = CONV_CURRENT
    { _id: "n_acc_current", mrn: MRN, conversationId: CONV_CURRENT, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T10:00:00Z" },
    { _id: "n_tax_current", mrn: MRN, conversationId: CONV_CURRENT, declarationId: DECL, notificationType: "DMSTAX", timestamp: "2026-06-06T10:01:00Z" },
    // Old amend cycle on the same MRN/declaration — must NOT replay into current cycle
    { _id: "n_old_amend", mrn: MRN, conversationId: CONV_OLD, declarationId: DECL, notificationType: "DMSINV", timestamp: "2026-06-05T09:00:00Z" },
    // Unrelated declaration / MRN
    { _id: "n_other", mrn: "26GBOTHER", conversationId: "other-conv", declarationId: "decl_other", notificationType: "DMSACC", timestamp: "2026-06-04T09:00:00Z" },
  ];

  it("returns only the current conversation's notifications when conversationId is set", async () => {
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, {
      declarationId: DECL as never,
      conversationId: CONV_CURRENT,
      mrn: MRN,
    });
    const ids = result.map((r) => r._id).sort();
    assert.deepEqual(ids, ["n_acc_current", "n_tax_current"]);
  });

  it("excludes old-cycle notifications on the same MRN when conversationId is set", async () => {
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, {
      declarationId: DECL as never,
      conversationId: CONV_CURRENT,
      mrn: MRN,
    });
    assert.equal(result.some((r) => r._id === "n_old_amend"), false);
  });

  it("falls back to declaration + MRN scope when no conversationId is provided", async () => {
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, {
      declarationId: DECL as never,
      conversationId: undefined,
      mrn: MRN,
    });
    const ids = result.map((r) => r._id).sort();
    // All same-declaration/same-MRN rows, but not the unrelated declaration.
    assert.deepEqual(ids, ["n_acc_current", "n_old_amend", "n_tax_current"]);
    assert.equal(result.some((r) => r._id === "n_other"), false);
  });

  it("sorts newest first", async () => {
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, {
      declarationId: DECL as never,
      conversationId: CONV_CURRENT,
      mrn: MRN,
    });
    assert.equal(result[0]._id, "n_tax_current");
  });

  it("dedupes a row matched by both conversationId and declaration indexes", async () => {
    const db = makeDb(rows);
    const result = await collectDeclarationNotifications(db, {
      declarationId: DECL as never,
      conversationId: CONV_CURRENT,
      mrn: MRN,
    });
    const accCount = result.filter((r) => r._id === "n_acc_current").length;
    assert.equal(accCount, 1);
  });
});
