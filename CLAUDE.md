# CLAUDE.md — TradeDNA

## NON-NEGOTIABLE: NO INFERENCE, NO INVENTED DATA

Before stating any claim about how this codebase behaves, you must have read the relevant file in this session. If you haven't, say "I haven't read X yet" and either read it or stop. Do not propose mechanisms, diagnoses, or fixes from screenshots, error messages, or inference. Every validation rule must cite a source: Appendix 21A row, CDS error code from the .ods list, HMRC GitHub schema, or explicit user instruction. No citation, no rule. If you find yourself writing "likely", "probably", "I think", "this means" — stop and read instead.

---

## FREIGHTCODE AGENT RULES (CDS Submission)

### OBJECTIVE
Produce a UK CDS declaration that is ACCEPTED (0 validation errors).
Success = HMRC CDS returns no errors.
Failure = Any CDSxxxx validation code present.

### 1. MINIMAL VALID FIRST
- Always construct the smallest possible valid declaration.
- Exactly: 1 goods item (68A), 1 document (70A) → invoice only.
- Do NOT include: additional information (99B), authorisations (64A), multiple documents, preference claims, special procedures.
- Never build a "complete" declaration first.

### 2. NEVER PATCH — ALWAYS REBUILD
- Do NOT modify existing payloads.
- Always generate a fresh declaration from scratch.
- Old payloads are considered contaminated.

### 3. STRICT ERROR REDUCTION LOOP
On rejection: Group → Identify root cause category → Fix ONLY that category → Resubmit. Never fix multiple categories at once. Categories: CDS100xx (core/header), CDS1207x (goods item), CDS11004/CDS77002 (documents), CDS12005/CDS10020 (authorisations).

### 4. NO GUESSING (HARD RULE)
Every field must map to: CDS Declaration Completion Instructions OR official HMRC code lists (.ods). If mapping is unknown → STOP and report missing mapping. Do NOT invent: document codes, procedure codes, additional info, authorisations.

### 5. DOCUMENT DISCIPLINE (CRITICAL)
70A rules: only 1 document in minimal phase, must be valid for CPC + commodity. Forbidden: Y codes, multiple 02A sequences, mixing document types. If CDS11004 or CDS77002 occurs → remove documents, rebuild clean.

### 6. GOODS ITEM RULES
68A must include: commodity code (valid), procedure code (simple import), origin country, weight > 0, value > 0. Constraints: exactly 1 item, no repeated sequences, no conditional fields unless required.

### 7. HEADER + PARTIES
42A + 57A must include: declarant (valid EORI), importer (valid EORI), LRN, office of presentation, location ID, currency. Missing any → CDS10001 / CDS10002.

### 8. FORBIDDEN BEHAVIOUR
The agent MUST NOT: add fields "to see if it works", increase payload complexity after failure, duplicate structures, mix header-level and item-level data incorrectly, attempt full compliance builds before minimal passes.

### 9. SUCCESS PATH
Phase 1 → minimal declaration passes (0 errors).
Phase 2 → add ONE feature at a time (additional document, additional info, preference, authorisation). Each addition must pass before the next is added.

### 10. OUTPUT FORMAT (MANDATORY)
Every response must include:
1. Root cause (max 5 bullets)
2. Fix applied (exact fields changed)
3. Updated payload
4. Expected CDS outcome

No explanations, no filler.

### FINAL RULE
If error count increases after a change → revert immediately → return to last known working structure. The goal is convergence, not exploration.

---

## What This App Is

TradeDNA (deployed as freightcode.co.uk) is a UK customs declarations SaaS. Its core mission is to submit WCO-compliant XML declarations to HMRC's Customs Declaration Service (CDS) on behalf of UK importers and customs brokers. The end goal is HMRC "Recognised Software" status, gated behind the Trader Dress Rehearsal (TDR) process.

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
| AI | Groq SDK |
| Document upload | HMRC Secure Document Environment (S3 presigned URLs) |
| Testing | Playwright (E2E), manual HMRC scenario scripts |
| Deployment | Vercel (production) |

---

## Architecture

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
  └─ POST /customs/declarations  → submit (FunctionCode 9), amend (FunctionCode 13), cancel (FunctionCode 13 + TypeCode INV)
                                  All three operations hit the SAME endpoint; the FunctionCode + TypeCode in the XML differentiates them.
  └─ GET  /customs/declarations-information/{id}/status
  └─ GET  /notifications/conversationId/{id}/unpulled → pull notifications
  └─ POST /api/hmrc/webhooks/notify     → HMRC pushes DMS* events here
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/wco-mapper.ts` | Maps Convex declaration+items → WCO H1 JSON payload |
| `src/lib/hmrc-fetch.ts` | Wraps fetch() with fraud prevention headers + retry logic |
| `src/lib/xml-utils.ts` | `xmlEscape()` — must be used on every XML value |
| `src/app/api/hmrc/submit/route.ts` | Main submission route (token refresh, map, validate, submit) |
| `src/app/api/hmrc/webhooks/notify/route.ts` | HMRC push webhook receiver |
| `src/app/api/hmrc/notifications/pull/route.ts` | Pull Notifications API (two-step) |
| `convex/schema.ts` | All table definitions |
| `convex/declarations.ts` | Declaration CRUD + savings estimates + read model refresh |
| `convex/goods_items.ts` | Items CRUD — always calls refreshReadModels() after write |
| `convex/notifications.ts` | saveWebhook mutation — called by both push and pull routes |
| `test-evidence/run-hmrc-scenarios.js` | Manual TDR scenario runner (dry-run + single submit) |
| `documentation/hmrc_tdr_audit/` | 3131-rule TDR audit artefacts |

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
- After any write that affects declarations or items, call `refreshReadModels(ctx, declarationId)` to keep `declaration_preview` and `dashboard_summary` in sync
- Schema fields use `v.optional(v.any())` broadly — validate shapes at the mutation arg level, not the schema level

### HMRC API Calls
- **All** calls to HMRC endpoints must go through `fetchHmrc()` in `src/lib/hmrc-fetch.ts` — never call `fetch()` directly against HMRC
- `fetchHmrc()` injects all required fraud prevention headers and handles 429 retry (2s → 5s)
- Token expiry check: if `expiresAt` is within 5 minutes, refresh before submitting
- Log `X-Conversation-ID` on every submission — this is the primary HMRC tracking handle

### XML Generation
- `xmlEscape()` must wrap every interpolated value in XML templates — no exceptions
- GovernmentProcedure encoding (CDS DE 1/10 and DE 1/11):
  - DE 1/10: TWO `<GovernmentProcedure>` elements — `<CurrentCode>` = first 2 chars, `<PreviousCode>` = chars 3-4
  - DE 1/11: separate `<GovernmentProcedure>` with `<CurrentCode>` = 3-char additional procedure code
  - Example for `procedureCode="4000"`, `additionalProcedureCode="000"`:
    ```xml
    <GovernmentProcedure><CurrentCode>40</CurrentCode><PreviousCode>00</PreviousCode></GovernmentProcedure>
    <GovernmentProcedure><CurrentCode>000</CurrentCode></GovernmentProcedure>
    ```

### Next.js API Routes
- Always validate Clerk auth first: `const { userId } = await auth()`
- Build Convex client inside the handler with the Clerk JWT: `convex.setAuth(convexToken)`
- Wrap audit log calls in try/catch — audit failures must not crash the main operation
- Return `NextResponse.json()` for JSON, `new Response(null, { status: 200 })` for empty ACKs (e.g., webhook receiver)

### Notifications
- `notificationType` must be derived from HMRC-sourced events only — never synthesise or inject fake DMS* notifications
- Status authority order: literal DMS code string → `<NameCode>` element → `<FunctionCode>` numeric fallback
- The `notifications` table is an immutable audit log — never update or delete rows

### UI / React
- All data pages are `"use client"` with Convex `useQuery`/`useMutation` hooks
- Pass `"skip"` to `useQuery` when the required ID is not yet available (prevents spurious calls)
- `fieldErrors` state for inline validation messages — key by field name string
- Normalise document arrays with `getNormalizedDocs()` pattern before display or mutation

---

## Testing Approach

### Dry-Run Gate (mandatory before any TDR submission)
```bash
# Dry run only — no HMRC call made
node test-evidence/run-hmrc-scenarios.js
# Check test-evidence/tdr-cds-v1-dry-run.json — all checks must pass
```

### Single Controlled Submit (TDR)
```bash
# ONE submission — requires explicit env vars
DRY_RUN_ONLY=false HMRC_SUBMIT_ONCE=true node test-evidence/run-hmrc-scenarios.js
# Evidence files: tdr-cds-v1-request.xml, tdr-cds-v1-response.xml, scenario-summary.json
```

### Playwright (E2E)
```bash
npx playwright test
```

There is no Jest/unit test suite. The submission path is validated by the dry-run preflight gate in `submit/route.ts:L71-L313`, not by automated unit tests.

---

## Common Commands

```bash
# Development
npm run dev              # Next.js dev server (localhost:3000)
npx convex dev           # Convex in watch mode (required alongside dev server)

# Build
npm run build            # Production build — must pass before deploying

# Lint
npm run lint             # ESLint across all src/ and convex/
# ~6215 problems currently — focus on hmrc submit/notify/items flows for TDR

# Convex schema push
npx convex deploy        # Push schema + functions to Convex cloud

# TDR scenario runner
node test-evidence/run-hmrc-scenarios.js                                    # dry-run
DRY_RUN_ONLY=false HMRC_SUBMIT_ONCE=true node test-evidence/run-hmrc-scenarios.js  # live submit
```

---

## Environment Variables (Required)

```
NEXT_PUBLIC_CONVEX_URL       # Convex deployment URL
HMRC_CLIENT_ID               # HMRC Developer Hub application client ID
HMRC_CLIENT_SECRET           # HMRC Developer Hub application client secret
HMRC_ENVIRONMENT             # "sandbox" | "production"
HMRC_DECLARATIONS_ACCEPT     # "application/vnd.hmrc.1.0+xml" (sandbox/TDR)
HMRC_EORI                    # GB-format EORI for test submissions
HMRC_TEST_SCENARIO           # Gov-Test-Scenario header value (e.g. HAPPY_PATH)
HMRC_WEBHOOK_AUTH_TOKEN      # Bearer token HMRC uses when pushing notifications
HMRC_VENDOR_PUBLIC_IP        # Vendor server IP for Gov-Vendor-Public-IP header
HMRC_TEST_USER_ID            # Convex userId for token lookup in scenario runner
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

---

## TDR Critical Rules (DO / DO NOT)

### Always Do
- Run the dry-run gate and confirm all checks pass before any TDR submission
- Use `fetchHmrc()` for every HMRC API call — never bypass it
- `xmlEscape()` every value interpolated into XML
- Validate ownership in every Convex mutation before writing
- Log `X-Conversation-ID` and store it on the declaration immediately after submission
- Keep notification `rawPayload` stored verbatim — it is the audit chain
- Derive declaration status from HMRC-sourced notifications only
- Call `refreshReadModels()` after every goods_items write

### Never Do
- Never call HMRC endpoints without going through `fetchHmrc()`
- Never inject synthetic or fake DMS* notifications into the `notifications` table
- Never submit to TDR in a loop or via automated test suites
- Never hardcode HMRC tokens, client secrets, or webhook auth tokens in source files
- Never skip the dry-run preflight gate before a TDR submission
- Never submit more than 5 declarations in a single TDR session
- Never use `ExportCountry.ID = "GB"` on an import from overseas — must be the actual dispatch country
- Never mix test-evidence artifacts (synthetic status) with HMRC-derived status on the dashboard
- Never patch the `notifications` table rows — treat them as immutable append-only records
- Never run `git push --force` to main

---

## TDR Status (as of 2026-04-09)

- **Current standing:** Not pass-ready — blocked on CDS12050 business-rule rejection
- **Root cause:** Declaration content non-compliance — document context mismatch for current commodity/procedure/origin lane (HS 0207129000, CPC 4000 000, origin BR) — specifically 42A/67A/68A/70A additional document requirements
- **Infrastructure status:** Transport, auth, webhook, and schema are stable
- **Immediate path:** Data correction → signed tariff-document matrix → dry-run pass → one controlled submit → full notification evidence chain (DMSACC → DMSCLE)
- **Evidence governance:** Authoritative status must derive only from HMRC events; synthetic notifications must never enter the notification store
- **TDR contacts:** TDRcommunications@hmrc.gov.uk, SoftwareDeveloperSupport@hmrc.gov.uk
