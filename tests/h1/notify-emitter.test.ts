import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { notify } from "../../convex/lib/notify";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  eventForNotification,
  isCategoryLocked,
  normalizeDmsType,
  titleForNotification,
  type NotificationCategory,
} from "../../convex/lib/notification_events";

type Row = Record<string, unknown> & { _id: string };

/**
 * Minimal mock of the Convex mutation ctx surface `notify()` touches:
 *   db.query(table).withIndex(name, q => q.eq(f, v)...).take(n) | .first()
 *   db.insert(table, doc)
 *   db.patch(id, partial)
 */
function makeCtx(seed: { users?: Row[]; preferences?: Row[]; notifications?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    users: seed.users ? [...seed.users] : [],
    notification_preferences: seed.preferences ? [...seed.preferences] : [],
    app_notifications: seed.notifications ? [...seed.notifications] : [],
  };
  let autoId = 0;

  const ctx = {
    db: {
      query(table: string) {
        return {
          withIndex(_name: string, fn: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) {
            const criteria: Array<[string, unknown]> = [];
            const q = {
              eq(field: string, value: unknown) {
                criteria.push([field, value]);
                return q;
              },
            };
            fn(q);
            const matches = () =>
              (tables[table] ?? []).filter((row) =>
                criteria.every(([field, value]) => row[field] === value),
              );
            return {
              async take(n: number) {
                return matches().slice(0, n);
              },
              async first() {
                return matches()[0] ?? null;
              },
            };
          },
        };
      },
      async insert(table: string, doc: Record<string, unknown>) {
        const _id = `${table}_${++autoId}`;
        (tables[table] ??= []).push({ ...doc, _id });
        return _id;
      },
      async patch(id: string, partial: Record<string, unknown>) {
        for (const rows of Object.values(tables)) {
          const row = rows.find((r) => r._id === id);
          if (row) Object.assign(row, partial);
        }
      },
    },
  };

  return { ctx: ctx as never, tables };
}

const inbox = (tables: Record<string, Row[]>) => tables.app_notifications ?? [];

describe("notification event catalogue", () => {
  it("gives every event a category that exists", () => {
    for (const [event, definition] of Object.entries(NOTIFICATION_EVENTS)) {
      assert.ok(
        NOTIFICATION_CATEGORIES[definition.category as NotificationCategory],
        `${event} references unknown category ${definition.category}`,
      );
    }
  });

  it("maps every DMS code the status engine ranks to its event", () => {
    // Parity with convex/lib/notification_status.ts. A code ranked there but
    // unmapped here would surface in the inbox as a bare "HMRC notification",
    // which is the display gap this catalogue exists to close. Expectations are
    // explicit rather than "not the fallback", because DMSNOT legitimately maps
    // to the generic event and a negative assertion cannot tell the two apart.
    const expected: Record<string, string> = {
      DMSACC: "declaration.accepted",
      DMSCLE: "declaration.cleared",
      DMSCTL: "declaration.under_control",
      DMSDOC: "declaration.docs_requested",
      DMSINV: "declaration.invalidated",
      DMSNOT: "declaration.notification",
      DMSQRY: "declaration.query_raised",
      DMSRCV: "declaration.received",
      DMSREJ: "declaration.rejected",
      DMSREQ: "declaration.docs_requested",
      DMSRES: "declaration.response_required",
      DMSROG: "declaration.route_of_goods",
      DMSSUB: "declaration.received",
      DMSTAX: "declaration.tax_assessed",
    };
    for (const [code, event] of Object.entries(expected)) {
      assert.equal(eventForNotification({ notificationType: code }), event, code);
    }
  });

  it("falls back to the generic event for an unrecognised code", () => {
    assert.equal(
      eventForNotification({ notificationType: "DMSWAT" }),
      "declaration.notification",
    );
  });

  it("normalises legacy numeric and FUNC notification types", () => {
    assert.equal(normalizeDmsType("4"), "DMSTAX");
    assert.equal(normalizeDmsType("67"), "DMSTAX");
    assert.equal(normalizeDmsType("FUNC_11"), "DMSCLE");
    assert.equal(normalizeDmsType("dmsacc"), "DMSACC");
    assert.equal(normalizeDmsType(""), "UNKNOWN");
  });

  it("prefers amendment and cancellation context over the raw DMS code", () => {
    // DMSINV means "invalidated" normally but acknowledges an amendment in
    // context; reading the code alone reports the wrong outcome.
    assert.equal(
      eventForNotification({ notificationType: "DMSINV", isAmendmentAccepted: true }),
      "declaration.amendment_accepted",
    );
    assert.equal(
      eventForNotification({ notificationType: "DMSREJ", isCancellationRejected: true }),
      "declaration.cancellation_rejected",
    );
    assert.equal(
      eventForNotification({ notificationType: "DMSINV", isInvalidationAccepted: true }),
      "declaration.cancellation_accepted",
    );
    assert.equal(eventForNotification({ notificationType: "DMSINV" }), "declaration.invalidated");
  });

  it("keeps the DMS code visible in the title", () => {
    assert.equal(
      titleForNotification("declaration.rejected", "DMSREJ"),
      "Declaration rejected (DMSREJ)",
    );
    assert.equal(titleForNotification("declaration.stuck", undefined), "No HMRC response received");
  });

  it("locks the declaration category", () => {
    assert.equal(isCategoryLocked("declaration"), true);
    assert.equal(isCategoryLocked("clients"), false);
  });
});

describe("notify()", () => {
  it("delivers to the originator when there is no org", async () => {
    const { ctx, tables } = makeCtx();
    const written = await notify(ctx, { event: "validation.blocking_failure", userId: "user_a" });

    assert.equal(written, 1);
    assert.equal(inbox(tables).length, 1);
    assert.equal(inbox(tables)[0].userId, "user_a");
    assert.equal(inbox(tables)[0].orgId, undefined);
  });

  it("fans out to every member of the org", async () => {
    const { ctx, tables } = makeCtx({
      users: [
        { _id: "u1", clerkId: "user_a", orgId: "org_1" },
        { _id: "u2", clerkId: "user_b", orgId: "org_1" },
        { _id: "u3", clerkId: "user_c", orgId: "org_2" },
      ],
    });

    const written = await notify(ctx, {
      event: "declaration.rejected",
      userId: "user_a",
      orgId: "org_1",
    });

    assert.equal(written, 2);
    const recipients = inbox(tables).map((row) => row.userId).sort();
    assert.deepEqual(recipients, ["user_a", "user_b"]);
  });

  it("includes an originator with no users row", async () => {
    // First action after sign-up: the Clerk subject exists but the mirror row
    // may not, and dropping the event would lose it entirely.
    const { ctx, tables } = makeCtx({ users: [{ _id: "u1", clerkId: "user_b", orgId: "org_1" }] });

    await notify(ctx, { event: "declaration.accepted", userId: "user_new", orgId: "org_1" });

    const recipients = inbox(tables).map((row) => row.userId).sort();
    assert.deepEqual(recipients, ["user_b", "user_new"]);
  });

  it("respects a muted category", async () => {
    const { ctx, tables } = makeCtx({
      preferences: [
        { _id: "p1", userId: "user_a", orgId: undefined, category: "documents", inApp: false },
      ],
    });

    const written = await notify(ctx, { event: "documents.requirement_unmet", userId: "user_a" });

    assert.equal(written, 0);
    assert.equal(inbox(tables).length, 0);
  });

  it("ignores preferences for locked categories", async () => {
    // A stored row saying "off" must not silence a rejected declaration.
    const { ctx, tables } = makeCtx({
      preferences: [
        { _id: "p1", userId: "user_a", orgId: undefined, category: "declaration", inApp: false },
      ],
    });

    const written = await notify(ctx, { event: "declaration.rejected", userId: "user_a" });

    assert.equal(written, 1);
    assert.equal(inbox(tables).length, 1);
  });

  it("applies category defaults when no preference row exists", async () => {
    const { ctx, tables } = makeCtx();
    // `clients` defaults to off, `documents` to on.
    await notify(ctx, { event: "clients.created", userId: "user_a" });
    assert.equal(inbox(tables).length, 0);

    await notify(ctx, { event: "documents.replaced", userId: "user_a" });
    assert.equal(inbox(tables).length, 1);
  });

  it("collapses repeat events onto one row per recipient", async () => {
    const { ctx, tables } = makeCtx();

    await notify(ctx, {
      event: "documents.requirement_unmet",
      userId: "user_a",
      dedupeKey: "docs-unmet:decl_1",
      title: "2 documents missing",
    });
    const second = await notify(ctx, {
      event: "documents.requirement_unmet",
      userId: "user_a",
      dedupeKey: "docs-unmet:decl_1",
      title: "6 documents missing",
    });

    assert.equal(second, 0, "the repeat must not stack a second row");
    assert.equal(inbox(tables).length, 1);
    assert.equal(inbox(tables)[0].title, "6 documents missing", "the row must carry the latest state");
  });

  it("reopens a collapsed row that had been read", async () => {
    const { ctx, tables } = makeCtx();
    await notify(ctx, {
      event: "documents.requirement_unmet",
      userId: "user_a",
      dedupeKey: "docs-unmet:decl_1",
    });
    inbox(tables)[0].readAt = 1;

    await notify(ctx, {
      event: "documents.requirement_unmet",
      userId: "user_a",
      dedupeKey: "docs-unmet:decl_1",
    });

    assert.equal(inbox(tables)[0].readAt, undefined, "a recurrence must become unread again");
  });

  it("scopes dedupe per recipient", async () => {
    // A shared key would let the first recipient's row absorb everyone else's.
    const { ctx, tables } = makeCtx({
      users: [
        { _id: "u1", clerkId: "user_a", orgId: "org_1" },
        { _id: "u2", clerkId: "user_b", orgId: "org_1" },
      ],
    });

    await notify(ctx, {
      event: "declaration.docs_requested",
      userId: "user_a",
      orgId: "org_1",
      dedupeKey: "docs:decl_1",
    });

    assert.equal(inbox(tables).length, 2);
  });

  it("keeps portal rows off the staff audience", async () => {
    const { ctx, tables } = makeCtx({
      users: [{ _id: "u1", clerkId: "user_a", orgId: "org_1" }],
    });

    await notify(ctx, {
      event: "portal.message_received",
      clientId: "client_1" as never,
      orgId: "org_1",
      userId: "user_a",
    });

    assert.equal(inbox(tables).length, 1);
    const row = inbox(tables)[0];
    assert.equal(row.clientId, "client_1");
    assert.equal(row.userId, undefined, "a client row must never carry a staff recipient");
    assert.equal(row.orgId, undefined, "a client row must not be reachable by org scope");
  });

  it("carries severity and category from the catalogue", async () => {
    const { ctx, tables } = makeCtx();
    await notify(ctx, { event: "export_controls.sanctions_hit", userId: "user_a" });

    const row = inbox(tables)[0];
    assert.equal(row.severity, "critical");
    assert.equal(row.category, "export_controls");
  });

  it("never throws when the database fails", async () => {
    // The contract that keeps a notification failure from rolling back the
    // declaration write that triggered it.
    const brokenCtx = {
      db: {
        query() {
          throw new Error("db exploded");
        },
        insert() {
          throw new Error("db exploded");
        },
      },
    } as never;

    const written = await notify(brokenCtx, {
      event: "declaration.rejected",
      userId: "user_a",
      orgId: "org_1",
    });
    assert.equal(written, 0);
  });
});

/** Every .ts file under convex/, excluding generated output. */
function convexSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "_generated" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) convexSourceFiles(full, acc);
    else if (entry.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

describe("wired emitters", () => {
  /**
   * Every event key written at a call site must exist in the catalogue. A typo
   * would otherwise reach `eventDefinition()`, throw, and be swallowed by
   * notify()'s never-throw contract — the notification would vanish in
   * production with only a console line to show for it.
   */
  it("references only catalogue events across convex/", () => {
    const pattern = /"([a-z_]+\.[a-z_]+)"/g;
    const known = new Set(Object.keys(NOTIFICATION_EVENTS));
    const seen = new Set<string>();

    for (const file of convexSourceFiles("convex")) {
      const source = readFileSync(file, "utf8");
      // Only scan files that actually emit, so unrelated dotted strings
      // (index names, mime types) are not dragged in.
      if (!source.includes("notify(ctx")) continue;
      for (const [, candidate] of source.matchAll(pattern)) {
        if (known.has(candidate)) seen.add(candidate);
        else if (/^(declaration|validation|documents|export_controls|portal|finance|hmrc_auth|cns|billing|clients|representation|admin)\./.test(candidate)) {
          assert.fail(`${file} emits unknown event "${candidate}"`);
        }
      }
    }

    assert.ok(seen.size >= 10, `expected several wired events, found ${seen.size}`);
  });

  /** Each wired call site's event resolves to a usable row. */
  const WIRED: Array<[string, string, string]> = [
    ["validation.blocking_failure", "validation", "action_required"],
    ["validation.cleared", "validation", "info"],
    ["documents.requirement_unmet", "documents", "action_required"],
    ["documents.requirements_cleared", "documents", "info"],
    ["export_controls.sanctions_hit", "export_controls", "critical"],
    ["export_controls.licence_recorded", "export_controls", "info"],
    ["export_controls.expert_requested", "export_controls", "info"],
    ["portal.message_received", "portal", "action_required"],
    ["portal.document_uploaded", "portal", "info"],
    ["finance.variance_detected", "finance", "action_required"],
    ["hmrc_auth.disconnected", "hmrc_auth", "action_required"],
    ["cns.inventory_rejected", "cns", "critical"],
    ["billing.payment_failed", "billing", "critical"],
    ["billing.subscription_updated", "billing", "info"],
  ];

  for (const [event, category, severity] of WIRED) {
    it(`emits ${event}`, async () => {
      const { ctx, tables } = makeCtx();
      const written = await notify(ctx, {
        event: event as never,
        userId: "user_a",
        href: "/dashboard",
      });

      assert.equal(written, 1, `${event} produced no row`);
      const row = inbox(tables)[0];
      assert.equal(row.category, category);
      assert.equal(row.severity, severity);
      assert.ok(String(row.title ?? "").length > 0, "row must carry a title");
    });
  }

  it("delivers a client-portal event to the client, not the org", async () => {
    // Both portal emitters pass orgId so the broker sees them. This asserts the
    // inverse direction still isolates correctly when clientId is supplied.
    const { ctx, tables } = makeCtx({
      users: [{ _id: "u1", clerkId: "staff_a", orgId: "org_1" }],
    });

    await notify(ctx, {
      event: "portal.document_uploaded",
      clientId: "client_1" as never,
      orgId: "org_1",
      userId: "staff_a",
    });

    assert.equal(inbox(tables).length, 1);
    assert.equal(inbox(tables)[0].clientId, "client_1");
    assert.equal(inbox(tables)[0].userId, undefined);
  });

  it("keeps every wired severity within the catalogue's union", async () => {
    for (const [event] of WIRED) {
      const definition = NOTIFICATION_EVENTS[event as keyof typeof NOTIFICATION_EVENTS];
      assert.ok(definition, `${event} missing from catalogue`);
      assert.ok(
        ["critical", "action_required", "info"].includes(definition.severity),
        `${event} has severity ${definition.severity}`,
      );
    }
  });
});
