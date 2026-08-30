# CLAUDE.md — FreightCode operating contract

This file is the **operating contract** for coding agents. It is not the product specification.

It tells an agent: what is allowed to define behaviour, which documents to open, how to treat conflicts, and which repository commands are the verification gates.

Communication style for this repository is defined in `AGENTS.md`. Safety rules that apply to every change are in `.cursorrules` (mirrored in `.agents/rules.md`). If those three files disagree with this one, stop and report the conflict — do not pick a source for convenience.

---

## 1. Authority

Authoritative specifications describe **intended** FreightCode behaviour. Tests, CI and `package.json` describe **what the repository currently runs**. Application code is the **implementation**. Code may be wrong, incomplete, accidental or mid-migration.

### Hierarchy

1. Explicit current product-owner decisions, only when stated as such (this conversation or a named successor). Agents must not infer, generalise, or invent product decisions from code, tests, or older Markdown.
2. Authoritative product, architecture, behaviour, security-boundary and agent-rule documents (this file, `.cursorrules`, `AGENTS.md`, and the specs listed in §2), as they incorporate those decisions.
3. Current-state, backlog and approved build-plan documents with a live `**Status:**` line.
4. Tests, CI (`.github/workflows/tdr-regression.yml`) and `package.json` — evidence of current behaviour and the merge gates.
5. Application code — the implementation.

Do not rewrite an authoritative specification to match code. Do not treat “it already exists in the repo” as a product decision. An older Markdown sentence does not override an explicit current product-owner decision.

### When specification and code disagree

1. Do not silently change the specification to match the code.
2. Decide which of these is true, and say which: the code is defective; the specification has been intentionally superseded (named successor, `SUPERSEDED` status); or the repository is in a documented migration.
3. Preserve the intended product behaviour.
4. Report the conflict.
5. Change the specification only when there is evidence that the **product decision** itself has changed — a status-line successor, an explicit current product-owner decision, or a new approved spec. Passing tests alone are not that evidence.

**Mechanical repository facts** (npm script names and what they run, CI step order, filenames, paths) must always match the files that define them. If a command listed here disagrees with `package.json` or `tdr-regression.yml`, the file wins; fix this contract.

### When two documents disagree

- An explicit current product-owner decision vs older Markdown: follow the decision, report the stale path. Do not treat silence, code, or tests as a decision.
- Two **authoritative** docs: stop. Report both paths. Do not implement from the more convenient one.
- Authoritative spec vs tests/CI: the spec defines intended behaviour; tests/CI are evidence. Repair the implementation (or report that tests encode the wrong behaviour). Do not “fix” the spec to make the tests green unless the product decision has changed.
- Authoritative spec vs code: same as above.
- `ACTIVE` plan that looks stale (contradicts a later spec, a `SUPERSEDED` successor, or `BACKLOG.md`): do not execute it. Report it. Do not invent a new architecture to resolve it.
- `ACTIVE` plan **not** linked from `docs/hmrc/ACTIVE/tdr/BACKLOG.md`: do not treat it as current HMRC/TDR work. Other modules keep their own ACTIVE plans (see §2). If it is unclear which index owns the work, report that; do not guess.

HMRC/CDS field meaning, mapping and submission behaviour are **never** inferred from code, from Trade Test archives, or from memory. Follow `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`.

---

## 2. Documentation classes

### Authoritative — intended behaviour and agent rules

| Document | Governs |
|----------|---------|
| This file | Operating contract, verification gates, coding rules |
| `AGENTS.md` | How agents communicate and what they may do without being asked |
| `.cursorrules` | Safety rules (dataset size, deterministic tariff/VAT, AI explainer-only, no Typesense, no secrets in code) |
| `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` | All CDS validation, mapping, submission, notification and error-handling behaviour |
| `docs/hmrc/ACTIVE/tdr/mapping/` | Data-element mapping (not behaviour narrative) |
| `docs/hmrc/specs/` | HMRC reference mirrors (read-only data) |
| `docs/hmrc/ACTIVE/tdr/environment-matrix.md` | Hosts, Accept headers, OAuth |

This file does **not** define HMRC compliance rules. Read AGENT-SPEC before any HMRC/CDS work.

### Current implementation state — what is built, incomplete, or next

Status line lives directly under the title: `ACTIVE` | `DONE` | `SUPERSEDED BY <path>` | `FUTURE — not started`.

| Document | Role |
|----------|------|
| `docs/hmrc/ACTIVE/tdr/BACKLOG.md` | Live index for HMRC/TDR product and engineering work. A TDR plan it does not link is not current TDR work. |
| `docs/hmrc/ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md` | B1 / C1 / I1 completion state (linked from BACKLOG) |
| `docs/export-controls/BUILD-PLAN.md` | Export-controls module plan (ACTIVE; **not** on BACKLOG — see unresolved conflict) |
| `docs/cns/plan/` | CNS inventory-linked import plan (ACTIVE; CNS launch sequence is also in `AGENTS.md`) |

`ACTIVE` means current **intent**. It does not mean “ignore the spec if the code differs.” Never execute a plan without reading its status line. Never execute on the status line alone if a named successor exists.

Finishing a plan: update the status line in the same change; move it to the matching `ARCHIVE/` when nothing outstanding remains.

### Superseded — not design authority

| Document | Successor |
|----------|-----------|
| `docs/hmrc/ACTIVE/tdr/DELIVERY-PLAN.md` | `BACKLOG.md` |
| `docs/hmrc/FUTURE/CDS-EXPANSION-BUILD-PLAN.md` | `EXPORT-COMPLETION-CHECKLIST.md` |

Follow the successor. Do not implement from the superseded file.

### Historical / archive — never an implementation instruction

| Path | Notes |
|------|--------|
| `docs/ARCHIVE/` | Read-only |
| `docs/hmrc/ARCHIVE/` | Read-only. Trade Test v2 is debug reference only. |
| `docs/hmrc/FUTURE/production/` | HMRC production-host / CDS Live cutover material. Do not start without being asked. Not a statement that FreightCode the application is pre-production. |
| `documentation/` | Retired stubs and legacy ops copy. Not the HMRC spec tree. |
| `test-evidence/run-hmrc-scenarios.js` | Archived TT dry-run runner; output belongs under `docs/hmrc/ARCHIVE/trade-test/evidence/` |

Do not execute, update, or “fix” archive contents.

---

## 3. What FreightCode is

UK customs declarations SaaS: WCO-compliant XML to HMRC CDS for importers and brokers.

**Application status:** FreightCode is a live production application. HMRC TDR, HMRC CDS Live / production submission, OAuth hosts and credentials, CNS UAT/live, MCP/Destin8 UAT/live, and other integrations each have independently tracked status and routing. An external service being in TDR/UAT, or awaiting a particular production cutover, does not make FreightCode itself non-production. FreightCode being live does not mean every declaration is submitted to HMRC CDS Live.

**HMRC / integration environments:** Do not collapse application production and CDS routing into one “production” state. Do not invent a global HMRC routing rule. Hosts, Accept headers, and OAuth: `docs/hmrc/ACTIVE/tdr/environment-matrix.md`. CDS behaviour: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`. Trade Test archives must not influence active logic.

**Declaration categories in scope (AGENT-SPEC §0):** H1 import, B1 export, C1 simplified export, I1 simplified import. Remaining category work is tracked in `EXPORT-COMPLETION-CHECKLIST.md`, not by inventing a new plan.

**CNS product decision** (`AGENTS.md` — do not reinterpret unless the user changes it):

1. FreightCode will ultimately operate as both entry-software vendor and clearing agent.
2. First launch is software-vendor-only: each trader uses their own CNS badge, CNS/CDS account, and notification topic.
3. FreightCode will later add its own production badge for managed clearances where FreightCode acts as clearing agent/declarant.

Export-controls (LITE draft packs) is a module inside this app. It does not submit to government licensing systems. Intended regulatory facts live in `docs/export-controls/BUILD-PLAN.md` §0 — that file’s relationship to BACKLOG is an unresolved index conflict (§8).

---

## 4. Stack (implementation map)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router, React 19. Clerk middleware is `src/proxy.ts` (there is no `middleware.ts`) |
| Language | TypeScript, `strict` |
| Backend | Convex |
| Auth | Clerk, Convex JWT template |
| Payments | Stripe |
| UI | shadcn/ui, Radix, Tailwind CSS 4 |
| Search | UK Trade Tariff API (`src/lib/trade-tariff-client.ts`) + Convex reference tables. Do not add Typesense. Do not Convex-filter large tables. |
| OCR | AWS Textract |
| AI | Provider selected in `src/lib/llm-chat.ts` (`AI_PROVIDER` / `VERCEL_ENV`). OpenAI over REST in production; Groq locally. AI explains calculated values; it must not invent tariff/VAT/duty figures. |
| Document upload | HMRC Secure Document Environment |
| Deploy | Vercel (Next.js) and Convex are **separate** deployments |

---

## 5. Architecture (where code lives)

```
Browser — "use client" pages; Convex hooks; fraud-prevention headers on HMRC fetches

Next.js /src/app/api/ — HMRC proxy; Clerk auth(); Convex HTTP client with JWT
  All HMRC HTTP through src/lib/hmrc-fetch.ts. Never call HMRC from the browser.

Convex /convex/ — queries, mutations, internalMutation, schema.ts
  Subsystems include CDS, export controls, CNS, client portal, in-app notifications,
  TRE import, billing, onboarding.

CNS — optional, gated by CNS_*. Own transport and poller (convex/cns*.ts).
  Runs beside the direct HMRC path, not instead of it.

HMRC CDS
  POST /customs/declarations                         submit
  POST /customs/declarations/amend                   amend (TypeCode COR)
  POST /customs/declarations/cancellation-requests   cancel (TypeCode INV)
  GET  /customs/declarations-information/{id}/status
  GET  /notifications/conversationId/{id}/unpulled
  POST /api/hmrc/webhooks/notify                     our receiver
```

### Implementation files (not specifications)

| File | Role |
|------|------|
| `src/lib/wco-mapper.ts`, `src/lib/h1-xml-renderer.ts` | H1 payload and XML |
| `src/lib/b1-mapper.ts`, `src/lib/b1-xml-renderer.ts` | B1 |
| `src/lib/c1-mapper.ts`, `src/lib/c1-xml-renderer.ts` | C1 |
| `src/lib/i1-mapper.ts`, `src/lib/i1-xml-renderer.ts` | I1 |
| `src/lib/hmrc-fetch.ts` | HMRC fetch, fraud headers, retry |
| `src/lib/xml-utils.ts` | `xmlEscape()` — every interpolated XML value |
| `src/app/api/hmrc/submit/route.ts` | Submit + dry-run (`dryRunOnly === true`) |
| `src/app/api/hmrc/webhooks/notify/route.ts` | Push webhook |
| `src/app/api/hmrc/notifications/pull/route.ts` | Pull notifications |
| `convex/schema.ts` | Table shapes |
| `convex/declarations.ts`, `convex/goods_items.ts` | Declaration and item writes |
| `convex/notifications.ts` | HMRC notification ingest (`assertIngestSecret`) |
| `convex/app_notifications.ts` | In-app notification centre (not HMRC `notifications`) |
| `src/lib/convex-errors.ts` | `ApiError` / `userMessageFromError` — only safe user-facing error path (`tests/error-surface-consistency.test.ts`) |
| `src/proxy.ts` | Clerk middleware |

Before editing a mapper or renderer: AGENT-SPEC §7 and the relevant `docs/hmrc/ACTIVE/tdr/mapping/de-*.md`.

---

## 6. Mandatory coding rules

From `.cursorrules` and this contract. If `.cursorrules` and this section diverge, report it.

- No dataset larger than 1,000 rows in Convex. Use versioned R2 pointers (`v2026-03.json` style).
- Tariff, VAT and duty figures: hardcoded TypeScript only. AI explains; it does not calculate or override.
- No secrets in source. `.env.local` and Convex secrets only. Do not edit sensitive keys in `.env.local`.
- Typed Convex IDs (`Id<"declarations">`), never raw id strings.
- Prefer `unknown` over `any` for untrusted input; narrow before use.
- Prefix unused bindings with `_`.
- Public Convex queries and mutations authenticate with `ctx.auth.getUserIdentity()` and enforce tenant ownership (`ownerId` / `userId` / org scope). Do not add unauthenticated public data access. (`internalMutation` / `internalQuery` remain server-only.)
- After a declaration or goods-item write, refresh the declaration preview: goods_items uses a private `refreshReadModels`; representation uses a private helper onto `internal.declarations.upsertDeclarationPreview`; other writers schedule `internal.declarations.refreshDeclarationPreviewInternal`.
- Every HMRC HTTP call goes through `fetchHmrc()`. Log `X-Conversation-ID` on submit. Hosts and Accept headers: `environment-matrix.md`.
- `xmlEscape()` on every XML value.
- Next.js API routes: Clerk `auth()` first; Convex client with JWT; audit-log failures must not fail the main operation.
- `notificationType` only from HMRC-sourced events. Never synthesise DMS* rows. `notifications` is append-only. Status authority: literal DMS code → `<NameCode>` → `<FunctionCode>`.
- UI data pages: `"use client"`, `useQuery` with `"skip"` when the id is missing, `fieldErrors` keyed by field name, `getNormalizedDocs()` before display or mutation.

---

## 7. Verification

Do not treat work as complete after “the tests” in the abstract. Use the gate that matches the change. Confirm script bodies in `package.json` if this section ever looks stale.

`test:all` is **not** a superset of `test:tdr`. `test:tdr` is **not** the PR gate.

| Command | What it runs (from `package.json`) | Use when |
|---------|--------------------------------------|----------|
| `npm run test:tdr` | `test:h1` + `test:b1` + `test:c1` + `test:i1` + `test:tre` + `test:tdr-dry-run` | HMRC mapping / XML / TRE / dry-run. Minimum for those changes. |
| `npm run test:all` | `test:unit` + `test:h1` + `test:tre` + `test:cns` + `test:portal` + `test:export-controls` + `test:consultant` + `test:tdr-dry-run` | Local bundle. **Does not run b1, c1 or i1.** |
| `npm run test:unit` | `tests/!(*.integration).test.ts` | Access, filing guards, error surface |
| `npm run test:h1` / `test:b1` / `test:c1` / `test:i1` | `tests/<cat>/*.test.ts` | Single declaration category |
| `npm run test:tre` / `test:cns` | `tests/tre/*.test.ts` / `tests/cns/*.test.ts` | TRE / CNS |
| `npm run test:portal` | `tests/portal-document-policy.test.ts` + Vitest `vitest.portal.config.mts` | Portal |
| `npm run test:export-controls` | `tests/export-controls/*.test.ts` and `*.test.mjs` | Export-controls (in CI) |
| `npm run test:consultant` | Vitest `vitest.convex.config.mts` | Consultant (in CI). Vitest is not portal-only. |
| `npm run test:sanctions` | Two sanctions files only | Not in CI; `test:export-controls` already covers the directory in CI |
| `npm run test:e2e` / `test:e2e:auth` | Playwright | Not in CI. `test:e2e:auth` needs a Clerk **development** instance |
| `npx tsc --noEmit` | Typecheck | Always for TS changes |
| `npm run lint:security` | Named API + Convex auth surfaces, `--max-warnings 0` | CI lint gate |
| `npm run lint` | Repo-wide ESLint | **Not** a CI gate |
| `npm run test:tdr-dry-run` | `scripts/tdr-dry-run.mjs` | Dry-run preflight; submit route short-circuit is `dryRunOnly === true` |

HMRC rejection/resubmit loop and evidence: AGENT-SPEC §5 and §8. Do not submit, amend, cancel, or deploy unless the user authorises it (`AGENTS.md`).

### PR gate

`.github/workflows/tdr-regression.yml` on every pull_request and push to `main`:

`npm ci` → `npm audit --audit-level=high --omit=dev` → `npx tsc --noEmit` → `lint:security` → `test:unit` → `test:h1` → `test:b1` → `test:c1` → `test:i1` → `test:tre` → `test:cns` → `test:portal` → `test:export-controls` → `test:consultant` → `test:tdr-dry-run` → `npm run build`.

Playwright is not in that workflow.

### Everyday commands

```bash
npm run dev              # Next.js
npx convex dev           # required after convex/ edits; Next.js and Convex deploy separately
npm run build
npx convex deploy        # only with explicit user authorisation
npx convex env list
```

---

## 8. Unresolved documentation conflicts

Do not resolve these by guessing. Report them if the task touches the area.

- `BACKLOG.md` is the live TDR index, but `docs/export-controls/BUILD-PLAN.md` and `docs/cns/plan/` are ACTIVE and are not TDR-BACKLOG items. Ownership of “what is current work” across modules is not fully unified.
- Public Convex `query`/`mutation` authentication is a **rule** in §6. Some existing public functions do not follow it. That is an implementation defect (or an undocumented exception), not a licence to add more unauthenticated surface.
- `package.json` still depends on `typesense`. Intended search is the Trade Tariff API + Convex, not Typesense.

---

## 9. Environment variables

Next.js (Vercel) and Convex do **not** share env. A variable set in one is invisible to the other. Do not treat this list as complete — read the code and `npx convex env list` / `vercel env ls` for a given deployment.

**Required for the app to boot**

```
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_JWT_ISSUER_DOMAIN
NEXT_PUBLIC_APP_URL
```

Magic-link base: `src/lib/export-controls/email-link-base.ts`.

**HMRC** — sandbox and production credentials are separate; a sandbox client id is rejected by `api.service.hmrc.gov.uk`. Matrix: `docs/hmrc/ACTIVE/tdr/environment-matrix.md`.

```
HMRC_ENVIRONMENT
HMRC_CLIENT_ID / HMRC_CLIENT_SECRET
HMRC_SANDBOX_CLIENT_ID / HMRC_SANDBOX_CLIENT_SECRET
HMRC_PRODUCTION_CLIENT_ID / HMRC_PRODUCTION_CLIENT_SECRET
HMRC_SANDBOX_BASE_URL / HMRC_PRODUCTION_BASE_URL
HMRC_DECLARATIONS_ACCEPT / HMRC_INFORMATION_ACCEPT
HMRC_ACCEPT_V1_XML / HMRC_ACCEPT_V1_JSON / HMRC_ACCEPT_V2_XML / HMRC_ACCEPT_V2_JSON
HMRC_TOKEN_ENCRYPTION_KEY
HMRC_WEBHOOK_AUTH_TOKEN / HMRC_CDS_CALLBACK_TOKEN
HMRC_VENDOR_PUBLIC_IP / HMRC_VENDOR_PRODUCT_NAME / HMRC_VENDOR_VERSION
HMRC_TOKEN_EXPIRY_BUFFER_MS / HMRC_DEFAULT_TOKEN_EXPIRY_MS / HMRC_FETCH_TIMEOUT_MS
HMRC_RETRY_DELAY_{RATE_LIMIT,SERVER_ERROR}[_SECOND]_MS
HMRC_REQUIRE_ORG_LIVE_ON_PROD / HMRC_ALLOW_LIVE_ON_SANDBOX_DEPLOY
```

**Other subsystems** fail closed when unset:

| Subsystem | Prefix / keys |
|-----------|----------------|
| CNS | `CNS_*` |
| AI | `AI_PROVIDER`, `OPENAI_*`, `GROQ_*`, `CLOUDAGENT_*` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (price ids are Convex-side) |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Storage / OCR | `AWS_*`, `CLOUDFLARE_R2_*` |
| Ingest | `INGEST_SECRET`, `NOTIFICATION_INGEST_SECRET` |
| Third-party | `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAERSK_*`, `GEORISK_API_URL`, `OPEN_EXCHANGE_RATES_APP_ID` |
