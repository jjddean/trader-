# CNS Inventory-Linked Imports — Repository Map & Build Plan

Status: **M0 complete (repo mapped). No code written yet.**
Date: 7 August 2026
Governing spec: `FreightCode_CNS_Inventory_Linked_Imports_Implementation_Specification_v1.1.docx`

This document is the M0 deliverable required by spec §3.1 ("Mandatory repository
discovery") and Appendix C M0 ("Locate existing services/schema/actions; document
exact files and interfaces"). It replaces the spec's *illustrative* module map
(§3.2) with the real one.

---

## 0. Source pack roles

| Doc | Role in this build |
|-----|--------------------|
| `FreightCode_CNS_..._v1.1.docx` | **The plan.** Everything below implements it. |
| `Customs-Declaration-API v 1.0.3.docx` | Normative: endpoints, headers, 202/X-CSP-ID, sync errors, inventory pre-check (CDS20001), nil/blank amendment, GPR prohibition, base URLs. |
| `Notification-APIs v 1.0.3.docx` | Normative: topic pull/ack, heartbeat, batch envelope, Base64 bodies, persist-before-ack, notification headers. |
| `Getting Ready for CDS Exports - MUCR Formatting.docx` | **Out of scope.** Exports-only (spec §2.2, §16). Retain for the export follow-on phase; do not implement now. |

Precedence when sources disagree: CNS config email → Declaration API v1.0.3 →
Notification APIs v1.0.3 → this repo's existing CDS rules → v1.0.2/draft (reference only).

---

## 1. Repository map (replaces spec §3.2)

| Spec's "find in repository" | Actual file(s) | Verdict |
|---|---|---|
| HMRC submission client/service | [src/lib/hmrc-fetch.ts](../../src/lib/hmrc-fetch.ts) | Bearer/OAuth + Gov-* fraud headers, hard-wired. **Do not extend** — write a sibling `fetchCns()`. |
| CDS XML builder | [src/lib/wco-mapper.ts](../../src/lib/wco-mapper.ts) → [src/lib/h1-xml-renderer.ts](../../src/lib/h1-xml-renderer.ts) | Reuse unchanged except one `PreviousDocument` entry. See §2.3. |
| Notification collector/parser | [src/lib/hmrc-notification-parser.ts](../../src/lib/hmrc-notification-parser.ts) **and** [convex/lib/hmrc_notification_parser.ts](../../convex/lib/hmrc_notification_parser.ts) | **Two copies exist.** See §2.1 — this is the biggest structural constraint. |
| Convex schema | [convex/schema.ts](../../convex/schema.ts) — `declarations` (L219), `notifications` (L443), `submissions` (L997) | Extend all three. See §3. |
| Submit / amend / cancel actions | [src/app/api/hmrc/submit/route.ts](../../src/app/api/hmrc/submit/route.ts), [amend/route.ts](../../src/app/api/hmrc/amend/route.ts), [cancel/route.ts](../../src/app/api/hmrc/cancel/route.ts) | Insert routing branch after preflight, before the outbound call. See §2.4. |
| Environment configuration | [src/lib/hmrc-config.ts](../../src/lib/hmrc-config.ts), [src/lib/hmrc-context.ts](../../src/lib/hmrc-context.ts) | Mirror the `resolveHmrcContext()` shape for `resolveCnsContext()`. |
| Retries / recovery jobs | [convex/crons.ts](../../convex/crons.ts), [convex/hmrc_actions.ts](../../convex/hmrc_actions.ts) `recoverStuckDeclarations` / `pullNotificationsScheduled` | Add a CNS poll cron alongside; reuse the stuck-declaration pattern. |
| DMS status mapping | [convex/lib/notification_status.ts](../../convex/lib/notification_status.ts), [convex/lib/notification_dms_context.ts](../../convex/lib/notification_dms_context.ts) | Reuse verbatim once the CNS envelope is decoded. |
| Evidence / audit | [convex/submissions.ts](../../convex/submissions.ts), [src/lib/audit-log.ts](../../src/lib/audit-log.ts) | Reuse; add `cspId`. |

---

## 2. Findings that change the design

### 2.1 Two runtimes that cannot share code — decides where CNS code lives

`convex/` cannot import from `src/` (verified: zero such imports). The repo already
pays for this by keeping **two** DMS parsers and two pull runtimes in sync.

Adding a third duplicate would be a mistake. Split by *who triggers the call*:

- **Declaration transport (submit/amend/cancel)** → `src/lib/cns/` — triggered by a
  browser request, and spec §6.2 requires forwarding the caller's `Gov-*` headers,
  which only the Next.js route has.
- **Notification pull/ack/parse** → `convex/` entirely — schedule-driven. Vercel kills
  in-process timers, and the repo already learned this (`scheduleNotificationPulls`,
  submit route L611). The poller must be a Convex cron + action.

Net: **no new duplication.** The two halves never need each other's code.

### 2.2 CNS goods location is already supported

`GBAULGPLGPLGP1` = "London Gateway Port Limited" is already in
[src/lib/generated/appendix-16c-codes.ts:156](../../src/lib/generated/appendix-16c-codes.ts#L156),
and `resolvePortGoodsLocation()` decomposes it correctly to GB / A / U / `LGPLGPLGP1`.

**DE 5/23 needs no new data or mapping.** Only a new predicate is required:
"is this location CNS inventory-linked?"

### 2.3 The MCR inventory reference is a one-entry mapper change

[h1-xml-renderer.ts:139-145](../../src/lib/h1-xml-renderer.ts#L139-L145) already emits
`<PreviousDocument>` with exactly `CategoryCode` / `ID` / `TypeCode` / `LineNumeric` —
the precise shape of spec §7.2.

[wco-mapper.ts:566-573](../../src/lib/wco-mapper.ts#L566-L573) currently emits one entry
(`Z` / `DCR` / DUCR). The CNS route appends a second: `Z` / `MCR` / UCN / `1`.

Per spec §7.2 the exact mapping must be **proved by the first EUAT declaration**, not
assumed. Build it behind the route flag so a wrong guess is one line to change.

### 2.4 The 202 handshake is genuinely incompatible — this is the key divergence

[submit/route.ts:559-589](../../src/app/api/hmrc/submit/route.ts#L559-L589) treats a 202
**without** `X-Conversation-ID` as a hard 502 failure and reverts the claim.

CNS returns **`X-CSP-ID`, never `X-Conversation-ID`** on the 202 (Declaration API v1.0.3,
Response Headers). ConversationID only appears later, on CDS-generated notifications.

So the CNS branch must not reuse that gate. It needs its own: persist `X-CSP-ID`, set
transport state pending, and never infer acceptance. Reusing the HMRC gate unchanged
would fail 100% of CNS submissions.

### 2.5 Correlation: both existing link keys are absent on an inventory rejection

`saveWebhook` ([convex/notifications.ts:113-127](../../convex/notifications.ts#L113-L127))
links a notification to a declaration by `conversationId`, falling back to `mrn`.

On a CNS inventory pre-check rejection **both are blank** (Declaration API v1.0.3 §7: MRN
"will always be blank"; Notification APIs v1.0.3 header table: ConversationID "not returned
for inventory pre-check failures").

The only available keys are `X-CSP-ID` and the LRN in `FunctionalReferenceID`.
`submissions` already stores `lrn` and is indexed by `conversationId`
([schema.ts:1004-1016](../../convex/schema.ts#L1004-L1016)) — add `cspId` + an index and
`submissions` becomes the correlation backbone. **This is the load-bearing schema change.**

### 2.6 Keep the existing status vocabulary; add transport state beside it

Existing statuses are human-readable (`Submitted`, `Accepted`, `Cleared`, `Rejected`,
`Invalid`, `Amended`, `Amendment Processing`, `Processing`) and are consumed across the
dashboard, portal, and read models. Spec §10.3's snake_case machine states
(`cns_received_pending_processing`, `inventory_rejected`, …) should **not** replace them —
that would ripple through every UI surface for no compliance gain.

Recommendation: keep `status` as-is, add `cnsTransportState` + `cnsInventoryState` fields
carrying the spec's machine vocabulary. Satisfies spec §10.1 ("extend existing records
first") and the acceptance criterion that inventory rejection is distinguishable from
HMRC rejection.

### 2.7 Amend and cancel mint fresh LRNs — this breaks CNS correlation

[hmrc-amendment-xml.ts:16-22](../../src/lib/hmrc-amendment-xml.ts#L16-L22) builds
`AM-{id}-{uniq}`, and [cancel/route.ts:77-78](../../src/app/api/hmrc/cancel/route.ts#L77-L78)
builds `CX-{id}`. Both are **new** FunctionalReferenceIDs, not the create LRN.

Both source specs say the opposite. Declaration API v1.0.3 ("Notification"): *"the LRN
value does not change in the case of making an amendment or cancellation requests for a
declaration and you should use the value provided when creating a declaration."*
CNS spec §9.1 makes the LRN the **primary permanent correlation key**, explicitly
"unchanged for amendment and cancellation".

This is survivable on the direct HMRC path because correlation there runs on
`X-Conversation-ID`, which the routes do capture. It is **not** survivable on CNS, where
an inventory pre-check rejection carries no ConversationID and no MRN — the LRN is all
that's left.

So the CNS branch of amend/cancel must reuse the original create LRN. Whether the direct
path should also change is a separate call with TDR-evidence implications; I have not
assumed it.

### 2.8 The GPR prohibition is currently free

Zero GPR / GoodsPresentation code exists anywhere in the repo. Spec §7.4's hard gate is
satisfied by absence today. Add an explicit assertion + test anyway so a future GPR
feature cannot silently regress it (spec test T11).

---

## 3. Schema changes (spec §10, mapped to real tables)

**`declarations`** ([schema.ts:219](../../convex/schema.ts#L219)) — add:
`submissionTransport` (`"hmrc_direct" | "cns_inventory"`, immutable after first attempt),
`cnsEnvironment`, `cnsBadgeId`, `cnsTopic`, `cnsUcn`, `cnsGoodsLocationCode`,
`cnsInventoryReferenceType`, `cnsCspId`, `cnsTransportState`, `cnsInventoryState`,
`cnsLastNotificationAt`. Index `by_org_transport_status`.

Precedent: `environment` on the same table is already stamped-and-locked via
`assertAndStampEnvironment` (submit route L175) — reuse that exact pattern for
`submissionTransport` (spec §5.2).

**`submissions`** ([schema.ts:997](../../convex/schema.ts#L997)) — add: `cspId`,
`transport`, `attemptKey`, `requestHash`, `endpoint`, `outcomeCertainty`.
Add index `by_cspId`. Already has `lrn`, `requestXml`, snapshots, `by_declaration`.

**`cns_notifications`** — new table. The existing `notifications` table is HMRC-shaped
(`hmrcNotificationId`, `conversationId`) and has no topic/partition/base64/ack columns,
and is append-only-by-convention for DMS events. Raw CNS envelopes need their own durable
store: `topic`, `notificationId` (unique with topic), `partition`, `queuedDateTime`,
`headers`, `bodyBase64`, `bodyDecoded`, `contentType`, `bodyHash`, `persistedAt`,
`ackedAt`, `processedAt`, `parserError`. Decoded DMS bodies then flow into the existing
`notifications` table through the existing parser, so the timeline stays single-sourced.

**`cns_poll_state`** — new table: `topic` (unique), `leaseOwner`, `leaseExpiresAt`,
`lastPollAt`, `lastSuccessAt`, `consecutiveFailures`, `nextPollAt`, `mode`.

---

## 4. Build plan

### M1 — Config + connectivity
New: `src/lib/cns/config.ts` (typed, mirrors `hmrc-context.ts`), `convex/lib/cns_config.ts`
(Convex-side copy of the *values* only — no logic to duplicate).
Startup validation per spec §4.3: reject enabled-without-credentials, require HTTPS,
require poll interval ≥ 30s, block production URL outside production, never expose to
client bundles.
Then: heartbeat POST → poll → persist → ack round-trip through `SOTFRETOP`.
**Preflight first** (spec §8.1): `GET /notifications/SOTFRETOP/consumer` — if a push
consumer exists, pull returns `423 LOCKED_PUSH_MESSAGING_ACTIVE` and nothing works.

### M2 — Declaration transport
New: `src/lib/cns/client.ts` (`fetchCns()` — Basic auth built server-side only,
`X-Badge-ID`, `User-Agent`, SSRF host allowlist), `src/lib/cns/declarations.ts`,
`src/lib/cns/errors.ts` (§6.4 table).
Edit: the three routes — branch after the existing preflight/rule-engine/claim sequence,
before `fetchHmrc`. Everything upstream (auth, ownership, validation, rule engine, XML
build, XML preflight, `beginSubmission` claim, `recordSubmissionEvidence`) is shared.
Add the `X-CSP-ID` 202 handler as its own path (§2.4 above).

### M3 — Notification pipeline (Convex-only)
New: `convex/cns_notifications.ts` (actions: poll/ack; mutations: persist/mark),
`convex/lib/cns_envelope.ts` (envelope parse + Base64 decode),
`convex/lib/cns_inventory_reject.ts` (CDS20001 + blank-MRN + IRC detection).
Edit: `convex/crons.ts` — add the poll cron.
Order is non-negotiable (spec §8.4, Notification APIs v1.0.3 §10): lease → GET batch →
persist every envelope durably → **then** DELETE-ack → then parse. Dedupe on
`topic + notificationId`. Parser failures replay from the persisted row, never from CNS.

### M4 — Inventory UX
Edit the declaration form + details pages: UCN field (trim + uppercase only), route label,
submit blocked without UCN/location/entitlement, IRC code + description + UCN on rejection,
Compass link. Nil/blank retrigger (§7.5) is operator-confirmed only — never automatic on
CDS20001.

### M5 — EUAT test execution
T01–T14 (spec §13.2). First fixtures `LGP100DPS00100` (Cargo Registered) and
`LGP100DPT00100` (Cargo Arrived), built to match container/packages/weight exactly.
T12 (direct-HMRC regression) is the one that protects existing TDR work.

### M6 — Hardening & cutover
Poller health alerts, unknown-outcome queue, secret review, production config separation.

---

## 5. Confirmed against CNS onboarding (source S1)

The CNS Service Desk onboarding correspondence confirms every value in §4.1 of the
governing spec — base URL, CCMI username `SOTFRECCMI`, topic `SOTFRETOP`, badge `RKA`,
Gateway EPU 155, GLC `GBAULGPLGPLGP1`, declaration Accept `vnd.hmrc.1.0+xml` (stated as
identical to production), notification Accept `vnd.csp.1.0+xml` (identical across all
environments), Compass URL/user, and all ten UCN fixtures. **No config discrepancies.**

CNS state they have configured for EUAT: badges, Compass UCNs, API Gateway authentication,
and the CDS notification topic.

### 5.1 Commercial prerequisites (production, not EUAT)

CNS Inventory Licence (quarterly), transactional fees (UCN, PIN), Partner Port fees
(DP World Southampton, DP World London Gateway — charged transactionally), and the CDS
Gateway API banded tariff. CDMS (CNS's own declaration software) is optional and not
being taken. These gate §15.1 cutover, not EUAT work.

### 5.2 Badge-sharing rule — now a hard product constraint

CNS state it directly: FreightCode **cannot** file inventory-linked declarations on behalf
of a client who holds their own licensed CNS badge — the declarant must use the badge the
inventory is assigned to, and one badge must not be shared across multiple client logins.
FreightCode *can* act as declarant for clients who ask it to clear on their behalf.

This makes spec §5.1's entitlement condition concrete, and it needs enforcing in two
places: an org-level "managed CNS clearance" entitlement, **and** a per-client check that
blocks the CNS route for any client recorded as holding their own CNS badge. That second
check is not in the governing spec — it comes from this correspondence. Suggest a
`cnsBadgeHolder` flag on `clients` ([schema.ts:316](../../convex/schema.ts#L316)).

## 6. Still open

1. **CNS API password** — a set-password link was issued (24h validity). Once set, the
   value goes in encrypted secret storage only. Both runtimes need it: the Next.js
   declaration transport and the Convex poller are separate environments, so it must be
   loaded into each. **Never** in the repo, `.env` committed files, or logs.
2. **Push consumer on `SOTFRETOP`** — still unconfirmed. CNS say the topic is configured
   but not whether a push consumer is attached. If one is, pull returns
   `423 LOCKED_PUSH_MESSAGING_ACTIVE` and M1 changes shape. Resolve by calling
   `GET /notifications/SOTFRETOP/consumer` once credentials exist, or by asking CNS.
3. **`X-Submitter-Identifier`** — spec §6.2 says optional/configurable; the onboarding
   pack doesn't mention it. Send FreightCode's EORI or omit for EUAT?
   (`fetchHmrc` already sends it on the direct path.)
4. **Vendoring the source specs** — the two CSP v1.0.3 specs are normative per §0 but
   live only outside the repo. Convert to markdown under `docs/cns/sources/`?

---

## 7. What is explicitly NOT being built

Inventory-linked exports, CILE movement/consolidation, MUCR processing (the MUCR docx is
retained for that later phase only), UCN claiming in Compass, CNS CDMS, badge sharing with
client orgs, replacing the CDS XML builder or DMS parser, and GPR messages for
inventory-linked imports.
