# Remediation Log — HMRC Readiness

**Date opened:** 2026-06-14  
**Last synced:** 2026-06-15  
**Status key:** `open` | `in_progress` | `done` | `wontfix` | `deferred`

Prioritized for external technical review and HMRC production credential request.

---

## P0 — Block production credentials

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-001 | Critical | `convex/stripe_webhooks.ts`, `convex/subscriptions.ts` | Public mutations alter subscription plan/status without Stripe signature | Convert to `internalMutation`; signed Convex HTTP webhook | **done** — `eadc459`, `08aca91` |
| R-002 | Critical | `package.json` — `@clerk/nextjs` | CVE: middleware route-protection bypass | Upgrade Clerk to patched version | **done** — `@clerk/nextjs@^7.5.2` (`270152d`) |
| R-003 | High | `src/app/api/stripe/portal/route.ts` | Unauthenticated Stripe portal IDOR | Add `auth()`; resolve customerId from own subscription | **done** — `d48d59c` |
| R-004 | High | `convex/actions/stripe.ts` | Portal session trusts caller-supplied customerId | Verify customerId belongs to authenticated user | **done** — `d48d59c` |
| R-005 | High | `convex/http.ts` | Default secrets `default_sync_secret` / `default_ingest_secret` | Remove fallbacks; fail closed | **done** — `d48d59c` |

---

## P1 — Before external pen test

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-006 | High | `src/app/api/ai/extract/route.ts` | No auth; Textract + Groq cost abuse | Add Clerk `auth()` + rate limit + file size cap | **done** — `eadc459` |
| R-007 | High | `src/app/api/ai/classify/route.ts` | No auth; Groq cost abuse | Add Clerk `auth()` + rate limit | **done** — `eadc459` |
| R-008 | High | `convex/documents.ts` — `generateUploadUrl` | Unauthenticated storage upload URL generation | Add `getUserIdentity()` | **done** — `d48d59c` |
| R-009 | High | `convex/subscriptions.ts` — `getSubscription` | Read any user's subscription by userId | Auth + scope to identity.subject | **done** — `d48d59c` |
| R-010 | High | `convex/notifications.ts` — `getWebhooks`, `getUserNotifications` | No auth on notification reads | Add auth + ownership | **done** — `d48d59c` |
| R-011 | High | `convex/workspaces.ts` | No auth; workspace IDOR | Add auth + membership checks on all exports | **done** — `d48d59c` |
| R-012 | Moderate | `convex/audit.ts` — `logAction` | Public audit log injection | Make internal; public `logMyAction` for clients | **done** — `d48d59c` |
| R-013 | Moderate | `convex/declarations.ts` — `listForDebug`, `getForDebug` | Unauthenticated fallback via args.userId | Gated by `ALLOW_DEBUG_CONVEX_QUERIES` | **done** — `d48d59c` |
| R-014 | Moderate | `src/app/api/hmrc/webhooks/notify/route.ts` | Non-constant-time token compare; payload logging | `secretsEqual`; redact logs in prod | **done** — `eadc459` |
| R-015 | Moderate | `package.json` / lockfile | npm vulnerabilities | `npm audit fix`; Clerk + Next upgrades | **done** — 0 high+ (`80b4c59`, re-verified 15 Jun 2026) |

---

## P2 — Repository presentation (external review)

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-016 | High | `README.md` (root) | Convex export placeholder, not project README | Rewrite with stack, setup, test commands | **done** — `d48d59c` |
| R-017 | Medium | `.gitignore` | `tmp/` not ignored | Add `/tmp/` | **done** — `d48d59c` |
| R-018 | Medium | `eslint.config.mjs` | Flat config `overrides` breaks lint | ESLint 9 flat config | **done** — config fixed; full-repo lint deferred; CI runs `npm run lint:security` |
| R-019 | Medium | `.github/workflows/tdr-regression.yml` | No lint or audit in CI | Add `lint:security` + `npm audit --audit-level=high` + `tsc` | **open** — batch B |
| R-020 | Low | `docs/hmrc/README.md` | Security audit docs not indexed | Link to `security/` folder | **done** |
| R-021 | Low | Privacy / terms routes | Public routes live | https://www.freightcode.co.uk/privacy and `/terms` | **done** |
| R-022 | Low | `spec/HANDOVER.md` | Empty | Populate with doc index | **done** — 15 Jun 2026 |

---

## P3 — HMRC ops policies (DELIVERY-PLAN item 7)

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-023 | Medium | — | No security one-pager | Create `OPS-SECURITY.md` | **done** — `eadc459` |
| R-024 | Medium | — | No backup one-pager | Create `OPS-BACKUP-DR.md` | **done** — `eadc459` |
| R-025 | Medium | — | Pen test not completed | Schedule independent third-party test | **open** — product owner (§9 checklist) |
| R-026 | Low | — | ICO checklist self-assessment | Map `information_security_policy.md` to ICO themes | **done** — [`ICO-CHECKLIST-MAPPING.md`](./ICO-CHECKLIST-MAPPING.md) |

---

## Completed in this audit session

| ID | Action | Date |
|----|--------|------|
| R-100 | Created `SECURITY-REVIEW.md` | 2026-06-14 |
| R-101 | Created `REPOSITORY-AUDIT.md` | 2026-06-14 |
| R-102 | Created `SCRIPT-INVENTORY.md` | 2026-06-14 |
| R-103 | Created `REMEDIATION-LOG.md` (this file) | 2026-06-14 |
| R-104 | Committed + pushed main codebase (excl. tmp scratch) | 2026-06-14 |
| R-105 | Verified TDR gate: 67/67 tests, dry-run ready | 2026-06-14 |
| R-106 | P0–P1 security fixes + pen-test retest | 2026-06-15 |
| R-107 | Docs housekeeping — REMEDIATION-LOG sync, ICO mapping, HANDOVER | 2026-06-15 |

---

## Notes for external reviewers

- Debug Convex queries (`getForDebug`, `listForDebug`) gated by `ALLOW_DEBUG_CONVEX_QUERIES` — not removed.
- `hmrc_internal.getTokens` client redaction tracked in pen-test checklist §6.5 (batch C).
- HMRC submit routes relax cross-user ownership in **sandbox** only (`HMRC_ENVIRONMENT=sandbox`) — production enforces ownership.
- Stripe webhook idempotency: duplicate events re-apply subscription state; harmless for plan/status sync.
- HMRC behaviour authority: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` only.

---

## Remaining (not code)

| Item | Owner |
|------|-------|
| R-025 — third-party pen test | Product owner — [`PEN-TEST-CHECKLIST.md`](./PEN-TEST-CHECKLIST.md) §9 |
| `waitlist.join` rate limit | Only if abuse observed — [`PEN-TEST-CHECKLIST.md`](./PEN-TEST-CHECKLIST.md) §3.9 |
