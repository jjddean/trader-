# CDS expansion build plan — B1 export, I1 simplified import, C1 simplified export

**Status:** Future — not started  
**Spec:** [`../specs/cds-api/declaration-categories-index.md`](../specs/cds-api/declaration-categories-index.md)  
**Backlog:** [`../ACTIVE/tdr/BACKLOG.md`](../ACTIVE/tdr/BACKLOG.md)  
**Last updated:** 2026-06-20

---

## Three things to build

| # | Build | CDS category | Spec appendix |
|---|-------|--------------|---------------|
| 1 | Standard **export** | B1 | 22A |
| 2 | **Simplified import** (frontier + supplementary) | I1 C&F → H* | 21F → 21A |
| 3 | **Simplified export** (frontier + supplementary) | C1 C&F → B1 | 22D → 22A |

Same API as H1 today: `POST /customs/declarations/`. Category = DE 1/1 + DE 1/2 in XML.

**Not in this plan:** C21 inventory, SPIMM, BIRDS, H7, stand-alone EXS-only.

---

## Starting point

Today: **H1 import only** — `mapToCDS_H1`, Appendix 21A mirrored, import UI.

Need: Appendix **21F/G**, **22A/D/E** mirrored; export UI; supplementary parent/child declarations; category-aware mapper.

---

## Step 0 — Shared refactor (once)

| Task | Where |
|------|--------|
| Mirror obligation tables | `docs/hmrc/specs/cds-api/appendix-21f-*.md`, `appendix-22*.md` |
| Category on schema | `declarations.declarationCategory`, `route` import/export |
| Supplementary link | `parentDeclarationId` on child declarations |
| Split mapper | `mapToCDS({ category, … })` → h1 / b1 / i1 / c1 modules |
| Generalise XML renderer | `cds-xml-renderer.ts` or dispatch from category |
| Category rule packs | `rule_definitions` / seed per appendix |
| Fixtures + tests | `test-evidence/fixtures/cds/{b1,i1,c1}/`, `test:cds-categories` |

---

## 1 — B1 standard export

**Phase 1**

- Export route on create/edit declaration
- `mapToCDS_B1` from Appendix 22A
- Export completion rules (Volume 3 export groups 1–8)
- Submit / amend / cancel through existing HMRC routes

**Phase 2**

- Multi-item, export document codes, import vs export list filter

**Phase 3 (optional):** B2, B4

---

## 2 — I1 simplified import

**Phase 1 — frontier I1 C&F**

- Declaration type selector: simplified import (regular)
- Reduced form per Appendix **21F** (not H1 with fields hidden)
- `mapToCDS_I1`, DE 1/2 codes C+F
- CPC guard: block I1 when Appendix 1 requires H1

**Phase 2 — supplementary**

- “Create supplementary” from accepted I1
- Pre-fill from I1; full H1 data set for remainder
- DE 2/1 previous document → I1 MRN (category Y)
- Accept Date in XML schema for supplementary

**Phase 3:** I1 B&E (21G), FSD (Appendix 24)

---

## 3 — C1 simplified export

**Phase 1:** Requires B1 export infrastructure (parties, export locations, EXS fields in combined set)

**Phase 2 — frontier C1 C&F**

- Simplified export type on export route
- Reduced form per Appendix **22D**
- `mapToCDS_C1`, DE 1/2 codes C+F

**Phase 3 — supplementary**

- C1 MRN → supplementary B1
- EXS fields omitted on supplementary where already sent pre-departure (per Appendix 22)

**Phase 4:** C1 B&E (22E)

---

## Build order

1. Spec mirrors + mapper split (don’t break H1)
2. **B1** export MVP
3. **I1** frontier (parallel OK if separate dev)
4. **C1** frontier (after B1)
5. Supplementary flows (I1 then C1)
6. FSD + occasional variants

---

## Main files

| Area | Files |
|------|--------|
| Spec | `docs/hmrc/specs/cds-api/appendix-21f-*.md`, `appendix-22*.md` |
| Mapper | `src/lib/wco-mapper*.ts`, `src/lib/cds-xml-renderer.ts` |
| Backend | `convex/schema.ts`, `convex/declarations.ts`, `rule_seed.ts` |
| UI | Declaration create/edit, type selector, supplementary wizard |
| Tests | `tests/cds/`, `test-evidence/fixtures/cds/` |

**Regression:** `npm run test:tdr` must stay green throughout.
