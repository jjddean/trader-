# CLAUDE.md — Freightcode

## HMRC compliance (delegation only)

**All CDS validation, mapping, submission, and error-handling behaviour is defined in:**

`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`

Read that file before any HMRC-related work. **This file does not define compliance rules.**

Data layers (not behaviour):

| Layer | Path |
|-------|------|
| DE mapping | `docs/hmrc/ACTIVE/tdr/mapping/` |
| HMRC mirrors | `docs/hmrc/specs/` |
| Trade Test archive | `docs/hmrc/ARCHIVE/trade-test/` (read-only) |
| Production (future) | `docs/hmrc/FUTURE/production/` |

---

## Plan documents

**A plan doc is history unless its status line says ACTIVE.** Every plan under
`docs/` carries a `**Status:**` line directly under its title, in one of four
forms:

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Current intent. Safe to work from — still verify it against the code. |
| `DONE` | Built and shipped. A record of what happened, not a task list. |
| `SUPERSEDED BY <path>` | Read the named file instead. |
| `FUTURE — not started` | Approved for later. Do not start it without being asked. |

Rules:

- **Never execute a plan without checking its status line first**, and never on
  the strength of the status line alone — confirm against the code, because a
  plan can be stale in ways its own header does not admit.
- Any `ARCHIVE/` directory is **read-only**: `docs/ARCHIVE/`,
  `docs/hmrc/ARCHIVE/`. Do not execute, update or "fix" what is in them.
- `docs/hmrc/ACTIVE/tdr/BACKLOG.md` is the single live index. A plan it does not
  link is not current work.
- Finishing a plan means updating its status line in the same change, and moving
  it to the matching `ARCHIVE/` when nothing outstanding remains.

---

## What This App Is

Freightcode is a UK customs declarations SaaS — WCO-compliant XML to HMRC CDS for importers and brokers. See `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` for environment and compliance rules.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router), React 19 — note Next 16 renamed `middleware.ts` to `src/proxy.ts` |
| Language | TypeScript 5 (strict) |
| Backend / DB | Convex (real-time BaaS) |
| Auth | Clerk (with Convex JWT template) |
| Payments | Stripe |
| UI | shadcn/ui + Radix UI + Tailwind CSS 4 |
| Icons | Lucide React, Tabler Icons |
| Charts | Recharts |
| Search | UK Trade Tariff API (`src/lib/trade-tariff-client.ts`) + Convex reference tables. **Typesense was deleted** (P0-11, 2026-08-15); the npm dep is vestigial |
| OCR | AWS Textract |
| AI | OpenAI in production, Groq locally — `src/lib/llm-chat.ts` selects by `AI_PROVIDER`/`VERCEL_ENV`. OpenAI is called over plain REST, there is no `openai` dependency |
| Document upload | HMRC Secure Document Environment (S3 presigned URLs) |
| Testing | `node --test` + tsx (unit), vitest (portal), Playwright (E2E). Gated in CI by `.github/workflows/tdr-regression.yml` |
| Deployment | Vercel (production) |

---

## Architecture (code layout)

```
Browser (Next.js App Router)
  └─ "use client" pages call Convex hooks (useQuery, useMutation)
  └─ Fraud prevention headers collected client-side and forwarded in fetch()

Next.js API Routes (/src/app/api/)
  └─ HMRC proxy layer — never hit HMRC directly from the browser
  └─ Auth: Clerk auth() server-side → Convex HTTP client with JWT
  └─ All HMRC calls go through fetchHmrc() wrapper (src/lib/hmrc-fetch.ts)

Convex (convex/)
  └─ queries — read-only, auth-gated
  └─ mutations — write + side-effects (read model refresh)
  └─ internalMutation — called server-to-server only
  └─ schema.ts — source of truth for all table shapes
  └─ ~228 exported functions. HMRC/CDS is one subsystem among several:
     export controls, CNS inventory-linked imports, client portal,
     in-app notifications, TRE import, billing, onboarding

CNS (external, optional — CNS_ENABLED)
  └─ Own transport, poller and notification pipeline (convex/cns*.ts)
  └─ Runs alongside the direct HMRC path, not instead of it

HMRC CDS (external)
  └─ POST /customs/declarations → submit (FC 9)
  └─ POST /customs/declarations/amend → amend (FC 13, TypeCode COR)
  └─ POST /customs/declarations/cancellation-requests → cancel (FC 13, TypeCode INV)
  └─ GET  /customs/declarations-information/{id}/status
  └─ GET  /notifications/conversationId/{id}/unpulled
  └─ POST /api/hmrc/webhooks/notify
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/wco-mapper.ts` | Maps Convex declaration+items → WCO H1 JSON payload |
| `src/lib/h1-xml-renderer.ts` | Renders H1 JSON → CDS XML |
| `src/lib/hmrc-fetch.ts` | Wraps fetch() with fraud prevention headers + retry logic |
| `src/lib/xml-utils.ts` | `xmlEscape()` — must be used on every XML value |
| `src/app/api/hmrc/submit/route.ts` | Main submission route |
| `src/app/api/hmrc/webhooks/notify/route.ts` | HMRC push webhook receiver |
| `src/app/api/hmrc/notifications/pull/route.ts` | Pull Notifications API (two-step) |
| `convex/schema.ts` | All table definitions |
| `convex/declarations.ts` | Declaration CRUD + read model refresh |
| `convex/goods_items.ts` | Items CRUD |
| `convex/notifications.ts` | saveWebhook mutation — ingest-secret gated, constant-time compare |
| `src/proxy.ts` | Clerk middleware. Next 16 name — there is no `middleware.ts` |
| `src/lib/convex-errors.ts` | `ApiError` / `userMessageFromError` — the only safe way to surface an error to a user. Enforced repo-wide by `tests/error-surface-consistency.test.ts` |
| `src/lib/api-rate-limiter.ts` | Rate limiting for AI, export-control and tariff routes |
| `convex/export_controls.ts` | Export-control assessments; see also `compliance_consultant.ts`, `compliance_end_user.ts`, `sanctions_data.ts` |
| `convex/cns.ts`, `convex/cns_notifications.ts` | CNS inventory-linked imports — separate transport, poller and 34 `CNS_*` env vars |
| `convex/app_notifications.ts` | In-app notification centre (distinct from HMRC `notifications.ts`) |
| `convex/client_portal.ts` | Client portal access and document policy |
| `test-evidence/run-hmrc-scenarios.js` | **Archived** TT dry-run runner (output → `docs/hmrc/ARCHIVE/trade-test/evidence/`) |

---

## Coding Conventions

### TypeScript
- Use typed Convex IDs: `Id<"declarations">`, `Id<"goods_items">` — never raw strings
- Prefer `unknown` over `any` for external/untrusted data; narrow before use
- Variables prefixed `_` are intentionally unused — ESLint ignores them
- No unused imports (enforced by `eslint-plugin-unused-imports`)

### Convex Mutations & Queries
- Every mutation and query **must** call `ctx.auth.getUserIdentity()` and throw if unauthenticated
- Ownership check pattern: fetch the parent record, compare `ownerId`/`userId` to `identity.subject`
- After a write, refresh the read model the right way for the table: `refreshReadModels()` is a **private helper inside `convex/goods_items.ts`** and is not importable; declarations use `refreshDeclarationPreview()` (`convex/representation.ts`) or schedule `internal.declarations.refreshDeclarationPreviewInternal`
- Schema fields use `v.optional(v.any())` broadly — validate shapes at the mutation arg level

### HMRC API Calls
- **All** HMRC calls through `fetchHmrc()` in `src/lib/hmrc-fetch.ts` — never direct `fetch()` to HMRC
- Token expiry: refresh if `expiresAt` within 5 minutes
- Log `X-Conversation-ID` on every submission
- Accept headers and API host: `docs/hmrc/ACTIVE/tdr/environment-matrix.md`

### XML Generation
- Before editing mapper/renderer: read `docs/hmrc/ACTIVE/tdr/mapping/de-*.md` (per AGENT-SPEC §7)
- `xmlEscape()` on every interpolated XML value — no exceptions

### Next.js API Routes
- Validate Clerk auth first: `const { userId } = await auth()`
- Build Convex client with Clerk JWT: `convex.setAuth(convexToken)`
- Wrap audit log calls in try/catch — audit failures must not crash the main operation
- Return `NextResponse.json()` for JSON; `new Response(null, { status: 200 })` for empty ACKs

### Notifications
- `notificationType` from HMRC-sourced events only — never synthesise DMS* notifications
- Status authority: literal DMS code → `<NameCode>` → `<FunctionCode>` fallback
- `notifications` table is immutable append-only

### UI / React
- Data pages are `"use client"` with Convex hooks
- Pass `"skip"` to `useQuery` when ID unavailable
- `fieldErrors` state keyed by field name string
- Normalise document arrays with `getNormalizedDocs()` before display or mutation

---

## Testing

```bash
npm run test:all         # unit + h1 + tre + cns + portal + tdr-dry-run
npm run test:unit        # access, filing guards, error surface
npm run test:h1          # H1 mapper/renderer + golden XML
npm run test:tdr         # HMRC merge gate: h1 + tre + dry-run
npm run test:sanctions   # export-control sanctions screening
npm run test:e2e:auth    # Playwright, needs a Clerk *development* instance
npx playwright test      # full E2E

# Archived TT dry-run (no HMRC call) — output under docs/hmrc/ARCHIVE/trade-test/evidence/
node test-evidence/run-hmrc-scenarios.js
```

CI (`.github/workflows/tdr-regression.yml`) gates every PR on: `npm audit`
(high, prod deps), `tsc --noEmit`, `lint:security`, unit, h1, tre, cns, portal,
tdr-dry-run and a production build.

`tests/export-controls/` is **not** fully wired to a script — only the two
sanctions files run, via `test:sanctions`, which CI does not call.

TDR submission testing: follow `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` §5 and §8.

Dry-run preflight gate: `src/app/api/hmrc/submit/route.ts` — validation from ~line 88, dry-run short-circuit at ~444–480, in a 931-line route.

---

## Common Commands

```bash
npm run dev              # Next.js dev server
npx convex dev           # Convex watch mode
npm run build            # Production build
npm run lint:security    # The actual lint gate — API + Convex auth surfaces, zero warnings
npm run lint             # Repo-wide ESLint. NOT a CI gate: ~390 known errors, cleanup backlog
npx convex deploy        # Push schema + functions
npx convex env list      # Deployment env vars (--prod for production)
```

---

## Environment Variables

`src/` and `convex/` reference **111** distinct variables. Do not treat any list
here as complete — check the code, and `npx convex env list` / `vercel env ls`
for what a deployment actually has. Note that Next.js routes and Convex functions
read from **separate** environments: a variable set in Vercel is invisible to a
Convex function and vice versa.

**Core — nothing runs without these**

```
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_JWT_ISSUER_DOMAIN
NEXT_PUBLIC_APP_URL            # magic-link base; see src/lib/export-controls/email-link-base.ts
```

**HMRC** — sandbox and production credentials are separate; a sandbox client ID is
rejected by `api.service.hmrc.gov.uk`. Full matrix:
`docs/hmrc/ACTIVE/tdr/environment-matrix.md`

```
HMRC_ENVIRONMENT               # "sandbox" | "production"
HMRC_CLIENT_ID / HMRC_CLIENT_SECRET
HMRC_SANDBOX_CLIENT_ID / HMRC_SANDBOX_CLIENT_SECRET
HMRC_PRODUCTION_CLIENT_ID / HMRC_PRODUCTION_CLIENT_SECRET
HMRC_SANDBOX_BASE_URL / HMRC_PRODUCTION_BASE_URL
HMRC_DECLARATIONS_ACCEPT / HMRC_INFORMATION_ACCEPT
HMRC_ACCEPT_V1_XML / HMRC_ACCEPT_V1_JSON / HMRC_ACCEPT_V2_XML / HMRC_ACCEPT_V2_JSON
HMRC_TOKEN_ENCRYPTION_KEY      # at-rest encryption for stored OAuth tokens
HMRC_WEBHOOK_AUTH_TOKEN / HMRC_CDS_CALLBACK_TOKEN
HMRC_VENDOR_PUBLIC_IP / HMRC_VENDOR_PRODUCT_NAME / HMRC_VENDOR_VERSION
HMRC_TOKEN_EXPIRY_BUFFER_MS / HMRC_DEFAULT_TOKEN_EXPIRY_MS / HMRC_FETCH_TIMEOUT_MS
HMRC_RETRY_DELAY_{RATE_LIMIT,SERVER_ERROR}[_SECOND]_MS
HMRC_REQUIRE_ORG_LIVE_ON_PROD / HMRC_ALLOW_LIVE_ON_SANDBOX_DEPLOY   # live-flip guards
```

**Other subsystems** — each fails closed when unset, so absence is silent:

| Subsystem | Prefix | Notes |
|-----------|--------|-------|
| CNS inventory-linked imports | `CNS_*` (34 vars) | Not set on Convex production — every CNS path fails there |
| AI | `AI_PROVIDER`, `OPENAI_*`, `GROQ_*`, `CLOUDAGENT_*` | Provider chosen by `AI_PROVIDER` or `VERCEL_ENV` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` | Price IDs live in **Convex**, not Vercel |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Unset means links are still created, no email sent |
| Storage / OCR | `AWS_*`, `CLOUDFLARE_R2_*` | Textract and R2 |
| Ingest secrets | `INGEST_SECRET`, `NOTIFICATION_INGEST_SECRET` | Webhook and notification ingest gates |
| Third-party | `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAERSK_*`, `GEORISK_API_URL`, `OPEN_EXCHANGE_RATES_APP_ID` | |
