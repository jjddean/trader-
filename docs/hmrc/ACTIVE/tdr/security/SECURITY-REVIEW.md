# Security Review — Freightcode HMRC Readiness

**Date:** 2026-06-14  
**Scope:** Next.js App Router, API routes, Convex backend, Clerk auth, Stripe, HMRC proxy layer  
**Methodology:** Static code review aligned with NCSC penetration testing guide and OWASP API Top 10  
**Status:** Pre-production (TDR sandbox active; production credentials pending)

---

## Executive summary

Freightcode has **strong HMRC-specific controls**: server-side `fetchHmrc()` proxy, fraud-prevention header validation, webhook bearer-token checks, declaration ownership on core CRUD paths, and immutable notification storage.

**Blockers before production credentials / external pen test:**

| # | Severity | Issue |
|---|----------|-------|
| S-01 | Critical | Public Convex mutations can alter subscriptions without Stripe signature verification |
| S-02 | Critical | `@clerk/nextjs` npm audit: middleware route-protection bypass (CVE) |
| S-03 | High | `/api/stripe/portal` unauthenticated IDOR on Stripe customer IDs |
| S-04 | High | Convex HTTP routes fall back to guessable default secrets |
| S-05 | High | Several Convex queries/mutations lack auth or ownership checks |
| S-06 | High | Unauthenticated AI routes (`/api/ai/extract`, `/api/ai/classify`) — cost/abuse |
| S-07 | Moderate | 28 npm vulnerabilities (2 critical, 14 high) |
| S-08 | Moderate | ESLint broken — security lint rules not enforced in CI |

**Positive controls observed:**

- `src/proxy.ts` — Clerk middleware protects `/dashboard(.*)` and runs on API matcher
- `convex/declarations.ts`, `convex/goods_items.ts` — consistent `getUserIdentity()` + `userId` ownership
- `convex/hmrc.ts` `getToken` — returns null for cross-user token requests
- `src/app/api/hmrc/webhooks/notify/route.ts` — bearer token required; fails closed if token unset
- HMRC calls exclusively via `src/lib/hmrc-fetch.ts` from API routes (no browser-direct HMRC)
- `convex/admin_ops.ts`, `convex/admin_subscriptions.ts` — `requireAdmin()` gate
- TDR CI gate: `.github/workflows/tdr-regression.yml` (audit, tsc, lint:security, unit, h1, b1, c1, i1, tre, cns, portal, export-controls, consultant, tdr-dry-run, build)

---

## Findings

### S-01 — Public Stripe webhook mutation (Critical)

| Field | Value |
|-------|-------|
| **File** | `convex/stripe_webhooks.ts` |
| **Issue** | `stripeWebhookHandler` is a **public `mutation`**. No `getUserIdentity()`, no Stripe signature verification. Accepts arbitrary `{ type, data }` and calls `updateSubscriptionImpl` to set plan/status for any `userId` in metadata. |
| **Severity** | Critical |
| **Recommended action** | Convert to `internalMutation`. Add `src/app/api/stripe/webhook/route.ts` that verifies `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` before calling internal handler. |
| **Decision** | KEEP file; **remediate before production** |

Also affected:

| Field | Value |
|-------|-------|
| **File** | `convex/subscriptions.ts` — `updateSubscription` |
| **Issue** | Public mutation with no auth; same `updateSubscriptionImpl` callable directly. |
| **Severity** | Critical |
| **Recommended action** | Make `updateSubscription` internal; only webhook handler may call it. |
| **Decision** | KEEP; remediate |

---

### S-02 — Clerk middleware bypass CVE (Critical)

| Field | Value |
|-------|-------|
| **File** | `package.json` — `@clerk/nextjs@^7.0.1` |
| **Issue** | npm audit reports **critical** GHSA-vqx2-fgx2-5wq9: middleware-based route protection bypass. Also high-severity advisories on `@clerk/backend` (SSRF, authorization bypass). |
| **Severity** | Critical (dependency) |
| **Recommended action** | `npm audit` → upgrade `@clerk/nextjs` to patched version; verify `src/proxy.ts` still protects dashboard after upgrade. Re-run auth smoke tests. |
| **Decision** | KEEP dependency; upgrade |

---

### S-03 — Stripe portal IDOR (High)

| Field | Value |
|-------|-------|
| **File** | `src/app/api/stripe/portal/route.ts` |
| **Issue** | No `auth()`. Accepts `customerId` from request body and creates billing portal session for any Stripe customer. |
| **Severity** | High |
| **Recommended action** | Require Clerk `auth()`; resolve `customerId` from authenticated user's `subscriptions` row only. Remove `sk_test_placeholder` fallback. |
| **Decision** | KEEP; remediate |

Related:

| Field | Value |
|-------|-------|
| **File** | `convex/actions/stripe.ts` — `createPortalSession` |
| **Issue** | Auth check present but trusts caller-supplied `customerId` without verifying it belongs to `identity.subject`. |
| **Severity** | High |
| **Recommended action** | Lookup subscription by `identity.subject`; reject mismatched `customerId`. |
| **Decision** | KEEP; remediate |

---

### S-04 — Guessable HTTP endpoint secrets (High)

| Field | Value |
|-------|-------|
| **File** | `convex/http.ts` |
| **Issue** | `SYNC_SECRET \|\| "default_sync_secret"` and `INGEST_SECRET \|\| "default_ingest_secret"`. If env unset, endpoints are trivially authenticatable. `/ingest-email` allows CSV injection for any `userId` parsed from email address. |
| **Severity** | High |
| **Recommended action** | Remove defaults; return 503 if secret missing. Use constant-time compare. Restrict ingest to known Postmark IP ranges if possible. |
| **Decision** | KEEP; remediate |

---

### S-05 — Convex auth / ownership gaps (High)

| File | Issue | Severity | Action | Decision |
|------|-------|----------|--------|----------|
| `convex/documents.ts` — `generateUploadUrl` | No `getUserIdentity()`; anyone can get Convex storage upload URLs | High | Add auth + rate limit | KEEP; remediate |
| `convex/subscriptions.ts` — `getSubscription` | Public query; any caller can read any user's subscription by `userId` | High | Require auth; scope to `identity.subject` | KEEP; remediate |
| `convex/notifications.ts` — `saveWebhook` | Public mutation; no auth (called from Next.js webhook route without Convex JWT) | Medium | Acceptable if only Next.js route calls it; consider `internalMutation` + server action | KEEP; harden |
| `convex/notifications.ts` — `getWebhooks` | No auth; returns notifications by MRN/conversationId/declarationId | High | Add auth + declaration ownership check | KEEP; remediate |
| `convex/notifications.ts` — `getUserNotifications` | No auth; takes arbitrary `userId` arg | High | Require auth; use `identity.subject` only | KEEP; remediate |
| `convex/workspaces.ts` — all exports | No auth; `getWorkspaces`/`createWorkspace` trust `args.userId`; `getWorkspace`/`updateWorkspaceConfig` have no membership check | High | Add auth + workspace membership checks | KEEP; remediate |
| `convex/declarations.ts` — `listForDebug` / `getForDebug` | Falls back to `args.userId` when unauthenticated — enables IDOR if userId known | Medium | Gate behind `NODE_ENV !== 'production'` or admin role; document as test-only | KEEP; restrict |
| `convex/audit.ts` — `logAction` | Public mutation; anyone can insert audit rows with arbitrary `userId` | Medium | Make internal or require auth matching `userId` | KEEP; remediate |
| `convex/seed_reference_data.ts` — `seedInitialDatasets` | Public mutation; no auth | Low | Make `internalMutation` or admin-only | KEEP; restrict |
| `convex/waitlist.ts` — `join` | Public mutation (intentional for marketing) | Low | Add rate limiting / CAPTCHA | KEEP |
| `convex/tariff_internal.ts` — `getCache` | Public read of tariff cache | Low | Acceptable (reference data) | KEEP |
| `convex/reference_data.ts` — `listAllDatasets` / `getLatestDataset` | Public read | Low | Acceptable | KEEP |
| `convex/cds_codes.ts` — lookup/list | Public read of code lists | Low | Acceptable | KEEP |
| `convex/rule_definitions.ts` — `listEnabled` / `listAll` | Public read of rule definitions | Low | Acceptable (no secrets) | KEEP |
| `convex/hmrc_actions.ts` — `searchHSCode` | Public action; external API proxy | Low | Add auth to prevent abuse | KEEP; harden |

**Core declaration paths (good):** `createDeclaration` overrides `args.userId` with `identity.subject`; `getLane`, `deleteDeclaration`, `updateDeclarationDetails`, `goods_items` mutations all check ownership.

---

### S-06 — Unauthenticated AI API routes (High)

| File | Issue | Severity | Action | Decision |
|------|-------|----------|--------|----------|
| `src/app/api/ai/extract/route.ts` | No `auth()`; uploads files to AWS Textract + Groq | High | Add Clerk auth + file size/type limits | KEEP; remediate |
| `src/app/api/ai/classify/route.ts` | No `auth()`; Groq API calls | High | Add Clerk auth + rate limit | KEEP; remediate |
| `src/app/api/ai/chat/route.ts` | Auth present ✓ | — | — | KEEP |
| `src/app/api/ai/smart-upload/route.ts` | Auth present ✓ | — | — | KEEP |
| `src/app/api/ai/gir-audit/route.ts` | Auth present ✓ | — | — | KEEP |

---

### S-07 — npm audit vulnerabilities (Moderate)

| Field | Value |
|-------|-------|
| **File** | `package.json` / `package-lock.json` |
| **Issue** | **28 vulnerabilities** (2 critical, 14 high, 12 moderate). Notable: `@clerk/nextjs` (critical), `@clerk/backend` (high), `fast-xml-parser` (moderate, via AWS SDK), `ws` (moderate, via convex). |
| **Severity** | Moderate–Critical |
| **Recommended action** | `npm audit fix` for non-breaking; manually upgrade Clerk; assess `fast-xml-parser` in XML parsing path. Add `npm audit` to CI. |
| **Decision** | KEEP deps; upgrade |

---

### S-08 — ESLint not running (Moderate)

| Field | Value |
|-------|-------|
| **File** | `eslint.config.mjs` |
| **Issue** | Uses `overrides` key inside flat-config object — ESLint 9 rejects it. `npm run lint` fails; CI workflow does not run lint. |
| **Severity** | Moderate (process gap) |
| **Recommended action** | Convert `overrides` to separate flat-config array entries per ESLint 9 migration guide; add `npm run lint` to CI. |
| **Decision** | KEEP; fix config |

---

### S-09 — Secrets exposure (Low–Moderate)

| File | Issue | Severity | Action | Decision |
|------|-------|----------|--------|----------|
| `.env.local` (gitignored) | Correctly excluded from git ✓ | — | — | KEEP |
| `src/app/api/stripe/portal/route.ts` | `sk_test_placeholder` fallback if `STRIPE_SECRET_KEY` unset | Medium | Fail closed | KEEP; remediate |
| `convex/hmrc_internal.ts` `getTokens` | Returns full access+refresh tokens to authenticated owner only ✓ | — | Tokens should not reach client components | KEEP |
| `tmp/convex-identity.json` | Clerk user id in uncommitted scratch | Low | Add `tmp/` to `.gitignore` | ARCHIVE pattern |
| HMRC webhook route | Logs 500-char payload preview | Low | Redact in production | KEEP; harden |

No `NEXT_PUBLIC_*` secret keys found in source (grep clean).

---

### S-10 — Webhook validation (Mixed)

| File | Issue | Severity | Action | Decision |
|------|-------|----------|--------|----------|
| `src/app/api/hmrc/webhooks/notify/route.ts` | Bearer token check; fails closed if unset ✓ | — | Use constant-time compare | KEEP |
| `convex/stripe_webhooks.ts` | No Stripe signature verification | Critical | See S-01 | KEEP; remediate |
| Stripe webhook route | **Does not exist** | Critical | Create signed webhook route | ADD |

---

### S-11 — Admin access model (Low)

| Field | Value |
|-------|-------|
| **File** | `convex/lib/user_role.ts` |
| **Issue** | Admin resolved via JWT `role`, Convex `users.role`, or `ADMIN_EMAILS` env bootstrap list. Document `ADMIN_EMAILS` in ops runbook; ensure production uses JWT roles not email bootstrap. |
| **Severity** | Low (operational) |
| **Recommended action** | Document; remove email bootstrap before production if possible. |
| **Decision** | KEEP |

---

## HMRC-specific security posture

| Control | Status |
|---------|--------|
| HMRC API calls server-side only | ✓ Pass |
| `fetchHmrc()` wrapper used | ✓ Pass |
| OAuth tokens stored server-side (Convex) | ✓ Pass |
| Fraud prevention headers validated on submit | ✓ Pass |
| Webhook auth token on push notifications | ✓ Pass |
| Sandbox/production env separation documented | ✓ Pass (`environment-matrix.md`) |
| Dry-run gate before live submit | ✓ Pass (`submit/route.ts`) |
| Immutable notification append-only | ✓ Pass |
| AI does not override calculated compliance values | ✓ Pass (architectural rule) |

---

## ICO / data protection checklist (HMRC production request)

| Question | Current status |
|----------|----------------|
| Privacy policy URL | Live: https://www.freightcode.co.uk/privacy (`src/app/privacy/page.tsx`) |
| Terms & conditions URL | Live: https://www.freightcode.co.uk/terms (`src/app/terms/page.tsx`) |
| Server location documented | Vercel + Convex (document in ops one-pager) |
| Penetration test completed | **Not yet** — this review is pre-test baseline |
| Information security self-assessment | Partial — `documentation/R_and_D/information_security_policy.md` exists; needs ICO checklist mapping |

---

## References

- HMRC Developer Hub Terms of Use — penetration test self-declaration
- NCSC Penetration Testing Guide
- ICO information security checklist
- Internal: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`
