# Migration Execution Log

Date: 2026-03-10

## Step 1 — Inventories and Gap Report

- Source: `C:\Users\jason\OneDrive\tradedna` (scoped to app/src/convex/scripts/public/components)
- Destination: `C:\Users\jason\trader-app`
- Output artifacts at repo root:
  - `src_manifest.csv`
  - `dst_manifest.csv`
  - `remaining_manifest.csv`
  - `remaining_missing.csv` (path absent in destination; **migration scope**)
  - `remaining_diverged.csv` (hash mismatch; treat as already transferred unless explicitly reconciling)

Summary:

- Counts: see console output during run (remaining entries captured in CSV).
- Script used: `scripts/migration/inventory.ps1`
  - Skips build folders (`.next`, `node_modules`, `.git`, `out`, `build`)
  - Gracefully skips unreadable OneDrive placeholder files

Sample "remaining" (top of CSV):

- `src/proxy.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/auth/hmrc/callback/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/admin/page.tsx`
- `src/app/dashboard/assistant/page.tsx`
- `src/app/dashboard/calculator/page.tsx`

NOTE: The CSV is authoritative; items listed above are examples to guide Wave 1.

## Step 2 — Execution Plan

- Comprehensive plan and phase-by-phase rollback/testing: `MIGRATION_EXECUTION_PLAN.md`
- Config/env diff (keys only): run `powershell -NoProfile -File scripts\\migration\\config-diff.ps1` → `migration_config_diff.md`
- “Done” check: run `powershell -NoProfile -File scripts\\migration\\verify.ps1` (fails if `remaining_missing.csv` is non-empty)

## Validation

- Typecheck and production build succeed in destination (previously verified).
- Inventory script exited successfully and produced the three manifests.

## Next Step (Wave 1 Plan)

1. Classify remaining items by feature area (UI components, routes/pages, providers, data).
2. For each item:
   - Confirm it is unused or missing in destination build graph.
   - Prepare a minimal port that adheres to current patterns (shadcn/radix, Geist Sans, tabular numerals where applicable).
   - Add per-item rollback (revert commit) and test notes.
3. Open PR: `feat/migrate-wave-1` containing the first batch (UI primitives and any leaf pages without backend coupling).

## Commands

Run inventories again if needed:

```
powershell -NoProfile -File scripts\\migration\\inventory.ps1
```

## Step 3 — Wave 1 Executed (Missing-by-path migrated)

Date: 2026-03-10

Actions performed in destination:

- Copied all files listed in `remaining_missing.csv` from source → destination (no overwrites).
- Replaced vulnerable `xlsx` with `fast-xml-parser` for ODS parsing in `scripts\\convert-dcts-data.mjs` and ran `npm install`.
- Fixed build blockers introduced by new routes:
  - `/auth/hmrc/callback` now wraps `useSearchParams()` usage in `Suspense` via `callback-client.tsx`.
  - `/dashboard/search` updated to match `convex\\saved_companies.saveCompany` args and TypeScript expectations.

Verification:

- `powershell -NoProfile -File scripts\\migration\\verify.ps1` now reports **Missing (path absent): 0**
- `npm run build` succeeds and includes routes:
  - `/auth/hmrc/callback`
  - `/dashboard/admin`, `/dashboard/pricing`, `/dashboard/search`, `/dashboard/user`, `/dashboard/user/billing`
- `npm run lint` passes with **0 errors** (warnings remain).
- `npm audit` reports **0 vulnerabilities** (clean audit policy satisfied).

Environment/config follow-ups (manual):

- Apply missing `.env.local` keys per `migration_config_diff.md`:
  - `CLERK_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

## Step 4 — Post-migration Validation (Gates + Data)

Date: 2026-03-10

Automated gates (latest run):

- `scripts\\migration\\verify.ps1`: Missing-by-path = **0**; Diverged = **56**
- `npm audit`: **0 vulnerabilities**
- `npm run lint`: **0 errors** (warnings remain)
- `npm run build`: success

Data checks (safe reads):

- Typesense search verification succeeded: `node scripts\\verify-search.mjs`

Divergence inventory:

- Generated `DIVERGENCE_REPORT.md` and `divergence_inventory.csv` from `remaining_diverged.csv`.
