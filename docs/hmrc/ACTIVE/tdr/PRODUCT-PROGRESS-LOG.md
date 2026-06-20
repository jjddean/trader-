# Product progress log

**Purpose:** Track org / onboarding / customer-TDR work — what shipped, what’s left.  
**Merge gate (HMRC logic):** `npm run test:tdr`  
**Last updated:** 2026-06-18

Related: [`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md) · [`DELIVERY-PLAN.md`](./DELIVERY-PLAN.md)

---

## Agreed direction (product)

- [x] **Clerk orgs** — team workspace model (not legacy Convex `workspaces`)
- [x] **Org-only for customers** — every account works in an org (broker/importer desk)
- [x] **TDR practice first** — sandbox practise before live CDS; no paywall blocking exploration
- [ ] **Hide Personal** — after legacy data migrated into org (see § Legacy data)
- [ ] **Per-org HMRC routing** — practice vs live per org (not one global `.env` for all tenants)

---

## Done (checked off)

### Clerk orgs + data scoping

- [x] `convex/lib/org_access.ts` — list/filter by JWT `org_id`; personal = rows with empty `orgId`
- [x] `orgId` + `by_org` indexes on declarations, documents, notifications, declaration_preview
- [x] `createDeclaration` tags `orgId` when org active in session
- [x] `OrgSwitcher` in sidebar — Personal **still visible** (legacy data access)
- [x] `UserSync` — syncs Clerk user + active org to Convex
- [x] Two users in same org see shared declarations (DELIVERY-PLAN #3 — **done**)

### Onboarding / billing simplification (2026-06-18)

- [x] Removed `BillingOnboardingGate` — dashboard no longer blocked without Stripe
- [x] Removed dead `OrgWorkspaceGate` wrapper
- [x] Removed dead `WorkspaceProvider` UI path
- [x] Single pricing entry — `/dashboard/pricing`; `/session-tasks/choose-plan` redirects there
- [x] Stripe checkout — dropped `flow: onboarding`; success → Settings subscription tab
- [x] Sign-up → `/dashboard` (sandbox-first; **org step skipped** — see Left)
- [x] `npm run test:tdr` passes after changes (85 tests + dry-run)

### Dead code / cleanup (2026-06-18)

- [x] `hmrc.ts` — no longer links tokens to legacy `workspaces` table
- [x] Removed `legacyClaimedForOrgId` from schema (reverted auto-claim)
- [x] Removed unused `assertActiveOrg`, `getDbUser` from `org_access.ts`
- [x] Removed `workspaceId` arg from `createDeclaration`
- [x] `convex/workspaces.ts` marked deprecated (table kept for old DB rows only)
- [x] Single `FINANCIAL_LABELS` source — `src/lib/financial-labels.ts` re-exports from convex

### Docs

- [x] [`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md) — customer-facing practice vs live (HMRC doesn’t publish SaaS multi-tenant guidance)
- [x] PWA cleanup — Notes + Admin Guide only (Founder / business-plan removed)

### HMRC / TDR (pre-existing)

- [x] TDR v1 submit/amend/cancel on sandbox (`HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr`)
- [x] DAN + payment method on declaration + XML (DELIVERY-PLAN #1)
- [x] Pre-clearance financial estimates + duty parser
- [x] Ops security + backup docs (DELIVERY-PLAN #7)

---

## Left (not done)

### Org-only product (priority — agreed)

- [ ] **Sign-up → create/join org** — restore `forceRedirectUrl` / fallback to `/session-tasks/choose-organization` (currently goes straight to dashboard)
- [ ] **Require active org** for dashboard (redirect if no `org_id` in session)
- [ ] **`hidePersonal`** on `OrganizationSwitcher` — after migration below
- [ ] **One-time legacy migration** — attach personal-scoped declarations/docs/notifications to your org (`orgId` patch for rows where `userId` = you and `orgId` empty)
- [ ] Update [`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md) — remove “Personal workspace” as customer path once org-only ships

### Per-org HMRC (customer TDR sandbox)

- [ ] Org record: `hmrcMode: practice | live`
- [ ] `resolveHmrcContext(orgId)` — host, Accept headers, OAuth creds per org
- [ ] Wire all `/api/hmrc/*` routes through resolver (not global `process.env`)
- [ ] Practice banner in UI from org mode
- [ ] Request production → admin approval → flip org to **live**  
  - **HMRC:** production app approved (2026-06-15) — wire `HMRC_PRODUCTION_CLIENT_ID` / secret + prod redirect URI in Vercel when flipping an org to live (not a wait on SDST)

### Settings + onboarding polish

- [ ] **HMRC connect/disconnect in Settings** (DELIVERY-PLAN #2 — still on dashboard home only)
- [ ] Optional org onboarding copy — not “every account must name a company”; use broker/importer desk language

### Billing (deferred — practice is free)

- [ ] Org-scoped subscriptions (today: per-user Stripe row)
- [ ] Billing gate only when org is **live** (not practice)

### DELIVERY-PLAN backlog (unchanged)

- [ ] Dashboard duty KPIs (#4)
- [ ] Active lane DE mapping audit (#5)
- [ ] Playwright smoke (#6)
- [ ] Drop `workspaces` / `workspaceMembers` tables after confirming no production use

### Later (live CDS — creds available, not wired yet)

- [ ] Add production OAuth to Vercel / `.env` (`HMRC_PRODUCTION_CLIENT_ID`, secret, prod `HMRC_REDIRECT_URI`) — app ID `00292df9-e2e6-4d66-9d28-7d79a2a931ba` per [`evidence/LOG.md`](./evidence/LOG.md)
- [ ] Per-org flip to live + first production submit evidence
- [ ] Financial roadmap — variance alerts, reclaim tracker ([`FINANCIAL-ROADMAP.md`](./FINANCIAL-ROADMAP.md))

---

## Session changelog

| Date | Change |
|------|--------|
| 2026-06-18 | Added `CUSTOMER-TDR-GUIDE.md` |
| 2026-06-18 | Removed billing gate, dead gates, workspace token linking; sandbox-first sign-up |
| 2026-06-18 | Clarified: org model kept; Personal switcher = legacy data only, not product direction |
| 2026-06-18 | This log created |

---

## How to verify locally

```bash
npm run test:tdr          # must pass before merge
npm run dev               # sign in → dashboard (no Stripe block)
```

**Vercel TDR:** `HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr` → redeploy.

---

## Open decision (Jason)

**Legacy data:** migrate personal rows into org once, then org-only + hide Personal — vs keep Personal switcher indefinitely for solo dev. **Agreed target:** migrate then org-only.
