# Divergence Reconciliation Report

Generated: 2026-03-10
Source: C:\Users\jason\OneDrive\tradedna
Destination: C:\Users\jason\trader-app

This report covers **hash mismatches** (files present in destination but differing from source).

## Summary

- Diverged files: 55
- Inventory CSV: divergence_inventory.csv

## Breakdown

- component: 23
- convex: 14
- other: 4
- route: 12
- script: 2

## Default policy

- Treat destination as canonical; do **not** bulk overwrite from source.
- Reconcile only when a specific regression/missing behavior is identified.

## How to diff a file

PowerShell example:

```powershell
git diff --no-index "<SRC_BASE>\\<RELATIVE_PATH>" "<DST_BASE>\\<RELATIVE_PATH>"
```

## component

- src\components\app-sidebar.tsx
- src\components\auth\user-sync.tsx
- src\components\data-table.tsx
- src\components\nav-documents.tsx
- src\components\nav-main.tsx
- src\components\nav-secondary.tsx
- src\components\providers\convex-provider.tsx
- src\components\ui\avatar.tsx
- src\components\ui\badge.tsx
- src\components\ui\button.tsx
- src\components\ui\card.tsx
- src\components\ui\collapsible.tsx
- src\components\ui\dialog.tsx
- src\components\ui\dropdown-menu.tsx
- src\components\ui\input.tsx
- src\components\ui\select.tsx
- src\components\ui\separator.tsx
- src\components\ui\sheet.tsx
- src\components\ui\sidebar.tsx
- src\components\ui\skeleton.tsx
- src\components\ui\table.tsx
- src\components\ui\tabs.tsx
- src\components\ui\tooltip.tsx

## convex

- convex_generated\dataModel.d.ts
- convex\actions\companies.ts
- convex\actions\hmrc.ts
- convex\actions\stripe.ts
- convex\ai.ts
- convex\auth.config.ts
- convex\hmrc_internal.ts
- convex\leads.ts
- convex\README.md
- convex\reference_data.ts
- convex\saved_companies.ts
- convex\schema.ts
- convex\subscriptions.ts
- convex\tsconfig.json

## other

- src\hooks\use-mobile.ts
- src\hooks\useReferenceData.ts
- src\lib\utils.ts
- src\proxy.ts

## route

- src\app\auth\hmrc\callback\page.tsx
- src\app\dashboard\assistant\page.tsx
- src\app\dashboard\calculator\page.tsx
- src\app\dashboard\compliance\page.tsx
- src\app\dashboard\layout.tsx
- src\app\dashboard\page.tsx
- src\app\dashboard\pricing\page.tsx
- src\app\dashboard\prospects\page.tsx
- src\app\dashboard\user\page.tsx
- src\app\globals.css
- src\app\layout.tsx
- src\app\page.tsx

## script

- scripts\convert-dcts-data.mjs
- scripts\index-companies.mjs
