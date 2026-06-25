# Product progress log

Chronological ship log. Full checklist + priorities: **[`BACKLOG.md`](./BACKLOG.md)**.

**Logging convention (keep current):** add a dated section per production deploy — commit hash, deploy target, green-tick list of what shipped, and what's still local. Update on every push to `origin/main` / Vercel / `npx convex deploy`.

---

## 2026-06-23 (later) — Local / dev (uncommitted)

**TRE Phase 2 — opportunities engine + UI (deterministic, HMRC-aligned) — feature complete (pending deploy)**

- [x] `convex/lib/tre_opportunity.ts` — pure deterministic rule (no AI); preference-claimed guard, 3-year C285 window, conservative null on unquantifiable input
- [x] `convex/tre_analytics.ts` — `listOpportunities` query; org-scoped; MFN vs cheapest preference from `tariff_cache` via `evaluatePreferenceOptions`; indicative-only delta + non-promissory disclaimer
- [x] `tests/tre/opportunities.test.ts` — 20 TRE tests pass (`npm run test:tre`)
- [x] TRE page Opportunities section (`src/components/tre-opportunities.tsx`) — flagged rows, indicative delta, 3yr-window flag, C285 signpost, non-promissory disclaimer
- [x] Dashboard `overpayments` — TRE indicative flags merged into Potential Overpayments card (amber `~£`, indicative footnote)
- [x] Reports "Includes TRE history" badge when org has stored imports
- [x] Phase 2 verified: `npm run test:tre` (20 pass) + `tsc --noEmit` clean

**Also still local (earlier):** Convex query-thrash fixes, header/sidebar flicker fixes, documents dropdown polish, route cleanup.

---

## 2026-06-23 — Production (`d6b58cf`)

**Deploy:** Vercel production + Convex

- [x] TRE CSV import Phase 1 (`/dashboard/tre-import`, parser, `tre_imports`, API route)
- [x] Settings tab stability (Security panel no layout jump)
- [x] Reports Accepted status from read model
- [x] Slate UI polish (dashboard tables, admin, declaration workspace)
- [x] TRE redirect `/dashboard/import/tre` → `/dashboard/tre-import`

**Still local (not deployed):** Convex query-thrash fixes, header/sidebar flicker fixes, documents dropdown polish, route cleanup.

---

## 2026-06-22 — Production (`5810a81`)

- [x] Account data export (Settings → Privacy)
- [x] Honest marketing copy on homepage
- [x] Settings UX polish

---

## 2026-06-22 — Production (`19d7521`)

- [x] Practice-mode Test User UX
- [x] Settings HMRC disconnect
- [x] Homepage guide cleanup

---

## 2026-06-20 — Consolidated

Checklist merged into [`BACKLOG.md`](./BACKLOG.md). Earlier HMRC trade-test stage gates: [`../../ARCHIVE/trade-test/tdr-progress.md`](../../ARCHIVE/trade-test/tdr-progress.md).

