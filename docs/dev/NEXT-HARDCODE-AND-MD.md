# Next work — hard-code + Markdown

**Status:** ACTIVE — do this first  
**Date:** 2026-08-29  
**Owner index:** this file. TDR backlog pointer: [`docs/hmrc/ACTIVE/tdr/BACKLOG.md`](../hmrc/ACTIVE/tdr/BACKLOG.md).

Two remaining streams. Do not start other workstreams until this file is closed or the product owner changes the order.

Working-tree Phase 1 P0s and the valuation-fallback fix are **implemented, not committed**. Do not re-do them. Do not commit, deploy, or seed unless asked.

---

## A. Hard-code remaining

Already in the working tree (not this queue):

- P0-1 dry-run `validationFields` removed
- P0-2 H1 Method 1 only (`h1_valuation.ts`; no renderer `|| "1"`)
- P0-3 H1 DE 1/2 `resolveCdsTypeCode`
- P0-4 code-list fail-open + dry-run visibility
- P0-5 `REQUIRED_DOCS` is not a submit gate
- Non-H1 engine fallback `"1"` removed (`rule_engine.ts`); B1/C1/I1 no longer invent Method 1 / `INV-METHOD1-N935`

Still open:

| Item | Where |
|------|--------|
| Preference default `"100"` | `wco-mapper.ts` `preferenceCode \|\| "100"`; renderer `DutyRegimeCode \|\| "100"` |
| APC invented as `000` | `wco-mapper.ts` when APC missing |
| Supplementary units | set is only `8471300000` |
| Marks fallback `N/A` | `wco-mapper.ts` |
| Invoice total fallback | `invoiceTotal` or item sum |
| Statistical / item currency hard-coded GBP | `wco-mapper.ts` |
| VAT 20% on estimates | `trade-data.ts` `* 0.20` |
| Methods 2–6, I1 valuation, DE 4/16 UI | not built |
| Phases 2–5 | seed regulatory checks, tariff DE 6/2, golden XML, delete old gates — not started |
| Commit / production Convex + `seedAll` | not authorised |

Do not change `INV-METHOD1-N935`, `REQUIRED_DOCS`, submit readiness, or mappers unless the next hard-code item names that file.

---

## B. Markdown remaining

Already done:

| Part | Files | Git |
|------|--------|-----|
| 1 / 1B | `CLAUDE.md` | committed `07956c5e` |
| 2 / 2A | `README.md` | committed `07956c5e` |
| 3 | `AGENTS.md`, `.cursorrules`, `.agents/rules.md` | committed `07956c5e` |
| 4 | `environment-matrix.md` | written, uncommitted |
| 5 / 5A | AGENT-SPEC environment + `FreightCode` title | written, uncommitted (file also has other dirty hunks) |
| Inventory | classify + Parts 6–12 list | done; no files changed for Parts 6+ |

Also dirty (index/stub only): `docs/hmrc/README.md`, `DELIVERY-PLAN.md`.

**Paused until this file is executed.** Resume at Part 6. KEEP and ARCHIVE from the inventory are not remaining work. Eight R&D legal files stay UNKNOWN — do not delete.

### Part 6 — live ops / customer / handover vs matrix

- `docs/hmrc/ACTIVE/tdr/CUSTOMER-TDR-GUIDE.md`
- `docs/hmrc/ACTIVE/tdr/hmrc-operations-runbook.md`
- `spec/HANDOVER.md`
- `documentation/admin-guide.md`
- `docs/hmrc/ACTIVE/tdr/security/SECURITY-REVIEW.md`
- `docs/hmrc/FUTURE/production/README.md`

### Part 7 — superseded executable plan

- Stub `docs/hmrc/FUTURE/CDS-EXPANSION-BUILD-PLAN.md`
- One-line fix on `docs/hmrc/specs/cds-api/declaration-categories-index.md`
- Decide `docs/hmrc/ACTIVE/tdr/CDS_Declaration_Specifications.md`

### Part 8 — TDR index

- `BACKLOG.md` environment/scorecard language only
- `docs/hmrc/README.md` (add environment-matrix; match CLAUDE)

### Part 9 — `documentation/` disposal

- Delete empty/pitch candidates listed in the inventory
- Stub or delete `admin-guide.md` after extracting unique ops facts
- Do not delete the eight R&D legal/policy files until decided

### Part 10 — non-TDR module indexes

- CNS: `docs/cns/plan/README.md`, `REVISED-PLAN.md`, `docs/cns/CNS-REMAINING-PLAN.md` — status/counts only
- Export-controls: `BUILD-PLAN.md` index/status only; do not force onto TDR BACKLOG

### Part 11 — security pack status

- Remaining `docs/hmrc/ACTIVE/tdr/security/*` plus SCRIPT-INVENTORY / REPOSITORY-AUDIT

### Part 12 — P2 hygiene

- notifications plan, production-hardening, TRE/financial titles, archive `tdr-sdst-request.md`, leftover UNKNOWN (`cloudagent/DEPLOY.md`, `docs/dev/financial-obligations-log.md`, `scripts/lora/README.md`)

Do not mix CNS or export-controls plans into the TDR BACKLOG in these parts.

---

## Close this file

When both queues are empty or superseded, set **Status:** DONE and move to `docs/ARCHIVE/` if nothing outstanding remains.
