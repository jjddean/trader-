# Production Hardening Plan

Status: **run 1 complete** (2026-08-15) — Managed Service crash fixed and verified
by authenticated end-to-end journeys. See [Findings log](#findings-log).
Next: run 2, workflow mapping + full backlog.

Authenticated e2e: `npm run test:e2e:auth`. Requires a Clerk **development**
instance (`pk_test_`/`sk_test_`) in `.env.local`; the harness refuses to run
against a production instance. Test users are `+clerk_test` addresses created
and deleted through the Clerk Backend API, and run against the **dev** Convex
deployment.

Mode: production-hardening. FreightCode is live; estimated 50–60% production-ready.
Objective: systematically harden the existing product until the core operational
platform is production-safe.

**Constraint:** do not add new major modules or redesign working areas unless
required to resolve a production issue.

---

## Immediate task

Start with `onboarding:completeManagedService`.

1. Reproduce the current production error:
   `CONVEX M(onboarding:completeManagedService) Server Error`
2. Find the actual root cause.
3. Fix it properly — no masking (no swallowed errors, no defensive `try/catch`
   that hides the failure).
4. Test the complete Managed Service onboarding flow end-to-end.
5. Inspect adjacent onboarding mutations/components for the same failure pattern.

Then continue through the sequence below rather than stopping after the first bug.

---

## 1. Identify and log current production failures

- Current known failure: `onboarding:completeManagedService` server error.
- Root-cause each failure; fix properly rather than masking.
- Check adjacent onboarding mutations/components for the same pattern.

## 2. Map the existing critical production workflows

Test the actual application paths end-to-end:

- Authentication / sign-up
- Organisation creation
- Broker onboarding
- Managed Service onboarding
- Client creation / editing
- Client portal invitation and access
- Declaration creation / editing
- HMRC connection / OAuth
- CDS validation / submission
- HMRC response handling
- Documents / uploads / linking
- Charges / payments records
- Messages
- Export-control cases

## 3. Classify every issue

| Severity | Definition |
|----------|------------|
| **P0** | Blocks operations, causes server errors, risks incorrect customs submissions, loses/corrupts data, security or tenant issue |
| **P1** | Workflow / recovery / reliability issue that materially affects production use |
| **P2** | UX / polish issue that does not prevent operation |

Fix P0 before P1. Do not polish P2 while P0/P1 remain.

## 4. Audit Convex production safety

Review mutations/queries/actions used by critical workflows for:

- authentication
- organisation / tenant isolation
- server-side permissions
- input validation
- incorrect cross-org IDs
- partial writes
- duplicate execution
- idempotency
- orphaned records
- client / declaration / document relationships
- archive / delete behaviour
- existing legacy production records

## 5. Harden the CDS lifecycle

Verify the complete flow:

`Draft → Validate → Submit → Accepted/Rejected → Tax → Clearance → Amend/Cancel → Archive`

Test failure conditions as well as success:

- HMRC timeout
- OAuth expiry / failure
- rejected declaration
- duplicate submission attempt
- retry after failure
- repeated HMRC/SDS event
- malformed / unexpected HMRC response
- DMSACC
- DMSTAX
- DMSCLE
- DMSREJ
- DMSINV
- amendment / cancellation failure

**A retry must never create an accidental duplicate customs submission.**

Reference: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` (compliance authority).

## 6. Add proper production observability

Use the existing stack where appropriate: Convex logs, BetterStack, PostHog,
Cloudflare, Resend.

Important production failures must expose enough internal information to identify:

`request/correlation ID → user → organisation → client/job/declaration → operation → error`

**Customers must not see raw internal/server errors.**

## 7. Test recovery states

For every important workflow, deliberately interrupt/fail it and verify recovery:

- upload succeeds but DB save fails
- onboarding partially completes
- invite is sent but later step fails
- HMRC request times out
- browser refresh during an operation
- double-click / double-submit
- expired authentication / session
- failed / retried background processing

## 8. Run complete acceptance journeys

**Broker**
`Sign up → Organisation → Onboarding → Connect HMRC → Client → Declaration → Documents → Validate → Submit → HMRC response → Complete`

**Managed Service customer**
`Sign up → Onboarding → Company details → Documents → Communication → Declaration/clearance status → Charges → Completion`

**International client portal**
`Invite → Sign up/login → Company → Declarations → Requested documents → Upload → Messages → Charges → Export controls → History`

Record every broken, confusing or incomplete state encountered.

## 9. Security review

Verify:

- Clerk authentication boundaries
- organisation isolation
- portal isolation
- role permissions
- Convex server-side access checks
- R2 document access
- secrets / environment separation
- rate limiting where required
- audit events
- TDR / live environment separation

**Manipulating a client-side ID must never expose another organisation's data.**

## 10. Data and operational resilience

Verify:

- production backups
- restore procedure
- safe schema migrations
- backward compatibility with existing records
- required / optional field behaviour
- indexes / production query performance
- archive / retention behaviour

## 11. Regression

After fixes, rerun the critical workflows so one fix has not broken another part
of the product.

## 12. Production readiness status

Maintain a simple status per core area:

- 🔴 **RED** — broken / unsafe
- 🟠 **AMBER** — functional but not sufficiently hardened
- 🟢 **GREEN** — production-ready

**Do not mark an area GREEN just because its happy path works.** It must also have
correct permissions, failure handling, recovery and production-safe data behaviour.

### Status board

| Area | Status | Notes |
|------|--------|-------|
| Authentication / sign-up | ⬜ not assessed | |
| Organisation creation | ⬜ not assessed | |
| Broker onboarding | 🟠 AMBER | Happy path + resubmit + server-side validation covered by e2e; org handoff, recovery and permissions not yet exercised |
| Managed Service onboarding | 🟠 AMBER | P0-1/2/3/5 fixed and e2e-verified; portal revoke/re-link (P1-1) and JWT email claim (P0-6) still open |
| Client creation / editing | ⬜ not assessed | |
| Client portal invite / access | ⬜ not assessed | |
| Declaration creation / editing | ⬜ not assessed | |
| HMRC connection / OAuth | ⬜ not assessed | |
| CDS validation / submission | ⬜ not assessed | |
| HMRC response handling | ⬜ not assessed | |
| Documents / uploads / linking | ⬜ not assessed | |
| Charges / payments | ⬜ not assessed | |
| Messages | ⬜ not assessed | |
| Export-control cases | ⬜ not assessed | |
| Observability | 🔴 RED | 330 plain `throw new Error` in `convex/` still redact to "Server Error" in prod (P0-4) |
| Security / tenant isolation | ⬜ not assessed | |
| Data resilience / migrations | ⬜ not assessed | |

---

## Findings log

### Run 1 — 2026-08-15 — `onboarding:completeManagedService`

**P0-1 — Every user-facing Convex error is invisible in production. FIXED (onboarding only).**
Convex production deployments redact any thrown `Error` to the literal string
`Server Error`; only `ConvexError` payloads survive to the browser. `ConvexError`
appeared in **zero** files in this repo, so every deliberate guard rail became an
opaque crash the moment it ran in production while looking correct in dev. This
is the whole of the reported `CONVEX M(onboarding:completeManagedService) Server
Error` — there was never an internal fault.

**P0-2 — Managed Service lock-out with no recovery. FIXED.**
`completeManagedService` refused to continue when a `clients` row already carried
the caller's email under a *different* `portalClerkId`, which is exactly the state
produced by signing up again on a new Clerk account, or by portal access being
revoked and re-granted. The user was permanently blocked and (per P0-1) could not
see why. Confirmed against production data: `user_3Hodwq…` and `user_3Hscvi…`
both hold `users` rows created 2026-08-11 with `onboardingPath` unset — two real
sign-ups that hit this guard and died.

**P0-3 — Portal email could be squatted. FIXED.**
`portalEmail` was bound from the submitted `contactEmail` form field, not from the
Clerk identity. Any signed-in user could type a stranger's address and claim its
portal binding, permanently blocking that person from Managed Service onboarding
(and from `resolvePortalClient`, which denies when `portalClerkId` mismatches).
`portalEmail` is now taken from the Clerk identity via `resolveSignedInEmail`;
`contactEmail` remains free text as the business contact, which is all it should
ever have been.

**P0-4 — The other 330 plain throws. OPEN.**
`grep -rc "throw new Error" convex/` → 330 across 25+ modules, led by
`clients.ts` (48), `client_portal.ts` (31), `export_controls.ts` (30),
`declarations.ts` (25), `documents.ts` (24). Every one that guards a user action
surfaces as `Server Error` in production. Migrating these to `userError()` is the
single highest-value observability fix remaining and belongs at the top of run 2.

**P0-5 — Onboarding broke on direct entry to the form. FIXED.**
Found by the new e2e journey, not by reading the code. `syncUser` — which is what
populates `users.email` — only ran on `/onboarding` and `/after-auth`. Landing
straight on `/onboarding/managed-service` (bookmark, refresh, back button) left
no email for the server to bind the portal to, so the P0-3 fix turned that into a
hard block: `no_account_email`. `OnboardingCompanyForm` now awaits `syncUser`
before submitting, so entry point no longer matters.

**P0-6 — The Clerk→Convex JWT had no `email` claim. FIXED on Development; PRODUCTION INSTANCE STILL PENDING.**
`convex/auth.config.ts` uses the Clerk JWT template `convex`, which emitted only
`aud`, `role` and `org_id` — confirmed live: `identity.email` was empty and
`resolveSignedInEmail` fell back to the `users` row, which is written by
`users.syncUser` from a **client-supplied** argument. Portal binding therefore
rested on a value the client controlled.

The template now also emits:

```json
"email": "{{user.primary_email_address}}",
"email_verified": "{{user.email_verified}}"
```

`resolveSignedInEmail` returns `{ email, source, verified }`, prefers the JWT
claim, and `console.warn`s on every users-row fallback so the remaining reliance
is measurable. Managed Service onboarding and portal resolution both refuse a
positively-unverified address, and deliberately do **not** block when the claim
is absent or unparseable — blocking on unknown would trade one production
lock-out for another. Verified after the change: 6/6 e2e green and **zero**
fallback warnings in the Convex logs, so the claim is live on dev.

⚠️ **Remaining action: apply the same two claims to the Clerk _Production_
instance.** Until that is done, production sessions still carry no email claim
and continue on the client-asserted fallback.

**P1-0 — Clerk instance requires client trust for password sign-in. NOTED.**
Password sign-in returns `needs_client_trust`, and `@clerk/testing`'s password
helper then calls `setActive` with a null session and returns *silently signed
out*. Anything automating password sign-in must use the sign-in-token strategy
instead. Recorded because it will bite the next person writing an auth test.

**P1-1 — Orphaned/duplicate managed clients. OPEN.**
Production `clients` holds three Managed Service rows for two companies;
`ns7dy6w632210w6et58pfkrrbx8brg86` has had its `portalEmail`/`portalClerkId`
cleared and is now unreachable by any user, while a second row for the same
company was created alongside it. Revoking portal access orphans the record
rather than archiving or re-linking it. Needs a defined revoke/re-link/archive
behaviour, plus a decision on the existing rows.

**P1-2 — `by_portal_email` / `by_portal_clerk` are not unique. OPEN.**
Both lookups use `.first()`, so duplicate bindings resolve arbitrarily. Nothing
enforces one client per portal email.

**P1-3 — `requireUser` uses `.unique()` on `users` by `clerkId`. OPEN.**
Duplicate rows would throw an unhandled internal error (→ `Server Error`). No
uniqueness constraint exists; three separate modules insert into `users`
(`onboarding.ts`, `hmrc.ts`, `users.ts`). Current production data is clean.

**P1-4 — Silent catches on the sign-in path. FIXED.**
`after-auth/page.tsx` swallowed every routing failure and redirected to
`/onboarding`; `onboarding/page.tsx` dropped `syncUser` failures entirely. Both
now log before recovering. A failed `syncUser` is precisely what makes the later
`portalEmail` fallback come back empty, so losing it was expensive.

**P2-1 — Managed Service EORI validation is UK-only. OPEN.**
`validateEori` enforces `(GB|XI)\d{12}` even on the optional Managed Service
field, so a non-UK EORI is rejected. Fine if Managed Service is UK-importer only;
needs confirming.

**Verification — run 1.**
`npm run test:e2e:auth` — 6/6 passing against local Next + dev Convex:

| Journey | Covers |
|---|---|
| Managed Service — new customer → `/portal` | happy path |
| Managed Service — same email, new Clerk account | P0-2 |
| Managed Service — squatter types victim's email, victim still onboards | P0-3 |
| Broker — new broker → `/session-tasks/choose-organization` | happy path |
| Broker — returning broker resubmits | upsert-by-clerkId is re-runnable |
| Broker — invalid EORI | P0-1: server guard reaches the browser as readable text |

Plus 15 unit tests (`tests/managed-service-binding.test.ts`,
`tests/convex-user-errors.test.ts`) and no regression in `npm run test:portal`.

**Environment gap (not a code issue) — OPEN.**
Production Convex has no `CNS_*` variables at all (dev has 12). Any CNS
inventory-linked path will fail on production. Out of scope for run 1, flagged
for the CDS lifecycle phase.

---

## Run 2 — 2026-08-15 — Convex endpoint audit

Method: static audit of every exported Convex endpoint
(`scratchpad/audit-convex.mjs`), then manual verification of each flagged
function. Counts are exact; classifications were checked by reading the code.

```
292 endpoints   222 public   70 internal
 30 public with no auth call
 57 public with auth but no tenant reference  (heuristic — includes false positives)
287 plain `throw new Error` inside public endpoints
```

### Unauthenticated public endpoints — triaged

**Legitimate.** Reference data (`cds_codes`, `reference_data`, `sanctions_data`,
`tariff_internal.getCache`, `rule_definitions.list*`), `waitlist.join`, and the
token-gated compliance flows. The token flows were checked and are sound:
256-bit `crypto.getRandomValues` tokens, 14-day TTL, revocation and completion
both honoured on every read.

**Deprecated stubs.** `actions/hmrc.getHmrcAuthUrl` and `handleHmrcCallback`
throw immediately by design — OAuth moved to the Next.js routes.

**Real findings:**

| ID | Sev | Endpoint | Issue | Status |
|----|-----|----------|-------|--------|
| P0-11 | P0 | `actions/companies.indexCompanies` | Public action taking an arbitrary `datasetUrl`, no auth. Server-side fetch of any attacker-supplied URL written to the search index, and it drops the whole `companies` collection first — an unauthenticated wipe. | **FIXED** — file deleted. Zero callers, and `TYPESENSE_NODES`/`TYPESENSE_API_KEY` are set on neither deployment, so the entire Typesense integration was dead. `searchCompanies` went with it. CLAUDE.md still lists Typesense as the search layer; that line is now stale. |
| P0-12 | P0 | `rule_definitions.proposeCuratedFromRejection` | Public **mutation**, no auth. Looks up any declaration `by_mrn` and writes rule proposals derived from it. Cross-tenant read and write keyed on a guessable identifier. | **FIXED** — now takes `ingestSecret` and calls `assertIngestSecret`, matching `saveWebhook`. Its only caller is the HMRC webhook route, which already held the secret. |
| P0-13 | P0 | `notifications.saveWebhook` | Gated only by a shared secret passed as an argument, compared with `!==`, no rate limit. A leaked or brute-forced secret lets anyone inject DMSACC/DMSCLE — telling a broker goods cleared customs when they did not. | **FIXED** — constant-time compare via `convex/lib/secret_compare.ts`. `src/lib/secrets-equal.ts` uses `node:crypto` and is unreachable from the Convex mutation runtime, hence the separate pure-JS implementation. Rate limiting still outstanding. |
| P1-6 | P1 | `org_hmrc.getModeForOrg` | Public query accepting any `orgId`. Leaked practice/live mode and whether a sandbox test user is configured, for any org. | **FIXED** — now requires a session and that `orgId` match the caller's active org, with an admin bypass; anything else gets the practice default rather than the real row. All five callers (four client components, `hmrc-org-routing.ts`) pass the caller's own org and use an authenticated Convex client, so none change. |
| P1-7 | P1 | `actions/hmrc.syncAllUsersHMRC` | Public action accepting a `secret` argument it never checked. | **FIXED** — converted to `internalAction`; `convex/http.ts` now calls it via `internal.` behind its existing `SYNC_SECRET` bearer check, so it is no longer browser-reachable. |
| P1-5 | P1 | `hmrc_actions.searchHSCode` | Unauthenticated, unmetered proxy to the HMRC API using production credentials. Public access is intended — `/hs-code-lookup` and `/tools` are not in `src/proxy.ts`'s protected matchers — so this is not an auth hole. It is an abuse and quota risk: `api-rate-limiter.ts` only wraps Next.js API routes, and this is a Convex action called directly from the browser with `useAction`, so it bypasses that layer entirely. Anonymous visitors can drive unlimited HMRC calls against your vendor credentials. Needs metering at the Convex action. Already 401-ing in production logs for an unrelated credential reason. | Open |

`proposeCuratedFromRejection` still shows in the "no auth call" count because the
static check looks for `getUserIdentity`-style calls, not shared-secret gates.
Both it and `saveWebhook` are machine-to-machine endpoints by design.

### P0-4 migration — six hot files done

163 throws converted across `clients`, `client_portal`, `export_controls`,
`declarations`, `documents`, `cns`:

| Kind | Count | Becomes |
|------|-------|---------|
| `"Unauthenticated"` | 59 | `unauthenticatedError()` |
| `"Unauthorized"` | 37 | `forbiddenError()` — deliberately does not say why, which would confirm the record exists |
| Specific messages | 67 | `userError("<derived_code>", "<same message>")` |

A second pass covered `assistantMutations`, `assistantQueries`, `validation_results`,
`goods_items`, `org_hmrc`, `tre_imports`, `representation`, `compliance_end_user`,
`compliance_consultant`, `submissions`, `hmrc`, `workspaces`, `trade_lanes`,
`declaration_completeness`, `org_migration`, `account_export` — 110 more
(40 unauthenticated, 23 forbidden, 47 specific).

**Convex-wide plain throws: 330 → 47. Inside public endpoints: 287 → 23.**

Four Stripe throws were deliberately kept as plain `Error` — missing
`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` and "session missing URL" are
internal misconfiguration, and staying redacted in production is correct.

**Eight deliberately left as plain `Error`.** The HMRC submit/amend/cancel guards
carry `SUBMIT_BLOCKED:` / `ENVIRONMENT_MISMATCH:` / `TRANSPORT_MISMATCH:` /
`UCN_LOCKED:` prefixes that `src/app/api/hmrc/{submit,amend,cancel}/route.ts`
parse out of `err.message` with regexes. Converting them changes `.message` to
the JSON of the error payload, which would leave the extracted text with a
trailing `"}`. These move only when those routes migrate to `userErrorCode()` —
not worth half-migrating a customs submission path.

**Required companion change.** `ConvexError.message` is the JSON of its data, so
any UI rendering `err.message` raw would have started showing
`{"kind":"user","code":…}`. 77 call sites across 55 files now use
`userMessageFromError(err, fallback)` instead. This is the end state requirement 6
asks for anyway: customers never see raw internal errors, only deliberate ones.

Two call sites branched on error *text* (`"already used for another client's
portal access"`). They now branch on stable codes — `portal_email_taken`,
`portal_email_is_app_user` — via `userErrorCode()`.

Lint after the migration: 153 errors, all pre-existing —
`react/no-unescaped-entities` (74, guide prose), `@typescript-eslint/no-explicit-any`
(52), `react-hooks/*` (22), and 5 unused-import/prefer-const in files untouched by
the codemod. None introduced by this work.

### P0-4 original scope, measured

287 of the 330 plain throws sit inside public endpoints. Concentration:

| Count | File |
|-------|------|
| 48 | `clients.ts` |
| 31 | `client_portal.ts` |
| 29 | `export_controls.ts` |
| 24 | `declarations.ts` |
| 24 | `documents.ts` |
| 12 | `cns.ts` |

Those six are the whole broker and portal surface and account for 168 of 287.
Migrating them closes most of the customer-visible "Server Error" exposure.

### Tenant-isolation triage — complete

Widening the static check to recognise the real access helpers in
`lib/org_access.ts` and `lib/user_role.ts` cut the candidate list from 57 to 30.
All 30 were then read. Cleared as false positives, each enforcing tenancy through
a helper the pattern match could not see:

| Cluster | Enforced by |
|---------|-------------|
| `export_controls.ts` ×12 | `getAssessmentOrThrow` → `assertAssessmentAccess` |
| `assistantMutations.ts` ×7 | `assertConversationAccess`, `ensureConversationForScope` |
| `trade_lanes.ts` ×2 | local `canAccess` |
| `client_portal.ts` (all) | `resolvePortalClient` |
| `actions/stripe.createPortalSession` | caller-scoped `getSubscription` |
| `actions/hmrc_token_encrypt.encryptOAuthTokens` | auth-gated, encrypts caller-supplied input only |
| `documents.generateUploadUrl` | auth-only by design; tenancy enforced on the save |
| `onboarding.getStatus`, `completeBroker` | scoped by `clerkId` |

**One real finding:**

| ID | Sev | Endpoint | Issue | Status |
|----|-----|----------|-------|--------|
| P0-14 | P0 | `rule_definitions.upsert`, `rule_definitions.setEnabled` | Authenticated but with **no role check**, writing to `rule_definitions` — a table with no `orgId`, i.e. global. Any signed-in user could rewrite or disable a blocking validation rule for every tenant. Rules gate declaration validation, so this is squarely "risks incorrect customs submissions". Neither has a caller in `src/`; they are ops functions that were left publicly reachable. Sign-up is open on the Clerk instance production currently uses, which makes "any signed-in user" mean anyone. | **FIXED** — both now call `requireAdmin`. Verified: an unauthenticated call returns `Unauthorized: Admin access required`. |

### P1-5 corrected

`hmrc_actions.searchHSCode` uses the **public** Trade Tariff API with no auth
headers — no HMRC vendor credentials are involved. Downgraded to P2: the only
exposure is anonymous use of Convex compute, and `api-rate-limiter.ts` cannot
reach it because it is a Convex action rather than a Next.js route.

### P1-8 — HS code lookup was silently broken. FIXED.

Two independent faults, either fatal on its own:

1. Host and path were `api.trade-tariff.service.gov.uk/uk/api/v2/search` → `401`.
   Correct is `www.trade-tariff.service.gov.uk/api/v2/search` → `200`. This is the
   401 visible in production logs.
2. The parser read `data.attributes.results`, a key the API has never returned.
   Real shapes are `attributes.entry` for exact matches and
   `attributes.goods_nomenclature_match` / `attributes.reference_match` for fuzzy.

The handler returns `[]` on failure, so the UI showed "no results" rather than an
error — the tool looked functional and simply never found anything. Parsing moved
to `convex/lib/trade_tariff_search.ts` as pure functions with the response shapes
pinned by tests. Verified live: `laptop` → 8471300000, `wooden chairs` →
9403601000, `olive oil` → 1509, nonsense → `[]`.

---

## Run 3 — 2026-08-15 — CDS lifecycle, duplicate-submission hardening

Focus: the stated red line — *a retry must never create an accidental duplicate
customs submission*.

**P0-15 — Amend and cancel could file twice. FIXED.**
`beginSubmission` claims a declaration atomically before the initial POST, so a
double-click is rejected. Amend and cancel had no equivalent: both set status
only **after** HMRC replied. Between the click and the reply the declaration
still read "Accepted", so a second click — or a retry over a slow response —
passed the same checks and filed a second amendment or cancellation at CDS.

Added `declarations.beginFollowUp({ id, operation })`, mirroring
`beginSubmission`: reads status and flips it to "Amendment Processing" /
"Cancellation Requested" in one transaction, returning the prior status so the
route can revert. Wired into both routes **immediately before dispatch**, not at
the top — the EORI, environment, LRN and XML-build steps sit between, and a
failure there would otherwise strand the declaration mid-flight with nothing sent.

Revert policy, matching the CNS rule already present in the submit route:

| Outcome | Claim |
|---------|-------|
| HMRC 429 rate limited | released — request definitively not processed |
| HMRC 4xx/5xx rejection | released |
| CNS `rejected` | released |
| CNS `outcome_unknown` | **retained** — may have reached CDS |
| Network timeout / thrown fetch | **retained** — outer catch never reverts |

**P0-16 — Ambiguous submit success reverted the claim. FIXED.**
In the submit route, a 2xx from HMRC with no `X-Conversation-ID` header called
`revertClaim()`. HMRC had accepted the declaration; only the correlation header
was missing. Reverting re-opened it for submission and invited a duplicate live
entry. It now stays in "Processing", logs
`declaration_submit_ambiguous` with `claimRetained: true`, and tells the operator
to check status before resubmitting.

**Confirmed already correct** — not findings, but checked rather than assumed:

- Timeouts. `fetchHmrc` uses `AbortSignal.timeout`, and the submit route's outer
  catch does **not** revert, so a timeout leaves the declaration in "Processing"
  rather than re-openable. The `recoverStuckDeclarations` cron then reconciles it.
- Replayed notifications. `saveWebhook` dedupes on `hmrcNotificationId` first,
  then on `idempotencyKey`, and logs a `notification_dedup` audit entry.
- Concurrency. Convex mutations are serializable, so the read-then-patch inside
  each claim is genuinely atomic.

The claim rule is extracted to `convex/lib/follow_up_claim.ts` as pure functions
with 7 unit tests, so the state machine is pinned without a deployment.

**Still open in this area:**

- A declaration left in "Processing" with **no** conversationId is skipped by
  `recoverStuckDeclarations` (`skippedNoConversation` in its summary), so the
  P0-16 case is safe but stays stuck until someone looks. Safer than duplicating,
  but it needs an operator surface.
- DMSACC / DMSTAX / DMSCLE / DMSREJ / DMSINV handling has not been exercised yet
  — that is the next piece of run 3.

---

## Run 4 — 2026-08-15 — Observability (step 6)

**The listed stack is not installed.** `package.json` carries `resend` and
nothing else — no PostHog, no BetterStack/Logtail, no Cloudflare or OTEL client,
and zero references to any of them in `src/` or `convex/`. So step 6 was done
against what actually exists: Convex logs, Vercel stdout, and the `auditLogs`
table. Wiring PostHog or BetterStack is a separate decision, not a fix.

**Correlation IDs — `src/lib/correlation.ts`.**
`correlationIdFrom(request)` reuses an inbound `x-correlation-id` when it passes
a format check, otherwise mints a UUID, so one id spans the whole call chain.
`logOperationFailure` emits a single structured JSON line carrying the full
trail the plan asks for:

```
correlationId → userId → orgId → declarationId/clientId → operation → error
```

Convex and Vercel both capture stdout, so this is greppable today without new
tooling. `withCorrelation` puts the id on the response, and the id is in the
JSON body too, so a customer seeing the generic message can quote something that
locates the exact request.

Threaded through `submit`, `amend` and `cancel`: minted at the top of `POST`,
stamped onto all 20 `logHmrcAudit` calls, logged on the outer catch, returned on
the 500.

**Audit rows now resolve to a tenant.** `audit.logMyAction` stamps `orgId` from
`getActiveOrgId` server-side rather than trusting caller metadata, so every row
answers "which organisation" without inference. Its `throw new Error` became
`unauthenticatedError()`.

6 unit tests pin the id behaviour, including rejection of junk inbound values
(spaces, oversized, `<script>`), which otherwise land straight in your logs.

**Not done:** customer-facing errors were already handled in run 2 — 77 UI sites
use `userMessageFromError`, so raw internal errors do not reach customers. No
alerting or dashboards exist; that needs a tool decision first.

---

## Run 5 — 2026-08-15 — Recovery states (step 7)

**P1-9 — Uploads orphaned their files when the row failed to save. FIXED.**

Every upload is two steps: POST the bytes to Convex storage, then insert the
`documents` row. If the insert failed, the bytes stayed in storage forever with
nothing referencing them — no owner, no `orgId`, no tenancy check, and still
counted against storage. The user saw "Upload failed" and retried, orphaning
another copy.

Worst case is `document-audit-panel.tsx`: it uploads, then runs the file through
Textract via `/api/ai/extract`, and only saves the row **after** extraction
succeeds. OCR failure is the most likely failure in that chain, so every failed
extraction left a file behind.

Added `documents.discardOrphanedUpload({ storageId })` — auth-gated, and refuses
when a `documents` row claims the file, so a save that actually landed can never
be deleted by a late or duplicated discard. That check needed a new
`documents.by_file` index; per AGENT-SPEC §6 the lookup should not be
index-less. Wired into the failure path of:

| Flow | File |
|------|------|
| Portal client upload | `src/app/portal/documents/documents-client.tsx` |
| Compliance document audit (OCR) | `src/components/trade-compliance/document-audit-panel.tsx` |
| Signed EUSU upload | `src/components/trade-compliance/end-user-send-card.tsx` |

The remaining two — `portal/messages/messages-client.tsx` and
`dashboard/clients/page.tsx` — were wrapped in their own `try`/`catch` and
discard before rethrowing, so the caller's error handling is unchanged. **All
five upload flows now discard on failure.**

**P1-10 — my own run-2 sweep hid route-authored error messages. FIXED.**

Found while tracing "invite sent but a later step fails". The invite route
deliberately returns **502 with an explanatory message** when portal access was
enabled but the email failed — `"Portal access was enabled, but the invite email
failed…"` — plus `accessEnabled: true`. The client throws
`new Error(body.error)` and shows it.

The run-2 codemod rewrote that catch to `userMessageFromError(err, …)`. That
function only trusts `ConvexError`, so a locally-constructed `Error` fell through
to the generic fallback. The broker was told "Portal access could not be updated.
Please try again." when access **had** been enabled — the opposite of what
happened, and it invites a pointless retry.

Nine sites across eight files had the same shape: throw an `Error` carrying an
API route's `error` field, catch it, render it.

Fixed with an `ApiError` class in `src/lib/convex-errors.ts`. Messages our own
routes wrote are already curated and safe, so `userMessageFromError` returns them
verbatim; plain `Error` still falls back to the generic message, because those
can carry internal detail. Three tests pin the distinction.

This is the failure mode I flagged when the sweep landed — 77 mechanical
substitutions with no test coverage behind most of them. It took walking a
recovery path to surface it.

**Double-submit.** 28 components already disable their control while saving. The
server-side guards that matter are `beginSubmission` and the new
`beginFollowUp` (run 3) — client-side disabling alone would not stop a
concurrent POST.

**E2E coverage added for uploads.** `e2e/auth/portal-document-upload.spec.ts`
onboards a managed-service client, uploads a PDF through the portal, asserts the
success notice rather than the error box, then **reloads and asserts the row is
listed** — the optimistic notice alone would not prove the `documents` row
landed. This is the first browser coverage of the upload path, which is where
P1-9 lived. Suite is now 8 authenticated journeys.

**P2-3 — duplicate `<h1>` on every portal page. FIXED.** Found writing that test.
`PortalHeader` renders `<h1>{title}</h1>` for the shell chrome while each page
renders its own `<h1>`, so every portal page shipped two — not just Documents.
The chrome title is not the document heading, so it is now a `<p>` with identical
styling. One change, all portal pages. The two remaining `<h1>` in
`portal-shell.tsx` are standalone full-page states where they are the only
heading, and are correct as-is. The e2e assertion no longer needs `.first()`,
so it now proves the duplication is gone.

**Test flakiness fixed.** The onboarding specs intermittently failed on the Clerk
loading state — the first form field could be queried before the form mounted.
`fillCompanyForm` now waits for `#companyName` to be visible. Suite run twice
back to back after the change: 8/8 both times.

**P1-11 — a successful amendment or cancellation could be reported as a 500. FIXED.**

The Clerk Convex JWT lives 60 seconds. An HMRC call can outlast that. In amend
and cancel, the `updateDeclarationStatus` call *after* HMRC accepted was
unwrapped, so a token that expired mid-call threw straight into the outer catch
and returned a 500 — for a request HMRC had already accepted. The caller is told
it failed, and the conversationId never lands, breaking notification correlation
for that amendment.

The submit route already solved this ("From here a Convex error must NOT surface
as a 500"). Both routes now use the same shape: persist inside a `try`, set
`statusPersisted = false` on failure, log through `logOperationFailure` with the
correlation id and declaration id, and still return success. `statusPersisted`
and `correlationId` are now in both success responses so the caller can tell.

No duplicate risk either way — the run-3 claim already blocks a retry.

**Retried background processing — checked, no defect.** The CNS notification
poll takes a topic lease with an owner and expiry, so a second runner mid-batch
backs off rather than double-processing. Persistence goes through
`notifications.saveWebhook`, which dedupes on `hmrcNotificationId` then
`idempotencyKey`. `recoverStuckDeclarations` counts `skippedNoConversation` and
`skippedNoToken` rather than retrying blindly. Re-running any of these is safe.

**Browser refresh mid-operation — FIXED.** Convex is reactive and state lives
server-side, so a refresh generally recovers. The exception was an upload: a
refresh between the storage POST and the row insert kills the page before the
client-side discard can run.

`documents.sweepOrphanedFiles` (internal, daily cron at 03:15 UTC) deletes stored
files that no `documents` row references, with a 24-hour grace period so an
in-flight upload is never touched. `documents.fileId` is the only schema field
that references a stored file — checked before writing the sweep. If another
table ever stores a storage id, the sweep must learn about it or it will delete
live data.

**Measured on dev, first run:**

```
scanned 327   referenced 302   tooRecent 3   deleted 22
```

22 orphaned files had accumulated on the dev deployment — the defect was real and
already leaking, not theoretical. A second run deleted 0, confirming it is
idempotent. Not run against production; the cron will handle it after deploy, or
it can be invoked manually first to see the count.

**Honest coverage gap:** the discard path itself is still unproven end to end. The
happy path is now covered, but I have not forced `saveDocument` to fail in a
browser and watched the file be removed from storage. The mutation is unit-safe
(it refuses when a row claims the file) and typechecks, but "the orphan is
actually deleted" rests on reading, not observation.

---

## AGENT-SPEC compliance check (read 2026-08-15, after the fact)

`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` should have been read before any HMRC work.
It was read only after the user asked what sources this session used. Findings
from checking the HMRC-touching changes against it:

**Withdrawn — P0-9 was wrong.** I flagged `HMRC_ENVIRONMENT=sandbox` in Vercel
production as a misconfiguration. §2 defines TDR as running **on the sandbox
host** (`test-api.service.hmrc.gov.uk`, `HMRC_ENVIRONMENT=sandbox`). Production
matches the spec. The flag was inference in place of citation — the exact thing
§3 prohibits.

**Corrected — the cancel status restriction.** `followUpClaim` briefly limited
cancellation to `Accepted`/`Amended` by symmetry with amend. §3 forbids inferring
CDS rules from patterns, and §1 puts external inference below all documented
sources. Reverted: cancel now carries no status restriction, matching the route's
original behaviour. Which states permit an invalidation stays an open question
for the spec to answer.

**Two judgement calls for review, not changed unilaterally:**

1. §10 says use `fetchHmrc()` for *every* HMRC call. `hmrc_actions.searchHSCode`
   uses a raw `fetch` to `trade-tariff.service.gov.uk`, an HMRC-operated host. It
   was a raw fetch before this session and I kept it that way: the tariff API is
   unauthenticated and public, and `fetchHmrc()` attaches fraud-prevention headers
   and OAuth intended for CDS APIs. Applying the rule literally looks wrong here,
   but the deviation should be a decision, not an omission.
2. §10 says derive declaration status from HMRC notifications only.
   `beginSubmission` (pre-existing) and `beginFollowUp` (added this session) both
   write an in-flight status — "Processing", "Amendment Processing",
   "Cancellation Requested" — before HMRC replies. These are transport states
   rather than CDS outcomes, and the duplicate-submission guard depends on writing
   one before dispatch. The pattern predates this session; `beginFollowUp` extends
   it to amend and cancel.

Nothing else touched HMRC behaviour: correlation IDs, the webhook constant-time
compare and the rule-proposal secret gate have no compliance dimension. No
changes were made to `wco-mapper.ts`, `h1-xml-renderer.ts`, DE mappings, XML
structure or Accept headers, so §4, §7 and §9 were not engaged.

---

## Required reporting format

Each report back must give:

- what was inspected
- issues found
- severity of each issue
- fixes made
- files changed
- tests performed
- anything still RED or AMBER
- the next item in the production-hardening sequence
