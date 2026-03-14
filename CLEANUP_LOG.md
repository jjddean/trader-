# Cleanup Log

Date: 2026-03-10

Scope:

- Navigation alignment and sidebar spacing adjustments
- KPI stability without skeletons
- Prospects table layout and scroll behavior
- Removal of stale UI variants and script placement fixes

Changes:

- Sidebar/Header alignment:
  - Reduced sidebar header height to 48px.
  - Reduced top padding in sidebar content and button spacing.
  - Matched app header height to 48px for alignment.
- KPIs (Dashboard, Compliance):
  - Replaced skeletons with fixed-width tabular number boxes to prevent layout shifts while loading.
- Prospects page:
  - Status uses combobox; Actions reverted to star button.
  - Table uses fixed layout and truncation; horizontal scroll enabled with min width; removed vertical sticky header.
- Font/text-scale:
  - Pre-hydration script moved into `<head>` to eliminate script order and hydration warnings.
- Stale code removal:
  - Removed dropdown Actions menu variant.
  - Eliminated skeleton usage in KPIs.
  - Removed unused Inter package earlier; no font-face duplicates.

Verification:

- Typecheck: `npx tsc --noEmit` — OK.
- Production build: `npm run build` — OK; no hydration or script-order errors.
- Manual checks:
  - No KPI digit pops.
  - Prospects table does not overlap; scroll appears at bottom when needed.
  - Sidebar menu aligns with top header; spacing is compact.

Notes:

- Further tightening available on request (e.g., smaller paddings or sticky headers).
