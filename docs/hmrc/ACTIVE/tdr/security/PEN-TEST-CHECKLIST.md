# Pen Test & Security Readiness Checklist

**Purpose:** Track items before independent third-party penetration test and HMRC production credential request.  
**Baseline review:** [`SECURITY-REVIEW.md`](./SECURITY-REVIEW.md) · **Remediation detail:** [`REMEDIATION-LOG.md`](./REMEDIATION-LOG.md)  
**Last updated:** 2026-06-15 (webhook + Convex env verified locally & prod challenge)

**Legend:** `[x]` verified · `[~]` fix in repo, needs deploy/retest · `[ ]` open

---

## Deploy gate (do first)

Security fixes exist locally but **Convex deploys separately** from Next.js. Until `npx convex dev` (or deploy) runs against `glorious-marlin-243`, pen testers may hit old public mutations.

| Step | Status |
|------|--------|
| Run `npx convex dev` on dev deployment matching `.env.local` `CONVEX_DEPLOYMENT` | `[x]` | glorious-marlin-243, functions ready 15 Jun 2026 |
| Confirm Convex env vars set: `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `NOTIFICATION_INGEST_SECRET`, `SYNC_SECRET`, `INGEST_SECRET` | `[x]` | `npx convex env list` with `CONVEX_DEPLOYMENT=dev:glorious-marlin-243` |
| `NOTIFICATION_INGEST_SECRET` in `.env.local` + Vercel production | `[x]` | Vercel `trader-fa1m` env set; **prod POST 500 until security code deployed** |
| Commit + push security branch (fixes currently uncommitted on `main` working tree) | `[ ]` |

---

## 1. Stripe & billing — DONE (baseline)

| # | Test | Expected | Status | Evidence |
|---|------|----------|--------|----------|
| 1.1 | Webhook endpoint live | POST without `stripe-signature` → **400** | `[x]` | `https://glorious-marlin-243.eu-west-1.convex.site/stripe-webhook` |
| 1.2 | Signed delivery | Stripe Dashboard → **200** on `checkout.session.completed` | `[x]` | Webhook **playful-voyage**, 15 Jun 2026 02:09:33 |
| 1.3 | `customer.subscription.deleted` delivery | **200** | `[x]` | Same webhook, 00:32:49 |
| 1.4 | Handler is internal-only | `stripeWebhookHandler` = `internalMutation`; signature via `processWebhook` | `[~]` | Code in `convex/stripe_webhooks.ts`, `convex/http.ts` — **retest after deploy** |
| 1.5 | Public `updateSubscription` removed | Only internal mutation; not callable from client | `[~]` | `convex/subscriptions.ts` — **retest after deploy** |
| 1.6 | Portal route IDOR | `/api/stripe/portal` requires Clerk auth; customerId from own subscription only | `[~]` | `src/app/api/stripe/portal/route.ts` — **manual IDOR retest** |
| 1.7 | Add `customer.subscription.updated` to Stripe webhook events | Plan changes sync | `[ ]` | Dashboard → playful-voyage → Events |
| 1.8 | Real checkout updates `subscriptions` row | End-to-end with `metadata.userId` on session | `[ ]` | CLI trigger alone may 200 without DB write |

**Pen test probes (Stripe):**

- [ ] Call `updateSubscription` / `stripeWebhookHandler` directly via Convex client (must fail — not public)
- [ ] POST forged webhook body to `/stripe-webhook` without valid signature (must **400**)
- [ ] POST portal with another user's `customerId` (must **401/403**)
- [ ] Replay old webhook event ID (document idempotency behaviour — acceptable if duplicate updates are harmless)

---

## 2. Authentication & session (Clerk)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Upgrade `@clerk/nextjs` past middleware bypass CVE (GHSA-vqx2-fgx2-5wq9) | `[ ]` | Still `^7.0.1` in `package.json`; run `npm audit` + upgrade |
| 2.2 | Dashboard routes protected | `[ ]` | Verify `src/proxy.ts` — unauthenticated → redirect on `/dashboard/*` |
| 2.3 | API routes: HMRC submit/amend/cancel require auth | `[ ]` | Spot-check `/api/hmrc/submit`, `/api/hmrc/status-query` |
| 2.4 | Cross-user session: Convex JWT `identity.subject` matches Clerk user | `[ ]` | Attempt API call with valid JWT for user A, body referencing user B |

**Pen test probes:**

- [ ] Access `/dashboard/declarations` without Clerk cookie
- [ ] Swap `userId` in FormData on Smart Upload (must **403**)
- [ ] Call protected API with expired or missing Convex token

---

## 3. Convex — auth, IDOR, data exposure

| # | Surface | Fix status | Verify after deploy |
|---|---------|------------|---------------------|
| 3.1 | `documents.generateUploadUrl` | `[~]` auth added | `[ ]` unauthenticated call fails |
| 3.2 | `subscriptions.getSubscription` | `[~]` scoped to `identity.subject` | `[ ]` cannot read other user's plan |
| 3.3 | `notifications.getWebhooks` / `getUserNotifications` | `[~]` auth + ownership | `[ ]` cannot read another MRN/user |
| 3.4 | `notifications.saveWebhook` | `[~]` requires `NOTIFICATION_INGEST_SECRET` | `[x]` local POST `/api/hmrc/webhooks/notify` → **200** + Convex persist |
| 3.5 | `workspaces.*` | `[~]` auth on exports | `[ ]` cannot read/update foreign workspace |
| 3.6 | `audit.logAction` | `[~]` → `internalMutation`; public `logMyAction` for clients | `[ ]` cannot inject arbitrary audit rows as other user |
| 3.7 | `declarations.listForDebug` / `getForDebug` | `[~]` gated by `ALLOW_DEBUG_CONVEX_QUERIES=true` | `[ ]` returns empty in prod (env unset) |
| 3.8 | `seed_reference_data.seedInitialDatasets` | `[ ]` still public | Restrict to admin/internal before prod |
| 3.9 | `waitlist.join` | `[ ]` intentional public | Add rate limit / CAPTCHA if abused |
| 3.10 | Reference reads (`tariff_internal`, `cds_codes`, `rule_definitions`) | `[x]` acceptable | Document as intentional public reference data |

**Pen test probes:**

- [ ] Enumerate another user's `userId` (Clerk sub) and query `getSubscription({ userId })`
- [ ] Call debug queries in production-like env without `ALLOW_DEBUG_CONVEX_QUERIES`
- [ ] Insert notification via public `saveWebhook` without ingest secret

---

## 4. Convex HTTP routes (`*.convex.site`)

| # | Route | Secret env | Default fallback removed | Verify |
|---|-------|------------|--------------------------|--------|
| 4.1 | `/stripe-webhook` | `STRIPE_WEBHOOK_SECRET` | n/a | `[x]` |
| 4.2 | `/hmrc-sync-trigger` | `SYNC_SECRET` | `[~]` no default | `[x]` 401 without bearer |
| 4.3 | `/ingest-email` | `INGEST_SECRET` | `[~]` no default | `[ ]` 401 without `X-Ingest-Secret` |
| 4.4 | Guessable secrets | — | `[~]` | `[ ]` confirm `default_sync_secret` / `default_ingest_secret` not accepted |

**Pen test probes:**

- [ ] POST `/ingest-email` with forged `data+{victimUserId}@ingest.freightcode.com` (must fail without secret)
- [ ] Timing attack on bearer compare (low priority; `secretsEqual` in `http.ts` is constant-time)

---

## 5. Next.js API routes — AI & cost abuse

| # | Route | Auth | Rate limit | Status |
|---|-------|------|------------|--------|
| 5.1 | `/api/ai/smart-upload` | `[x]` | `[ ]` | Auth present |
| 5.2 | `/api/ai/extract` | `[~]` | `[ ]` | Textract + Groq — add file size cap |
| 5.3 | `/api/ai/classify` | `[~]` | `[ ]` | Groq — add rate limit |
| 5.4 | `/api/ai/gir-audit` | `[x]` | `[ ]` | Auth present |
| 5.5 | `/api/ai/chat` | `[x]` | `[ ]` | Auth present |

**Pen test probes:**

- [ ] Unauthenticated bulk POST to `/api/ai/extract` (must **401**)
- [ ] Upload oversized PDF / many parallel requests (cost abuse)

---

## 6. HMRC integration

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 6.1 | HMRC calls server-side only (`fetchHmrc`) | `[x]` | No browser-direct HMRC |
| 6.2 | Push webhook bearer token | `[x]` | Local + prod GET challenge; local POST **200** with Bearer |
| 6.2b | Notification ingest secret (Next → Convex) | `[x]` | Local POST **200**; prod GET challenge **200** |
| 6.3 | Constant-time token compare on HMRC webhook | `[ ]` | Use `crypto.timingSafeEqual` |
| 6.4 | Redact webhook payload logs in production | `[ ]` | Currently logs 500-char preview |
| 6.5 | OAuth tokens not exposed to client | `[ ]` | Review `hmrc_internal` / dashboard components |
| 6.6 | Fraud prevention headers on submit | `[x]` | `hmrc-fetch.ts` |
| 6.7 | Dry-run gate before live submit | `[x]` | `submit/route.ts` |
| 6.8 | Declaration ownership on CRUD | `[x]` | `declarations.ts`, `goods_items.ts` |

**Pen test probes:**

- [ ] POST `/api/hmrc/webhooks/notify` without bearer (must **401**)
- [ ] Submit declaration for another user's `declarationId` (must fail ownership check)
- [ ] Attempt HMRC token exfiltration via client-side Convex queries

---

## 7. Dependencies & CI

| # | Item | Status |
|---|------|--------|
| 7.1 | `npm audit` — resolve critical/high (Clerk, `@clerk/backend`, etc.) | `[ ]` ~23 vulns reported Jun 2026 |
| 7.2 | ESLint runs (`eslint.config.mjs` flat config fixed) | `[~]` config fixed; 6000+ legacy issues remain |
| 7.3 | Add `npm run lint` + `npm audit --audit-level=high` to CI | `[ ]` `.github/workflows/tdr-regression.yml` |
| 7.4 | Typecheck in CI | `[ ]` optional `npx tsc --noEmit` |

---

## 8. Repository & HMRC presentation

| # | Item | Status |
|---|------|--------|
| 8.1 | Root `README.md` (project, not Convex placeholder) | `[~]` rewritten locally — commit |
| 8.2 | `/tmp/` in `.gitignore` | `[~]` locally — commit |
| 8.3 | Privacy policy public URL | `[x]` https://www.freightcode.co.uk/privacy |
| 8.4 | Terms public URL | `[x]` https://www.freightcode.co.uk/terms |
| 8.5 | Security one-pager (`OPS-SECURITY.md`) | `[ ]` |
| 8.6 | Backup / DR one-pager | `[ ]` from `disaster_recovery_plan.md` |
| 8.7 | ICO checklist self-assessment | `[ ]` map `information_security_policy.md` |

---

## 9. Independent pen test (third party)

Book **after** sections 1–6 verified on deployed Convex + Vercel preview.

| # | Deliverable | Status |
|---|-------------|--------|
| 9.1 | Scope document (URLs, test accounts, out-of-scope: HMRC production) | `[ ]` |
| 9.2 | Staging / preview environment with patched Convex deployed | `[ ]` |
| 9.3 | Test Clerk user + sandbox HMRC OAuth (no production EORI submit loops) | `[ ]` |
| 9.4 | Pen test report + remediation sign-off | `[ ]` |
| 9.5 | HMRC Developer Hub self-declaration (pen test completed) | `[ ]` |

**Suggested scope for tester:**

- OWASP API Top 10 on `/api/*` and Convex public functions
- IDOR on declarations, documents, subscriptions, notifications, workspaces
- Webhook forgery (Stripe, HMRC, ingest)
- Auth bypass (Clerk middleware, Convex JWT)
- Secret/env misconfiguration
- AI route cost abuse

**Out of scope (document explicitly):**

- HMRC CDS backend itself
- Stripe / Clerk infrastructure
- DDoS / load testing

---

## 10. Recommended order (remaining work)

```
1. Commit + push security fixes                    ← NEXT
2. Confirm NOTIFICATION_INGEST_SECRET on Vercel
3. Clerk upgrade + npm audit (critical/high)
4. Stripe: add customer.subscription.updated; real checkout E2E
5. Manual retest sections 2–6 (this checklist)
6. OPS-SECURITY.md (+ backup/DR one-pagers if needed for HMRC)
7. Book third-party pen test
8. HMRC production go-live (after SUP-16375 closed)
```

**Product backlog (parallel):** [`DELIVERY-PLAN.md`](../DELIVERY-PLAN.md) §1 — DAN + payment method on declaration form.

---

## Quick reference

| Resource | URL / path |
|----------|------------|
| Stripe webhook | `https://glorious-marlin-243.eu-west-1.convex.site/stripe-webhook` |
| Stripe sandbox account | `acct_1TE7IDLHQkvGaqmg` (freightcode sandbox) |
| HMRC behaviour spec | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |
| TDR evidence | `docs/hmrc/ACTIVE/tdr/evidence/LOG.md` |
