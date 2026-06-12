import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectDeclarationNotifications } from "../../convex/lib/collect_declaration_notifications";
import { buildHmrcNotificationIdempotencyKey } from "../../src/lib/hmrc-notification-idempotency";

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

describe("resubmit notification timeline", () => {
  const CONV_OLD = "CONV_OLD";
  const CONV_NEW = "CONV_NEW";
  const MRN_OLD = "MRN_OLD";
  const MRN_NEW = "MRN_NEW";
  const DECL = "decl_1";

  it("returns only new conversation rows for the current MRN", async () => {
    const rows: Row[] = [
      { _id: "n_old_acc", mrn: MRN_OLD, conversationId: CONV_OLD, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-05T09:00:00Z" },
      { _id: "n_new_acc", mrn: MRN_NEW, conversationId: CONV_NEW, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T10:00:00Z" },
    ];

    const result = await collectDeclarationNotifications(makeDb(rows), {
      declarationId: DECL as never,
      conversationId: CONV_NEW,
      mrn: MRN_NEW,
    });

    assert.deepEqual(result.map((r) => r._id), ["n_new_acc"]);
  });

  it("includes MRN-only rows when called by MRN", async () => {
    const rows: Row[] = [
      { _id: "n_mrn_only", mrn: MRN_OLD, conversationId: undefined, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-04T09:00:00Z" },
    ];

    const result = await collectDeclarationNotifications(makeDb(rows), {
      declarationId: undefined as never,
      conversationId: undefined,
      mrn: MRN_OLD,
    });

    assert.deepEqual(result.map((r) => r._id), ["n_mrn_only"]);
  });

  it("excludes stale MRN rows when newer conversation and MRN are provided", async () => {
    const rows: Row[] = [
      { _id: "n_stale", mrn: MRN_OLD, conversationId: CONV_OLD, declarationId: DECL, notificationType: "DMSINV", timestamp: "2026-06-01T09:00:00Z" },
      { _id: "n_current", mrn: MRN_NEW, conversationId: CONV_NEW, declarationId: DECL, notificationType: "DMSACC", timestamp: "2026-06-06T10:00:00Z" },
    ];

    const result = await collectDeclarationNotifications(makeDb(rows), {
      declarationId: DECL as never,
      conversationId: CONV_NEW,
      mrn: MRN_NEW,
    });

    assert.equal(result.some((r) => r._id === "n_stale"), false);
    assert.equal(result.some((r) => r._id === "n_current"), true);
  });

  it("builds the same idempotency key for push and pull payload copies", () => {
    const payload = "<MetaData><Response><FunctionCode>03</FunctionCode></Response></MetaData>";

    assert.equal(
      buildHmrcNotificationIdempotencyKey(`\r\n${payload}\r\n`),
      buildHmrcNotificationIdempotencyKey(`\n${payload}\n`),
    );
  });
});
