# Migration Execution Plan (Source `tradedna` → Destination `trader-app`)

Date: 2026-03-10  
Source: `C:\Users\jason\OneDrive\tradedna`  
Destination: `C:\Users\jason\trader-app`

## Goal

Complete the migration by transferring **only what is not yet present in the destination**, while protecting already-migrated (and potentially improved) destination code from accidental overwrites.

This plan is **inventory-driven** and uses the repo’s manifests as the source of truth.

---

## Definitions (what counts as “remaining”)

The inventory script computes file-level status by **relative path** and **SHA256 hash**.

- **Migrated**: destination contains the same relative `Path` and the same `Hash`.
- **Remaining / Missing**: destination does **not** contain the file at that relative `Path` (path absent).
- **Diverged**: destination contains the file at that relative `Path`, but the content `Hash` differs.
  - Treat as “already transferred” for the purpose of _not re-migrating_.
  - Handle via an explicit reconciliation step only if needed.

Success criteria for “migration complete” in this plan:

- `remaining_missing.csv` count is **0** (nothing missing by path).
- App still passes baseline checks (`lint`, `build`) and key user flows.

---

## Inventory & Comparison Process (repeatable)

### 1) File manifests (authoritative)

Run:

```powershell
powershell -NoProfile -File scripts\migration\inventory.ps1
```

Artifacts (repo root):

- `src_manifest.csv` (source inventory)
- `dst_manifest.csv` (destination inventory)
- `remaining_manifest.csv` (missing + diverged)
- `remaining_missing.csv` (**only** missing-by-path; migration scope)
- `remaining_diverged.csv` (hash mismatches; reconcile only if required)

### 2) Config & environment diff (keys only)

Run:

```powershell
powershell -NoProfile -File scripts\migration\config-diff.ps1
```

Artifacts (repo root):

- `migration_config_diff.md` (deps + env key diffs; no secret values)

### 3) Criteria to decide “do we migrate this file?”

- If it is listed in `remaining_missing.csv`: **migrate** (copy over).
- If it is listed in `remaining_diverged.csv`: **do not auto-migrate** (destination is treated as canonical unless a specific feature regression is proven).
- If it’s not listed in either: **already migrated**.

---

## Current Gap Summary (from latest inventory)

As of 2026-03-10 inventory run (pre-Wave 1 execution):

- `remaining_missing.csv`: **23 files** (migration scope)
- `remaining_diverged.csv`: **47 files** (reconciliation scope, optional)

After Wave 1 execution in `trader-app` (2026-03-10):

- `remaining_missing.csv`: **0 files**
- `remaining_diverged.csv`: **56 files** (includes post-migration fixes/adjustments in destination)

### Missing-by-path inventory (23)

**Routes/pages**

- `src\app\auth\hmrc\callback\page.tsx` (depends on `api.actions.hmrc.handleHmrcCallback`)
- `src\app\dashboard\admin\page.tsx` (depends on `api.trade_lanes.getLanes`)
- `src\app\dashboard\pricing\page.tsx` (depends on `api.actions.stripe.createCheckoutSession`)
- `src\app\dashboard\search\page.tsx` (depends on `api.actions.companies.searchCompanies`, `api.saved_companies.saveCompany`)
- `src\app\dashboard\user\page.tsx` (depends on `api.trade_lanes.*`, `api.compliance.*`, `useReferenceData`)
- `src\app\dashboard\user\billing\page.tsx` (depends on `api.subscriptions.getSubscription`, `api.actions.stripe.createPortalSession`)

**Components**

- `src\components\chart-area-interactive.tsx`
- `src\components\data-table.tsx`
- `src\components\nav-documents.tsx`
- `src\components\nav-main.tsx`
- `src\components\nav-secondary.tsx`
- `src\components\nav-user.tsx`
- `src\components\section-cards.tsx`
- `src\components\site-header.tsx`

**Scripts**

- `scripts\convert-dcts-data.mjs`
- `scripts\fetch-dcts-rules.mjs`
- `scripts\fetch-hmrc-bulk.mjs`
- `scripts\index-hmrc-companies.mjs`
- `scripts\parse-hmrc-data.mjs`
- `scripts\prep-cloudflare-data.mjs`
- `scripts\search-demo.mjs`
- `scripts\sync-companies-to-r2.mjs`
- `scripts\verify-search.mjs`

---

## Execution Phases (with rollback + testing)

### Phase 0 — Preflight baseline (Mar 10, 2026)

**Actions**

- Create a git tag/branch for the baseline (before migration waves).
- Confirm destination is clean and reproducible:
  - `npm run lint`
  - `npm run build`
- Run inventory to record baseline manifests.

**Rollback**

- Hard rollback to baseline tag/branch.

**Success metrics**

- Baseline `lint` + `build` succeed.
- Inventory artifacts committed (or stored) for traceability.

---

### Phase 1 — Configuration synchronization (Mar 10–11, 2026)

**Actions**

- Dependency mapping:
  - Source uses `xlsx` for ODS conversion; destination intentionally avoids it (audit policy). Destination uses `fast-xml-parser` + ODS `content.xml` parsing in `scripts/convert-dcts-data.mjs`.
- Environment key sync (local + hosted + Convex env):
  - Destination `.env.local` is missing Stripe keys present in source:
    - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `CLERK_WEBHOOK_SECRET`
- Verify Typesense and R2 keys exist for search/index scripts (already present in destination env keys).

**Rollback**

- Revert `package.json` and env changes (keep a copy of previous env files).
- If Convex env vars were changed, restore previous values in the Convex dashboard.

**Testing**

- `npm run lint`
- `npm run build`

**Success metrics**

- `migration_config_diff.md` shows no missing required keys for planned pages/scripts.

---

### Phase 2 — Migrate missing scripts (Mar 11, 2026)

**Actions**

- Copy the 9 missing `scripts/*.mjs` into destination.
- Validate each script runs to “help/usage” level (or executes without syntax/import errors).

**Data integrity verification**

- For scripts that download/convert data:
  - Record input URLs, file sizes, and counts (rows/records).
  - Produce checksums for output JSON/CSV artifacts where applicable.
- For Typesense index scripts:
  - Validate collection exists and `found` counts are within expected ranges.

**Rollback**

- Revert the commit containing the scripts.
- Delete any newly-created `data/*` outputs from local runs (don’t commit generated data unless explicitly intended).

**Testing**

- `node scripts/<script>.mjs` (one-by-one, in a controlled environment)

**Success metrics**

- Scripts execute without runtime errors when required env keys are present.

---

### Phase 3 — Migrate missing shared components (Mar 11–12, 2026)

**Actions**

- Copy the 8 missing `src/components/*` files into destination.
- Ensure import aliases (`@/…`) resolve correctly under destination `tsconfig.json`.

**Rollback**

- Revert the commit containing these components.

**Testing**

- `npm run lint`
- `npm run build`

**Success metrics**

- Build passes with no new TypeScript errors.

---

### Phase 4 — Migrate missing routes/pages (Mar 12–13, 2026)

**Actions**

- Copy the missing route files into destination:
  - HMRC callback page
  - Admin, Pricing, Search, User, Billing pages
- Wiring step (intentional decision point):
  - Decide which routes should be linked in `src/components/app-sidebar.tsx` navigation.
  - Add RBAC/guards for `/dashboard/admin` if needed (e.g., Clerk roles/metadata).

**Data integrity verification**

- Search route:
  - Ensure Typesense returns stable results for a fixed query set.
  - Verify “save company” writes consistent documents (Convex table constraints).
- Billing/Pricing routes:
  - Verify Stripe checkout/portal actions return URLs in dev/staging.
  - Validate webhook ingestion path (if enabled) updates `subscriptions` correctly.
- HMRC callback:
  - Validate OAuth callback exchange doesn’t corrupt stored tokens (no partial writes).

**Rollback**

- Revert the commit containing routes + wiring.
- If schema/data migrations were applied in Convex, roll back the Convex deployment to previous revision and restore DB snapshot.

**Testing**

- `npm run lint`
- `npm run build`
- Local smoke:
  - Load `/dashboard/search`, `/dashboard/pricing`, `/dashboard/user/billing` (verify no runtime errors)
  - Confirm Clerk session guard behavior.

**Success metrics**

- Key pages render without runtime errors.
- Stripe/Typesense/HMRC integrations work in a non-production environment.

---

### Phase 5 — Post-migration validation & “done” check (Mar 13–14, 2026)

**Actions**

- Run:
  - `powershell -NoProfile -File scripts\migration\verify.ps1`
  - `npm run lint`
  - `npm run build`
- Re-run inventory; confirm `remaining_missing.csv` is empty.
- Record a final migration snapshot in `MIGRATION_LOG.md`.

**Rollback**

- Revert to baseline tag if any production-impacting regression is found.

**Success metrics**

- `remaining_missing.csv` count == **0**
- Production build succeeds.
- No P0 regressions in core dashboard flows.

---

## Optional Phase — Reconcile diverged files (only if needed)

The 47 entries in `remaining_diverged.csv` represent **already-present destination files** that differ from source. Do not overwrite them en masse.

Use reconciliation only when:

- A missing route/page requires an API that does not exist in destination, or
- A known feature regression is traced to divergence between source and destination.

Recommended approach:

- Diff file-by-file, merge the minimal required behavior, and re-run `lint/build` after each merge batch.
