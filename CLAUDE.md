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
| Framework | Next.js 16.1.6 (App Router), React 19 |
| Language | TypeScript 5 (strict) |
| Backend / DB | Convex (real-time BaaS) |
| Auth | Clerk (with Convex JWT template) |
| Payments | Stripe |
| UI | shadcn/ui + Radix UI + Tailwind CSS 4 |
| Icons | Lucide React, Tabler Icons |
| Charts | Recharts |
| Search | Typesense |
| OCR | AWS Textract |
| AI | OpenAI in production, Groq locally — `src/lib/llm-chat.ts` selects by `AI_PROVIDER`/`VERCEL_ENV` |
| Document upload | HMRC Secure Document Environment (S3 presigned URLs) |
| Testing | Playwright (E2E), manual HMRC scenario scripts |
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
| `convex/notifications.ts` | saveWebhook mutation |
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
- After any write that affects declarations or items, call `refreshReadModels(ctx, declarationId)`
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
# Archived TT dry-run (no HMRC call) — output under docs/hmrc/ARCHIVE/trade-test/evidence/
node test-evidence/run-hmrc-scenarios.js

# Playwright E2E
npx playwright test
```

TDR submission testing: follow `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` §5 and §8.

Dry-run preflight gate: `src/app/api/hmrc/submit/route.ts` (lines ~71–313).

---

## Common Commands

```bash
npm run dev              # Next.js dev server
npx convex dev           # Convex watch mode
npm run build            # Production build
npm run lint             # ESLint
npx convex deploy        # Push schema + functions
```

---

## Environment Variables (Required)

```
NEXT_PUBLIC_CONVEX_URL
HMRC_CLIENT_ID
HMRC_CLIENT_SECRET
HMRC_ENVIRONMENT             # "sandbox" | "production" — TDR uses production host
HMRC_DECLARATIONS_ACCEPT     # TDR: application/vnd.hmrc.1.0+xml (see environment-matrix.md)
HMRC_SANDBOX_BASE_URL
HMRC_PRODUCTION_BASE_URL
HMRC_ACCEPT_V2_XML
HMRC_ACCEPT_V2_JSON
HMRC_ACCEPT_V1_XML
HMRC_EORI
HMRC_TEST_SCENARIO
HMRC_WEBHOOK_AUTH_TOKEN
HMRC_VENDOR_PUBLIC_IP
HMRC_VENDOR_PRODUCT_NAME
HMRC_VENDOR_VERSION
HMRC_TOKEN_EXPIRY_BUFFER_MS
HMRC_DEFAULT_TOKEN_EXPIRY_MS
HMRC_RETRY_DELAY_RATE_LIMIT_MS
HMRC_RETRY_DELAY_SERVER_ERROR_MS
HMRC_RETRY_DELAY_RATE_LIMIT_SECOND_MS
HMRC_RETRY_DELAY_SERVER_ERROR_SECOND_MS
HMRC_TEST_USER_ID
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

Full matrix: `docs/hmrc/ACTIVE/tdr/environment-matrix.md`
