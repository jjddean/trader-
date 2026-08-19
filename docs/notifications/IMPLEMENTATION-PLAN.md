# App Notification Pipeline — Implementation Plan

Status: **built and audited**. Steps 0–12 implemented 2026-08-18. Deployed to dev only.
See §8 for the audit and the remaining work to close.
Author: agent audit, 2026-08-17.

## Build state

| Step | State |
|------|-------|
| 0 Widen stuck statuses | **reverted 2026-08-18.** It was built, then removed: the widened sweep re-polled each eligible declaration hourly for up to 7 days (~168 HMRC calls each), because no per-declaration cooldown exists and an unproductive poll leaves `lastUpdated` untouched. Its justification also lapsed — the status page's manual **Pull notifications** button was never removed, so the hole it closed was narrow. Recovery is back to the three genuinely-stuck states |
| 1–7 Schema, catalogue, `notify()`, inbox API, preferences, HMRC mirror, backfill | done |
| 8 Inbox panel | done — panel only. The full-history page and its footer link were built, then removed on request; `listPaginated` and the orphaned `getUserNotifications` went with them |
| 10 Settings toggles | done — `NotificationPreferences` in `src/app/dashboard/settings/page.tsx` |
| 11 Emitter wiring | **partial** — wired: declaration (HMRC mirror), validation, documents, export_controls (sanctions/licence/expert), portal (message + upload), finance (variance), hmrc_auth (disconnect), cns (inventory reject), billing (cancel + payment failure). Not wired: clients, representation, admin, `documents.expiring`, `documents.upload_failed` (lives in Next.js routes, needs an internal mutation), `hmrc_auth.refresh_failed`, `cns.poll_failures_exceeded`, `billing.limit_reached`, `finance.obligation_due` |
| 12 Tests | done — `tests/h1/notify-emitter.test.ts` (36 cases incl. a call-site scanner) and `e2e/auth/notification-centre.spec.ts` (3 browser journeys) |

Severity floor (§5, mechanism 3) is **not** implemented; preferences are a
per-category boolean. Transition-only emission and dedupe collapse are.

Verification: `tsc --noEmit` clean, `lint:security` clean at `--max-warnings 0`,
521 tests passing (h1 198, unit 94, cns 133, export-controls 68, tre 28), plus 3
Playwright journeys against a real Clerk user.

Backfill has been run on **dev only** — 379 rows over 6 batches, all written
already-read. Production has not been backfilled and the code is not deployed
there.

Scope agreed: full event pipeline across the whole app. Email/digest delivery is
**out of scope** for this pass, but the schema must not preclude it.

---

## 1. Current state (audited, not assumed)

| Fact | Evidence |
|------|----------|
| `notifications` has exactly one writer, `saveWebhook`, gated by `assertIngestSecret` | `convex/notifications.ts:41` |
| Its callers are the HMRC push webhook, the pull route, and the CNS DMS branch | `src/app/api/hmrc/webhooks/notify/route.ts`, `src/app/api/hmrc/notifications/pull/route.ts`, `convex/cns_notifications.ts:373` |
| DMS **status** mapping is complete — all 14 codes ranked and mapped | `convex/lib/notification_status.ts:6-59` |
| DMS **display** covers only 8 codes. `DMSDOC`, `DMSQRY`, `DMSREQ`, `DMSRES`, `DMSNOT`, `DMSSUB` hit the generic default | `src/lib/notification-labels.ts:35-58` |
| Nothing ever sets `processed: true` on a `notifications` row, so the bell's unread count never clears | `src/components/dashboard-header.tsx:69` |
| "View All Notifications" has no handler; no `/dashboard/notifications` route exists | `src/components/dashboard-header.tsx:195` |
| Bell branches on `GOODS_ARRIVED` / `DOCUMENTS_REQUIRED` — types no code produces | `src/components/dashboard-header.tsx:163-166` |
| Settings → Notifications is three hardcoded `<span>` badges; no preferences table, no mutation, no reader | `src/app/dashboard/settings/page.tsx:536-563` |
| Tenant scoping helper already exists and is correct | `convex/lib/org_access.ts:180` |

### The governing constraint

`CLAUDE.md` → Notifications:

> `notificationType` from HMRC-sourced events only — never synthesise DMS\*
> notifications. The `notifications` table is immutable append-only.

**This forbids overloading `notifications` with app events.** The plan therefore
adds a second table rather than widening the first. The HMRC table stays exactly
as it is — an append-only evidence log of what CDS actually sent.

---

## 2. Architecture

```
Domain mutation (declarations, documents, export_controls, portal, …)
  └─ writes its own row
  └─ refreshReadModels(ctx, declarationId)      ← existing rule, unchanged
  └─ notify(ctx, {...})                          ← NEW, non-throwing
        └─ resolves audience (user | org | client-portal contact)
        └─ checks notification_preferences for that (audience, category)
        └─ inserts app_notifications row, or drops it

HMRC ingest (saveWebhook)  ── unchanged evidence write to `notifications`
  └─ then notify(ctx, { sourceTable: "notifications", sourceId })   ← mirror row

Read path
  └─ app_notifications ONLY. One table, one index, one unread count.
```

Mirror-on-ingest is chosen over read-time federation because federation makes
read/unread state, pagination, and preference filtering impossible to express in
a single Convex index. The mirror row is a *derived app-layer pointer*, not a
synthesised DMS notification — it never fabricates a `notificationType` and
always carries `sourceId` back to the evidence row.

### `notify()` contract

`convex/lib/notify.ts`, internal only.

- **Must never throw.** Same rule already applied to audit logging in
  `src/app/api/**` — a notification failure must not roll back a declaration
  write. Wrap the insert in try/catch and swallow.
- **Must be called after** `refreshReadModels` / preview upserts, so anything the
  notification links to is already consistent.
- **Idempotent** on `(dedupeKey)` where the caller supplies one. Required for the
  HMRC mirror (push and pull deliver the same notification) and for cron-driven
  emitters that re-evaluate the same condition each run.
- Takes a **typed event key**, not a free string. A union type in
  `convex/lib/notification_events.ts` is the single source of truth for the
  catalogue in §4 and drives both the preference matrix and the display labels.

---

## 3. Schema

### 3.1 `app_notifications`

```ts
app_notifications: defineTable({
  // Addressing — exactly one audience is set.
  userId: v.optional(v.string()),        // Clerk subject
  orgId: v.optional(v.string()),         // org-wide; every member sees it
  clientId: v.optional(v.id("clients")), // client-portal contact audience

  // Classification
  event: v.string(),                     // typed key, §4
  category: v.string(),                  // declaration | validation | documents | …
  severity: v.union(
    v.literal("critical"),               // blocks the trade / money at risk
    v.literal("action_required"),        // user must do something
    v.literal("info"),                   // FYI, collapsible
  ),

  // Presentation — resolved at emit time so history is stable if labels change
  title: v.string(),
  body: v.optional(v.string()),
  href: v.optional(v.string()),          // deep link, e.g. /dashboard/declarations/<id>

  // Linkage
  declarationId: v.optional(v.id("declarations")),
  sourceTable: v.optional(v.string()),   // "notifications" for the HMRC mirror
  sourceId: v.optional(v.string()),
  metadata: v.optional(v.any()),

  // State — distinct from the HMRC table's `processed`
  readAt: v.optional(v.number()),
  dismissedAt: v.optional(v.number()),
  dedupeKey: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_user_created", ["userId", "createdAt"])
  .index("by_org_created", ["orgId", "createdAt"])
  .index("by_client_created", ["clientId", "createdAt"])
  .index("by_declaration", ["declarationId"])
  .index("by_dedupeKey", ["dedupeKey"])
  .index("by_user_unread", ["userId", "readAt"])
  .index("by_org_unread", ["orgId", "readAt"]),
```

Notes:
- `createdAt` is explicit rather than relying on `_creationTime` because the
  index needs it as a sort key alongside the tenant field.
- Unread count uses the `*_unread` indexes with `readAt === undefined`, not a
  client-side filter over a `take(15)`.
- `clientId` audience is mandatory, not optional polish: `convex/client_portal.ts`
  exposes a whole surface to external client contacts. Without a distinct
  audience, wiring portal events would leak broker-internal notifications to
  customers.

### 3.2 `notification_preferences`

```ts
notification_preferences: defineTable({
  userId: v.string(),
  orgId: v.optional(v.string()),   // per-org override; undefined = personal
  category: v.string(),
  inApp: v.boolean(),
  email: v.boolean(),              // stored now, not delivered this pass
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_org_category", ["userId", "orgId", "category"])
  .index("by_user", ["userId"]),
```

Absent row = category default from the matrix in §4. Rows are written only when
a user changes a toggle, so no backfill is needed.

---

## 4. Event catalogue

Derived from real exported mutations and real `audit.logAction` strings in the
repo — not invented. `A` = action_required, `C` = critical, `I` = info.
"Default" is the shipped in-app default when the user has no preference row.

### `declaration` — default **on**, cannot be disabled

| Event | Sev | Source |
|-------|-----|--------|
| `declaration.accepted` (DMSACC) | I | HMRC mirror |
| `declaration.cleared` (DMSCLE) | I | HMRC mirror |
| `declaration.rejected` (DMSREJ) | C | HMRC mirror |
| `declaration.invalidated` (DMSINV) | C | HMRC mirror |
| `declaration.under_control` (DMSCTL) | A | HMRC mirror |
| `declaration.route_of_goods` (DMSROG) | A | HMRC mirror |
| `declaration.docs_requested` (DMSDOC / DMSREQ) | A | HMRC mirror |
| `declaration.query_raised` (DMSQRY) | A | HMRC mirror |
| `declaration.response_required` (DMSRES) | A | HMRC mirror |
| `declaration.tax_assessed` (DMSTAX) | I | HMRC mirror |
| `declaration.amendment_accepted` / `_rejected` | I / A | `notification_dms_context` flags |
| `declaration.cancellation_accepted` / `_rejected` | I / A | same |
| `declaration.mrn_assigned` | I | `notifications.ts:244` patch |
| `declaration.stuck` | A | `hmrc_actions.recoverStuckDeclarations` cron |

This category resolves the "DMS not active" gap: all 14 codes get a label, an
`href` to the declaration, and an action line. Labels move from
`src/lib/notification-labels.ts` into the shared event definition so display and
status logic stop drifting.

### `validation` — default **on**

`validation.blocking_failure`, `validation.cleared`, `completeness.dropped_below_threshold`
— from `convex/validation_results.ts:43` (`recompute`) and
`convex/declaration_completeness.ts`. Emit **only on transition**, never on every
recompute; recompute runs on each item edit and would otherwise be the single
largest noise source in the app.

### `documents` — default **on**

`documents.requirement_added`, `documents.requirement_unmet`,
`documents.upload_failed` (`doc_action_error`, `smart_upload_error`),
`documents.replaced`, `documents.expiring`. Sources: `convex/documents.ts:145,
342, 572`, `src/app/api/ai/smart-upload`.

### `export_controls` — default **on**

`export_controls.classification_reviewed` (`:588`),
`export_controls.sanctions_hit` (**C**, `:621` / `:659`),
`export_controls.licence_required`, `export_controls.licence_recorded` (`:728`),
`export_controls.expert_requested` (`:686`),
`export_controls.consultant_review_completed`,
`export_controls.end_user_statement_submitted`.

`sanctions_hit` is `critical` and should be exempt from user disabling.

### `portal` — default **on**, dual audience

`portal.invite_sent`, `portal.access_enabled`, `portal.access_revoked`,
`portal.message_received`, `portal.document_uploaded`. Sources:
`convex/client_portal.ts:853, 1013` and the `client_portal_*` audit actions.
Each of these needs an explicit audience decision — a client message notifies the
**broker** (`orgId`), a status change notifies the **client** (`clientId`).

### `finance` — default **on**

`finance.variance_detected` (`financial_variance_detected`),
`finance.obligation_due` (`convex/financial_obligations.ts`).

### `hmrc_auth` — default **on**, org-wide

`hmrc_auth.linked`, `hmrc_auth.disconnected`, `hmrc_auth.refresh_failed`.
The third does not exist yet and is worth adding: a failed refresh in
`convex/lib/hmrc_token_refresh.ts` currently surfaces only when a submission
fails. Org-wide audience because any member's submission breaks.

### `cns` — default **on**, org-wide

`cns.inventory_rejected` (`convex/cns_notifications.ts:355`),
`cns.poll_failures_exceeded` (threshold already configured as
`maxConsecutivePollFailuresBeforeAlert`, `src/lib/cns/config.ts:126` — currently
counted but not surfaced anywhere).

### `billing` — default **on**

`billing.subscription_updated`, `billing.payment_failed`, `billing.limit_reached`.
Sources: `convex/stripe_webhooks.ts`, `convex/subscriptions.ts:17`.

### `clients` / `representation` / `admin` — default **off**

`clients.created`, `clients.updated`, `representation.details_updated`,
`representation.indirect_approved`, `representation.approval_revoked`,
`admin.tre_import_completed`, `admin.data_export`,
`admin.sanctions_snapshot_stale`. Low signal; opt-in.

---

## 5. Noise control

"100s of events" is the real risk. Three mechanisms, all in `notify()`:

1. **Transition-only emission.** Emitters pass the previous value; `notify()`
   drops the event when it did not change. Non-negotiable for `validation` and
   `completeness`, which recompute on every keystroke-level edit.
2. **`dedupeKey` collapse.** e.g. `docs-unmet:<declarationId>` means a
   declaration with six missing documents produces one row, updated, not six.
3. **Severity floor per category.** A category set to "important only" in
   preferences drops `info` rows at emit time, so they never occupy the inbox.

---

## 5a. Target inbox design

The inbox UI is ported from `jjddean/freightcode.production-`,
`src/components/ui/notification-center.tsx` (274 lines). Reference copy pulled to
the session scratchpad. It is the agreed design — panel with `All / Unread /
Urgent` count tabs, per-row priority left-border, icon by type, relative
timestamps, "Mark all as read", 📭 empty state, `99+` badge cap, footer link.

Its data shape maps 1:1 onto §3.1, so the component ports as-is apart from:

| Change | Reason |
|--------|--------|
| `react-router-dom` `useNavigate` → `next/navigation` `useRouter` | App Router |
| Drop `@ts-nocheck`, type the `(n: any)` maps | TS strict, per CLAUDE.md |
| Drop `useStickyQueryData` | Hook does not exist here; Convex loading state covers it |
| `priority` → `severity`; Urgent tab filters `critical \| action_required` | §3.1 |
| `read` → `readAt` | `processed` on the HMRC table is a pipeline flag, not read state |
| Icons by `category` via the §4 catalogue, not a local switch | Single source of truth |

The old app's Convex functions are **not** ported. Its `markRead` has no auth or
ownership check, its `create` is a public client-callable insert, and its
`getUnreadCount` / `markAllRead` `.collect()` every unread row. Steps 4 and 5
below replace all four.

---

## 6. Work breakdown

| # | Step | Files |
|---|------|-------|
| 1 | Schema: two tables + indexes | `convex/schema.ts` |
| 2 | Event catalogue as a typed union + label/severity/href resolver | `convex/lib/notification_events.ts` (new) |
| 3 | `notify()` helper — audience resolution, preference check, dedupe, non-throwing | `convex/lib/notify.ts` (new) |
| 4 | Queries + mutations: `listInbox` (paginated), `unreadCount`, `markRead`, `markAllRead`, `dismiss` | `convex/app_notifications.ts` (new) |
| 5 | Preferences: `getPreferences`, `setPreference` with default-matrix merge | `convex/notification_preferences.ts` (new) |
| 6 | HMRC mirror: call `notify()` at the end of `saveWebhook`, `dedupeKey = hmrcNotificationId` | `convex/notifications.ts:266` |
| 7 | Backfill: paginated internal mutation creating mirror rows for existing `notifications`, all marked read | `convex/notifications_backfill.ts` (new), run once |
| 8 | Port the §5a component as `notification-center.tsx`; mount it in the header in place of the current dropdown, removing the two phantom branches | `src/components/notification-center.tsx` (new), `src/components/dashboard-header.tsx:130-200` |
| 9 | `/dashboard/notifications` — same filters, paginated, as the footer link target | `src/app/dashboard/notifications/page.tsx` (new) |
| 10 | Settings tab: replace the three static badges with real toggles bound to `setPreference` | `src/app/dashboard/settings/page.tsx:536` |
| 11 | Emitter wiring, one category per commit, in the order: declaration → validation → documents → export_controls → portal → finance → hmrc_auth → cns → billing | per §4 |
| 12 | Tests: `notify()` dedupe + preference gating + audience isolation; portal-leak test asserting a `clientId` row is invisible to org queries and vice versa | `tests/notifications/` (new) |

Steps 1–8 are the working core. Step 11 is where the volume is and is
deliberately last and incremental — each category is independently shippable.

---

## 7. Decisions

1. **Delivery model — RESOLVED: fan-out.** One row per recipient, `userId`
   always set, `orgId` carried as a scoping tag. Not one shared org row plus a
   `notification_reads` join table.

   Rationale: preferences are per-user, so they can only be applied at emit time
   if each recipient has their own row. A shared row forces per-viewer filtering
   at read time, which breaks the indexed unread count — the exact defect the
   current bell has (`dashboard-header.tsx:69` counts client-side over
   `take(15)`). Per-user read state falls out for free. Row cost is negligible at
   expected org sizes.

   Consequence: §3.1 stands unchanged, and `notify()` owns the recipient fan-out
   — resolving org membership, filtering each recipient by preference, then
   inserting N rows.

2. **Retention.** Unbounded growth otherwise. Proposal: a daily cron deleting
   read `info` rows older than 90 days; `critical` and `action_required` kept
   indefinitely. The HMRC evidence table is never touched.
3. **Backfill depth** — all historical `notifications`, or only the last N days?

---

## 8. Audit and close-out (2026-08-18)

Verified: `tsc --noEmit` clean; `lint:security` clean at `--max-warnings 0`;
521 unit/integration tests passing; 3 Playwright journeys passing against a real
Clerk user and a real browser.

### Fixed during the audit

`documents.requirement_added` was being emitted when requirements were *cleared*,
carrying the title "All required documents supplied". The title override hid it
in the UI, but the event key is what any later consumer keys on — preference
sub-filters, email templates, analytics — so the row was mislabelled at source.
Added `documents.requirements_cleared` and repointed the emitter.

### Known gaps, deliberate

| Gap | Why it is acceptable | Cost to close |
|-----|---------------------|---------------|
| **26 catalogue events declared but never emitted** (clients, representation, admin, and the unwired half of documents/export_controls/portal/finance) | The catalogue is the specification; an unwired entry is a visible to-do, and `notify()` rejects anything not declared | ~1 call site each |
| **2 events unreachable by construction** — `declaration.mrn_assigned`, `declaration.stuck` | Neither is produced by `eventForNotification()`; `stuck` needs the recovery cron, which is an `internalAction` and cannot call `notify()` without a mutation wrapper | wrapper + 1 call site |
| **No retention** | `app_notifications` grows without bound; fan-out multiplies it by org size | 1 cron + 1 internal mutation |
| **`markAllRead` caps at 500** | Bounded on purpose — the old app's `.collect()` over every unread row is what fails at volume. Above 500 the button silently marks only the first page | loop or repeat-until-zero |
| **Portal rows bypass preferences** | Client contacts have no preferences UI, so there is nothing to read | needs a portal settings surface first |
| **`documents.upload_failed` unwired** | The failure path lives in Next.js API routes, which cannot call `notify()` directly | 1 internal mutation |
| **Severity floor (§5 mechanism 3)** | Preferences are a per-category boolean. Transition-only emission and dedupe collapse — the two mechanisms that actually control volume — are both in | preference model change |

### To close the case

1. **Deploy.** `npx convex deploy` pushes schema + functions to production. Additive
   schema; the `notify()` call inside `saveWebhook` is wrapped and cannot break
   HMRC ingest.
2. **Run the backfill on production** — optional. `notifications_backfill:backfillMirrorRows`,
   `{}` then the returned cursor until `isDone`. Dev took 6 batches for 379 rows.
   Local data only, no HMRC calls. Skip it and the inbox simply starts empty and
   fills as new notifications arrive.
3. **Add retention before volume builds**, per the table above.

Backfill has been run on `dev:glorious-marlin-243` only (379 rows, all marked read).
