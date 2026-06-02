# CLAUDE.md — Freightcode

## NON-NEGOTIABLE: NO INFERENCE, NO INVENTED DATA

Before stating any claim about how this codebase behaves, you must have read the relevant file in this session. If you haven't, say "I haven't read X yet" and either read it or stop. Do not propose mechanisms, diagnoses, or fixes from screenshots, error messages, or inference. Every validation rule must cite a source: `spec/` entry (HMRC URL + retrieval date + verbatim text), Appendix 21A row, CDS error code from the .ods list, HMRC XSD validation response, or explicit user instruction. No citation, no rule. If you find yourself writing "likely", "probably", "I think", "this means" — stop and read instead.

**Authoritative spec:** `spec/README.md` — index, source policy, mapper change protocol. Per-DE files under `spec/de-*.md`. Verbatim HMRC mirrors under `spec/hmrc-mirror/`. DMSREJ history: `spec/errors-handled.md`. Active lane: `spec/lane.md`.

**Unofficial until re-validated against HMRC:** `documentation/HMRC/`, `convex/lib/cds_h1_data_elements.ts`, `convex/lib/cds_wco_references.ts`, `src/lib/cds_error_codes.ts`, `test-evidence/archive-pre-p0/*.xml`.

**DMSREJ** is negative evidence only. **First DMSACC (0 errors)** → freeze request XML as `spec/passing-payload.xml` and copy to `test-evidence/passing/` for regression baseline.

---

## FREIGHTCODE AGENT RULES (CDS Submission)

### OBJECTIVE
Produce a UK CDS declaration that is ACCEPTED (0 validation errors).
Success = HMRC CDS returns no errors.
Failure = Any CDSxxxx validation code present.

### 1. MINIMAL VALID FIRST
- Always construct the smallest possible valid declaration for the **active lane** in `spec/lane.md`.
- Default bootstrap: 1 goods item (68A), 1 document (70A) → invoice only (N935).
- Do NOT add until spec-cited or DMSREJ proves required: additional information (99B), authorisations (64A), extra documents, preference claims, special procedures.
- The **current Trade Test lane** may already include more than bootstrap (e.g. N935 + N271) — do not strip documented lane fields to force bootstrap; converge errors without removing spec/lane.md values unless a rejection proves them invalid.

### 2. NEVER PATCH — ALWAYS REBUILD
- Do NOT modify existing payloads.
- Always generate a fresh declaration from scratch.
- Old payloads are considered contaminated.

### 3. STRICT ERROR REDUCTION LOOP
On rejection: Record in `spec/errors-handled.md` → Group → Identify root cause category → Fix ONLY that category → Resubmit. Never fix multiple categories at once.

| Category | Typical codes |
|----------|----------------|
| Core / header / XSD | CDS100xx, HMRC `BAD_REQUEST` / `xml_validation_error` |
| Goods item / origin / valuation | CDS1207x, CDS12077 |
| Documents | CDS11004, CDS77002 |
| Goods location DE 5/23 | CDS10001, CDS12099, CDS12070 on 64A |
| Parties / country linkage | CDS12073, CDS12056 |
| Named CDS rules (unsourced in Vol 3) | CDS12005 (R123, R038, etc.) |

### 4. NO GUESSING (HARD RULE)
Every field must map to: `spec/` (HMRC URL + retrieval date + verbatim text), Tariff Vol 3 completion guide, or official HMRC code lists (.ods). If mapping is unknown → STOP and report missing mapping. Do NOT invent: document codes, procedure codes, additional info, authorisations, XML element placement.

**Inference exception:** Only when the user explicitly approves inference for a specific DE (e.g. DE 5/23 split). Document as `INFERENCE` in the relevant `spec/de-*.md` with DMSREJ/XSD evidence — never claim HMRC citation.

### 5. DOCUMENT DISCIPLINE (CRITICAL)
70A / DE 2/3: each document code must have a row in Appendix 5A (Union/National) for the lane. Union codes before National on the same item. Status codes only where Appendix 5A column permits.

Active lane documents: see `spec/lane.md` (currently N935 + N271 with status AC — verify in Appendix 5A ODS).

If CDS11004 or CDS77002 → fix document code/status/reference per Appendix 5A; do not add Y codes or extra documents without spec citation.

### 6. GOODS ITEM RULES
68A must include: commodity code (valid), procedure code (4000 + 000 for current lane), **origin country DE 5/15 always mandatory** (Group 5), weight > 0, value > 0, packaging (DE 6/9–6/11). Exactly 1 item for current lane unless spec expands.

### 7. HEADER + PARTIES
42A + 57A must include: declarant EORI (DE 3/18), importer EORI (DE 3/16), LRN, goods location (DE 5/23 per `spec/de-5-23-goods-location.md`), dispatch/export (DE 5/14), destination (DE 5/8), invoice currency on amounts.

Foreign exporter (DE 3/1): Name + Address when dispatch ≠ GB/XI — see `spec/de-3-x-parties.md`. Seller/Buyer (DE 3/24, 3/26) are optional (D) — omitted by mapper unless spec requires.

### 8. FORBIDDEN BEHAVIOUR
The agent MUST NOT: add fields "to see if it works", increase payload complexity after failure, duplicate structures, mix header-level and item-level data incorrectly, attempt full compliance builds before minimal passes.

### 9. SUCCESS PATH
**Phase A — Structural validation (current):** DMSREJ count → 0 on Trade Test. XSD must pass before CDS business rules run.

**Phase B — Operational (after first DMSACC):** MRN issued → notifications (DMSACC, DMSRCV, DMSREQ, DMSCLE, etc.) → status from HMRC events only.

**Phase C — Regression:** Freeze accepted request XML as `spec/passing-payload.xml` + `test-evidence/passing/` — baseline for mapper and dry-run.

Phase 2 (post–0-error lane): add ONE feature at a time (extra document, additional info, preference, authorisation). Each addition must pass before the next is added.

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

Freightcode is a UK customs declarations SaaS. Its core mission is to submit WCO-compliant XML declarations to HMRC's Customs Declaration Service (CDS) on behalf of UK importers and customs brokers. The system currently runs on **Trade Test v2.0** (sandbox) and **v2.0** (production). The long-term goal is HMRC "Recognised Software" status, which requires passing the Trader Dress Rehearsal (TDR) process — this is a future phase, not the current active environment.

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
| `test-evidence/run-hmrc-scenarios.js` | Trade Test v2.0 scenario runner (dry-run + single submit) |
| `documentation/hmrc_tdr_audit/` | 3131-rule CDS compliance audit artefacts (generated, documentation only) |

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
- Read `spec/de-*.md` for the DE being changed before editing `wco-mapper.ts` or `h1-xml-renderer.ts`
- DE 5/23: `src/lib/goods-location.ts` splits Appendix 16C consolidated codes; renderer emits split shape — see `spec/de-5-23-goods-location.md`
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

### Dry-Run Gate (mandatory before any Trade Test submission)
```bash
# Dry run only — no HMRC call made
node test-evidence/run-hmrc-scenarios.js
# Check test-evidence/trade-test-cds-v2-dry-run.json — all checks must pass
```

### Single Controlled Submit (Trade Test v2.0)
```bash
# ONE submission — requires explicit env vars
DRY_RUN_ONLY=false HMRC_SUBMIT_ONCE=true node test-evidence/run-hmrc-scenarios.js
# Evidence files: trade-test-cds-v2-request.xml, trade-test-cds-v2-response.xml, scenario-summary.json
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
# ~6215 problems currently — focus on hmrc submit/notify/items flows

# Convex schema push
npx convex deploy        # Push schema + functions to Convex cloud

# Trade Test v2.0 scenario runner
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
HMRC_DECLARATIONS_ACCEPT     # "application/vnd.hmrc.2.0+xml" (Trade Test sandbox + production)
HMRC_SANDBOX_BASE_URL        # Sandbox HMRC API base URL
HMRC_PRODUCTION_BASE_URL     # Production HMRC API base URL
HMRC_ACCEPT_V2_XML           # HMRC v2 XML Accept header
HMRC_ACCEPT_V2_JSON          # HMRC v2 JSON Accept header
HMRC_ACCEPT_V1_XML           # HMRC v1 XML Accept header
HMRC_EORI                    # GB-format EORI for test submissions
HMRC_TEST_SCENARIO           # Gov-Test-Scenario header value (e.g. HAPPY_PATH)
HMRC_WEBHOOK_AUTH_TOKEN      # Bearer token HMRC uses when pushing notifications
HMRC_VENDOR_PUBLIC_IP        # Vendor server IP for Gov-Vendor-Public-IP header
HMRC_VENDOR_PRODUCT_NAME     # Product name sent in Gov-Vendor headers
HMRC_VENDOR_VERSION          # Product version sent in Gov-Vendor headers
HMRC_TOKEN_EXPIRY_BUFFER_MS  # Refresh buffer before token expiry
HMRC_DEFAULT_TOKEN_EXPIRY_MS # Fallback token expiry value
HMRC_RETRY_DELAY_RATE_LIMIT_MS
HMRC_RETRY_DELAY_SERVER_ERROR_MS
HMRC_RETRY_DELAY_RATE_LIMIT_SECOND_MS
HMRC_RETRY_DELAY_SERVER_ERROR_SECOND_MS
HMRC_TEST_USER_ID            # Convex userId for token lookup in scenario runner
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

---

## CDS Submission Rules (DO / DO NOT)

### Always Do
- Run the dry-run gate and confirm all checks pass before any Trade Test submission
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
- Never submit in a loop or via automated test suites
- Never hardcode HMRC tokens, client secrets, or webhook auth tokens in source files
- Never skip the dry-run preflight gate before a submission
- Never submit more than 5 declarations in a single controlled test session
- Never use `ExportCountry.ID = "GB"` on an import from overseas — must be the actual dispatch country
- Never mix test-evidence artifacts (synthetic status) with HMRC-derived status on the dashboard
- Never patch the `notifications` table rows — treat them as immutable append-only records
- Never run `git push --force` to main
- Never use invalid Appendix 16C codes — verify against `spec/hmrc-mirror/appendix-16c-maritime.psv` (Felixstowe = `GBAUFXTFXTFXT`, not `GBAUFXTFXTGW`)

---

## Trade Test Status (as of 2026-05-28)

- **Current environment:** Trade Test v2.0 (sandbox) — NOT TDR
- **Active lane:** See `spec/lane.md` — HS 8471300000, CPC 4000 000, dispatch/origin DE, port **GBAUFXTFXTFXT** (Felixstowe, Appendix 16C ODS 2026-05-18)
- **Phase:** Business-rule validation — converging DMSREJ count (was 11–12 → 8 → 6 → **4** as of 2026-05-31 FC-MPUBBYAS; XSD + GoodsLocation + DE 2/2 `00500` stable)
- **DE 5/23:** Consolidated code split to `ID` + `TypeCode` + `Address(TypeCode, CountryCode)` — inference in `spec/de-5-23-goods-location.md`; XSD rejected top-level `CountryCode`
- **Infrastructure status:** Transport, auth, webhook, and XSD preflight are stable
- **Immediate path:** Fix CDS12073 — `67A`/`68A` TagID **103** = `TransactionNatureCode` (DE 8/5); renderer must emit mapper JSON → defer R123/R038 → first **DMSACC** → freeze `spec/passing-payload.xml`
- **Evidence governance:** Authoritative status must derive only from HMRC events; synthetic notifications must never enter the notification store
- **HMRC contacts:** TDRcommunications@hmrc.gov.uk, SoftwareDeveloperSupport@hmrc.gov.uk

> **Future roadmap:** TDR (Trader Dress Rehearsal) is the eventual path to HMRC "Recognised Software" status. It uses v1.0 headers and requires explicit HMRC allowlisting. This is a future phase — do not apply TDR configuration to the current Trade Test environment.
