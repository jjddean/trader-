# Remediation Log — HMRC Readiness

**Date opened:** 2026-06-14  
**Status key:** `open` | `in_progress` | `done` | `wontfix` | `deferred`

Prioritized for external technical review and HMRC production credential request.

---

## P0 — Block production credentials

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-001 | Critical | `convex/stripe_webhooks.ts`, `convex/subscriptions.ts` | Public mutations alter subscription plan/status without Stripe signature | Convert to `internalMutation`; add `/api/stripe/webhook` with `constructEvent` | **open** |
| R-002 | Critical | `package.json` — `@clerk/nextjs` | CVE: middleware route-protection bypass | Upgrade Clerk to patched version; verify `src/proxy.ts` | **open** |
| R-003 | High | `src/app/api/stripe/portal/route.ts` | Unauthenticated Stripe portal IDOR | Add `auth()`; resolve customerId from user's subscription | **open** |
| R-004 | High | `convex/actions/stripe.ts` | Portal session trusts caller-supplied customerId | Verify customerId belongs to authenticated user | **open** |
| R-005 | High | `convex/http.ts` | Default secrets `default_sync_secret` / `default_ingest_secret` | Remove fallbacks; fail closed | **open** |

---

## P1 — Before external pen test

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-006 | High | `src/app/api/ai/extract/route.ts` | No auth; Textract + Groq cost abuse | Add Clerk `auth()` + rate limit + file size cap | **open** |
| R-007 | High | `src/app/api/ai/classify/route.ts` | No auth; Groq cost abuse | Add Clerk `auth()` + rate limit | **open** |
| R-008 | High | `convex/documents.ts` — `generateUploadUrl` | Unauthenticated storage upload URL generation | Add `getUserIdentity()` | **open** |
| R-009 | High | `convex/subscriptions.ts` — `getSubscription` | Read any user's subscription by userId | Auth + scope to identity.subject | **open** |
| R-010 | High | `convex/notifications.ts` — `getWebhooks`, `getUserNotifications` | No auth on notification reads | Add auth + ownership | **open** |
| R-011 | High | `convex/workspaces.ts` | No auth; workspace IDOR | Add auth + membership checks on all exports | **open** |
| R-012 | Moderate | `convex/audit.ts` — `logAction` | Public audit log injection | Make internal or auth-gated | **open** |
| R-013 | Moderate | `convex/declarations.ts` — `listForDebug`, `getForDebug` | Unauthenticated fallback via args.userId | Restrict to non-production or admin | **open** |
| R-014 | Moderate | `src/app/api/hmrc/webhooks/notify/route.ts` | Non-constant-time token compare; payload logging | Use `crypto.timingSafeEqual`; redact logs in prod | **open** |
| R-015 | Moderate | `package.json` / lockfile | 28 npm vulnerabilities | `npm audit fix`; manual Clerk upgrade | **open** |

---

## P2 — Repository presentation (external review)

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-016 | High | `README.md` (root) | Convex export placeholder, not project README | Rewrite with stack, setup, test commands, doc links | **open** |
| R-017 | Medium | `.gitignore` | `tmp/` not ignored | Add `/tmp/` | **open** |
| R-018 | Medium | `eslint.config.mjs` | Flat config `overrides` breaks lint | Migrate to ESLint 9 flat array format | **open** |
| R-019 | Medium | `.github/workflows/tdr-regression.yml` | No lint or audit in CI | Add `npm run lint` + `npm audit --audit-level=high` | **open** |
| R-020 | Low | `docs/hmrc/README.md` | Security audit docs not indexed | Add link to `security/` folder | **open** |
| R-021 | Low | `documentation/R_and_D/privacy_policy.md`, `terms_of_service.md` | Public routes live | https://www.freightcode.co.uk/privacy and `/terms` | **done** |
| R-022 | Low | `spec/HANDOVER.md` | Empty | Populate or remove | **open** |

---

## P3 — HMRC ops policies (DELIVERY-PLAN item 7)

| ID | Severity | File(s) | Issue | Recommended action | Status |
|----|----------|---------|-------|-------------------|--------|
| R-023 | Medium | — | No security one-pager | Create `docs/hmrc/ACTIVE/tdr/security/OPS-SECURITY.md` from R&D policy | **open** |
| R-024 | Medium | — | No backup one-pager | Create backup/DR summary from `disaster_recovery_plan.md` | **open** |
| R-025 | Medium | — | Pen test not completed | Schedule independent third-party test after P0/P1 fixes | **open** |
| R-026 | Low | — | ICO checklist self-assessment | Map `information_security_policy.md` to ICO checklist | **open** |

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

---

## Recommended execution order

```
Week 1 (before any HMRC production request):
  R-001 → R-005 (billing + HTTP secrets)
  R-002 (Clerk CVE)
  R-016 (root README)

Week 2 (before pen test):
  R-006 → R-011 (API + Convex auth gaps)
  R-015, R-018, R-019 (deps + CI)
  R-017 (gitignore tmp)

Week 3 (evidence pack):
  R-023 → R-026 (ops policies + ICO + pen test booking)
  Independent third-party pen test
```

---

## Notes for external reviewers

- This log intentionally **preserves development history** (test-evidence, ARCHIVE docs, debug queries).
- Debug Convex queries (`getForDebug`, `listForDebug`) exist to support `test-evidence/debug-payload.js` — flagged for production restriction, not removal.
- HMRC behaviour authority: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` only.
- No automatic deletions were performed during this audit.
