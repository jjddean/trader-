# Freightcode backlog

**Single source of truth** for product + engineering work.  
**HMRC behaviour:** [`AGENT-SPEC.md`](./AGENT-SPEC.md) — this file does not override compliance rules.  
**Merge gate (HMRC logic):** `npm run test:tdr`  
**Last updated:** 2026-06-20

Related: [`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md) (customer language) · [`FINANCIAL-ROADMAP.md`](./FINANCIAL-ROADMAP.md) (duty/variance domain) · [`evidence/LOG.md`](./evidence/LOG.md) (HMRC ops timeline)

---

## Doc map (what to read when)

| Doc | Use |
|-----|-----|
| **This file** | What's done, what's left, priority order |
| [`AGENT-SPEC.md`](./AGENT-SPEC.md) | Agents + HMRC compliance behaviour |
| [`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md) | Practice vs live — customer copy |
| [`environment-matrix.md`](./environment-matrix.md) | Hosts, Accept headers, OAuth |
| [`oauth-connect-troubleshooting.md`](./oauth-connect-troubleshooting.md) | Connect HMRC failures |
| [`hmrc-operations-runbook.md`](./hmrc-operations-runbook.md) | Support runbook |
| [`FINANCIAL-ROADMAP.md`](./FINANCIAL-ROADMAP.md) | Duty estimates, variance, reclaim |
| [`TRE-CSV-IMPORT-PLAN.md`](./TRE-CSV-IMPORT-PLAN.md) | User-facing TRE upload — phased plan |
| [`../../FUTURE/CDS-EXPANSION-BUILD-PLAN.md`](../../FUTURE/CDS-EXPANSION-BUILD-PLAN.md) | Future: B1 export, I1/C1 simplified — spec + phases |
| [`DELIVERY-PLAN.md`](./DELIVERY-PLAN.md) | Redirect → here |
| [`PRODUCT-PROGRESS-LOG.md`](./PRODUCT-PROGRESS-LOG.md) | Redirect → here |
| [`hmrc-integration-plan.md`](./hmrc-integration-plan.md) | Archived Phase 3 scaffold |

---

## Production readiness scorecard

| Item | Status | Notes |
|------|--------|-------|
| E2E journeys (submit/amend/cancel/status) | 🟢 | TDR sandbox evidenced |
| Declarations API | 🟢 | TDR v1 on sandbox host |
| Information API | 🟢 | Wired via `/api/hmrc/information/*` |
| Notifications (pull + webhook receiver) | 🟢 | Immutable store |
| DMSACC / REJ / INV handling | 🟢 | Parser + status precedence |
| Pre-submit validation + dry-run | 🟢 | Rule engine + XSD preflight |
| Error surfacing | 🟢 | Submit/status UI |
| Audit trail | 🟢 | `auditLogs` + declaration audit |
| OAuth security (no token leak to browser) | 🟢 | `getToken` status-only |
| **Customer data export** | 🟢 | Settings → Privacy + `/api/account/export` |
| Document upload (full S3 POST) | 🟡 | Initiate OK; retest on Vercel host |
| Production webhook | 🟡 | URL registered; no live DMS event yet |
| Developer Hub ToU mapping doc | 🟡 | Controls exist; one-pager missing |
| AI assurance doc | 🟡 | AI off submit path; governance doc missing |
| Practice-mode customer UX | 🟢 | Banner, Test User panel, Settings copy, quickstart docs |
| Live CDS cutover | ⬜ | Prod OAuth + org approval flow |

---

## Done (shipped)

### HMRC / TDR core
- [x] TDR v1 submit, amend, cancel on sandbox (`NEXT_PUBLIC_HMRC_ENV=tdr`)
- [x] Notifications pull + webhook receiver; DMS status precedence
- [x] Dry-run preflight + rule engine
- [x] DAN + payment method (DE 2/6, DE 4/8) on declaration + XML
- [x] Pre-clearance financial estimates + duty parser
- [x] Ops security + backup docs (`security/OPS-*.md`)
- [x] OAuth tokens redacted from browser queries
- [x] Item value currency hardcoded GBP in mapper (DE 8/6)

### Org / onboarding
- [x] Clerk orgs + `orgId` scoping on declarations, docs, notifications
- [x] Sign-up → `/session-tasks/choose-organization`
- [x] `OrgWorkspaceGate` — customers need active org
- [x] Billing gate removed for practice; pricing at `/dashboard/pricing`
- [x] Per-org HMRC routing (`org_hmrc_settings`, `resolveHmrcContext`, wired API routes)
- [x] Connect HMRC in Settings + practice Test User panel
- [x] Personal → org migration UI (`org_migration`)

### Product / compliance
- [x] HS lookup + Apply on declaration
- [x] Invoice OCR → goods item fields
- [x] **`exportMyData`** — JSON bundle via Settings → Privacy
- [x] **Test mode banner** — `PracticeModeBanner`; inline credentials link + “How practice mode works” modal
- [x] Practice Test User panel + provision API — explicit **Create HMRC Test User** (no auto-provision on Security)
- [x] **Disconnect HMRC** — Settings Security + `disconnectToken` + audit

---

## P0 — next (pilot customers + audit)

| # | Item | Done when |
|---|------|-----------|
| 1 | **Request production access** | Admin form → ops queue → approve flips org to `live` |
| 2 | **Pilot runbook** | One-page: sign up → Test User → submit → pull notifications |
| 3 | **Deploy Convex + Vercel sandbox** | `HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr` on production |
| 4 | **Legacy migration + hide Personal** | Migrate personal rows; hide Personal in org switcher after migrate |
| 5 | **Finish multi-item TDR smoke** | 2+ items DMSACC on sandbox (GBP fix landed) |

---

## P1 — broker-ready polish

| # | Item | Done when |
|---|------|-----------|
| 8 | Dashboard duty KPIs | Charts read `declaration_preview` / analytics |
| 9 | Active lane DE mapping audit | HS 8471300000 lane vs `mapping/` + `passing-payload.xml` |
| 10 | Playwright smoke | CI: Clerk sign-in → open declaration → dry-run |
| 11 | Document upload evidence | Full initiate → S3 POST on Vercel; row in `evidence/LOG.md` |
| 12 | `DEVELOPER-HUB-COMPLIANCE.md` | One-page Hub ToU + fraud headers mapping |
| 13 | `AI-GOVERNANCE.md` | Scope, prohibitions, pen-test checklist sync |
| 14 | Declarations list status badges | Accepted / Amended / Cancelled from read model |
| 15 | Banner link to customer guide | Optional: add `/docs` or guide link on `PracticeModeBanner` |
| 16 | **TRE CSV import (Phase 1)** | See [`TRE-CSV-IMPORT-PLAN.md`](./TRE-CSV-IMPORT-PLAN.md) — upload UI + org-scoped parser |
| 17 | ~~**Homepage honesty pass**~~ | Done — `landing-page-content.tsx` aligned to shipped CDS workflow |

---

## P2 — live CDS (when ready)

| # | Item | Done when |
|---|------|-----------|
| 15 | Production OAuth in Vercel | `HMRC_PRODUCTION_CLIENT_ID`, secret, prod redirect URI |
| 16 | Production webhook proof | Live DMS push → `notifications` with `source: push` |
| 17 | First production submit | Evidence in `evidence/LOG.md` |
| 18 | Billing gate for live orgs | Stripe org-scoped; practice stays free |
| 19 | Drop legacy `workspaces` tables | After confirming no production use |

---

## Financial (see FINANCIAL-ROADMAP.md)

| # | Item | Status |
|---|------|--------|
| F1 | DAN + duty parser + tariff refresh + pre-clearance estimates | Done |
| F2 | Variance alerts (estimate vs DMSTAX) | Next |
| F3 | Potential reclaim tracker (C285 flag only) | Pending |

---

## Later / out of scope

- **CDS exports + simplified I1/C1** — see [`../../FUTURE/CDS-EXPANSION-BUILD-PLAN.md`](../../FUTURE/CDS-EXPANSION-BUILD-PLAN.md) + [`../../specs/cds-api/declaration-categories-index.md`](../../specs/cds-api/declaration-categories-index.md)
- CRM, white-label, acquisition targets (separate app)
- TRE Phase 3+ (R2 bulk, email-forward ingest) — after Phase 1–2 in [`TRE-CSV-IMPORT-PLAN.md`](./TRE-CSV-IMPORT-PLAN.md)
- Dual HMRC webhook tokens (sandbox + production Hub apps) — optional ops hardening
- Enterprise SSO beyond Clerk orgs

---

## Open decision (Jason)

**Legacy Personal workspace:** migrate personal rows into org once, then hide Personal switcher — **agreed target**. Migration UI exists; run when ready.

---

## Verify locally

```bash
npm run test:tdr          # must pass before merge
npm run dev               # sign in → org → dashboard
```

**Customer data export:** Settings → Privacy → Export my data (or `GET /api/account/export` while signed in).

**Vercel TDR:** `HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr` → redeploy.
