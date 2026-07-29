# Financial obligations — implementation log

**Branch:** `feature/trade-compliance-ui`  
**Status:** Phases 1–2 on branch; delete-declaration cleans `financial_obligations`  
**Convex dev:** schema + functions deployed via `npx convex dev --once`

---

## Goal

Persist duty/VAT as **upserted obligation rows** (not an immutable event stream). Same **Financial Records** UI (table + side sheet); no new page.

---

## Phase 1 — Schema + writers

### Table: `financial_obligations`

| Field | Notes |
|-------|--------|
| `declarationId`, `userId`, `orgId`, `clientId`, `mrn` | Tenant + shipment context |
| `obligationType` | `duty_a00` \| `vat_b00` |
| `amount`, `currency` | GBP |
| `authority` | `derived` \| `hmrc` |
| `status` | `estimated` \| `confirmed` |
| `estimateAmount` | Optional prior estimate when HMRC confirms |
| `confirmedAt`, `updatedAt` | Timestamps |

**Indexes:** `by_declaration`, `by_declaration_and_type`, `by_user`, `by_org`

### Write path

- `convex/lib/financial_obligations.ts`
  - `buildFinancialObligationDrafts()` — pure mapping from preview fields
  - `syncFinancialObligationsFromPreview()` — upsert/delete per declaration
  - `deleteFinancialObligationsForDeclaration()` — cleanup
- Hooked from `upsertDeclarationPreviewByDeclaration()` in `convex/declarations.ts`
- `deleteDeclaration` removes obligation rows for that declaration
- Writes only when: not `Draft`, MRN present, `financialSource` set, amount > 0

---

## Phase 2 — Financial Records read path

- `listFinancialObligationsForTenant()` in `convex/lib/org_access.ts`
- `financialRecordRowsFromObligations()` — maps obligations → existing record row shape
- `getFinancialRecords` query:
  1. Use stored obligations when present for a declaration
  2. Else **fallback** to previous compute-from-preview/items path

**UI:** unchanged (`src/app/dashboard/records/page.tsx`)

---

## Tests

- `tests/h1/financial-obligations.test.ts` — 5 cases (drafts + record mapping)

Run: `node --test --import tsx tests/h1/financial-obligations.test.ts`

---

## Files touched

| File | Change |
|------|--------|
| `convex/schema.ts` | `financial_obligations` table |
| `convex/lib/financial_obligations.ts` | **new** — core logic |
| `convex/declarations.ts` | Preview hook, `getFinancialRecords`, delete cleanup |
| `convex/lib/org_access.ts` | List obligations for tenant |
| `tests/h1/financial-obligations.test.ts` | **new** |
| `convex/_generated/api.d.ts` | Convex codegen |

---

## Out of scope

- **Backfill for MRNs created before financial obligations** — not required; obligations appear on the next preview refresh per declaration.

## Not done yet

- Dashboard KPI roll-ups from obligations
- Wire `estimateAmount` into Records side sheet copy (optional)

---

## Related branch (separate)

Other local WIP (e.g. sandbox activation) is not part of the financial obligations commit.
