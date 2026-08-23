# Customs Warehousing — FreightCode implementation specification

**Status:** FUTURE — not started

| | |
|--|--|
| Feature | Customs Warehousing (CW) |
| CDS category | H2 |
| Primary requested procedure | 71 |
| Procedure 71 guidance | HMRC updated 13 August 2026 |
| Customs Warehousing handbook | HMRC updated 30 April 2025 |
| Specification retrieved | 2026-08-23 |
| Provenance | [`SOURCES.md`](SOURCES.md) |

Translates HMRC's specification into FreightCode engineering requirements
without changing any HMRC rule. Where this document and a mirror disagree, the
mirror wins.

Nothing here is implemented. No existing CDS behaviour changes.

---

## 1. The thing to understand first

**This is two products, and the declaration is the smaller one.**

Filing an H2 gets goods into the warehouse. Everything after that — the stock
account, the movement ledger, the discharge chain — is what HMRC actually
approves and audits, and it is where the compliance risk sits.

HMRC is explicit that the stock system needs its own approval and that CDS
approval does not confer it. Read [`duty-management/approval.md`](duty-management/approval.md)
before planning the build; it changes the shape of the work.

The single most product-shaping requirement in the whole pack:

> "identify goods with a tariff preference or quota or licensing restriction and
> make sure the appropriate certificate or licence is available prior to removal
> of the goods to free circulation"

That is not a report. It is a **block on discharge**.

---

## 2. Lifecycle

```
Goods arrive
    ↓
H2 entry declaration (DE 1/10 = 71xx)          ← declaration layer
    ↓
CDS accepts → MRN → released to the procedure
    ↓
Physical receipt at the warehouse (≤5 working days)
    ↓  discrepancy? → report to supervising office, amend the entry
Stock lot created, under procedure                ← warehouse layer
    ↓
Warehouse operations: internal moves, UFH, temporary removal,
losses, destruction, transfer, co-storage, common storage
    ↓
Discharge — one entry, many discharges, partial allowed
    ├── 4071 release to free circulation (H1 / H5 / I1 B&E)
    ├── 31xx re-export (B1 / C1)
    ├── entry to another special procedure
    └── destruction
    ↓
Balance reaches zero → procedure closed for that lot
    ↓
Records retained 4 years FROM DISCHARGE
```

Two properties that must survive into the data model:

1. **One entry, many discharges.** A warehouse entry is not discharged by a
   single MRN. Partial discharge is normal and the remaining balance stays
   under procedure.
2. **The duty point is the acceptance date of the removal declaration**, not the
   date the goods physically move. The rate is fixed at acceptance.

---

## 3. Declaration layer — H2 entry

Full matrix: [`../specs/cds-api/appendix-21b-h2-obligations.md`](../specs/cds-api/appendix-21b-h2-obligations.md).
Rules in structured form: [`validation/h2-rules.json`](validation/h2-rules.json).

### What makes H2 unlike H1

**Group 4 is nearly gone.** Valuation method, delivery terms, tax calculation,
method of payment, deferred payment, additions and deductions, invoice totals —
none are declared, because no charge arises at entry. `DE 4/17` preference
survives as the only Group 4 element, optional. `DE 6/1` net mass is absent;
gross mass only. Guarantee fields `8/2`/`8/3` are not declared per consignment,
though a Customs Comprehensive Guarantee is required for the authorisation.

**Five things become mandatory** that are conditional on H1: `2/3` documents,
`3/39` authorisation holder, `6/9` package type, `6/11` shipping marks, `7/2`
container. Plus `8/6` statistical value.

**`DE 2/7` exists on no other import category** and is mandatory.

### Procedure and type rules

| | |
|--|--|
| DE 1/10 | 71xx — ten codes, see [`reference/procedure-codes.json`](reference/procedure-codes.json). One per goods item. Every code on a declaration must share a category. |
| DE 1/1 | `IM`, or `CO` for Customs Union status — and `CO` requires APC `F15` |
| DE 1/2 | `A`, `C`, `D`, `F`, `J`, `K`. **Never `Y` or `Z`** |
| DE 1/11 | For 7100: `F15` Union; `000`, `1VW`, `2CD`, `2CG` National |

**The supplementary declaration is waived** on entry to customs warehousing
(UCC Article 167(2)(a)). This is not "optional" — the CDS supplementary
workflow must be actively suppressed for H2, or FreightCode will schedule
declarations HMRC does not want.

### The warehouse identity chain

Three data elements must agree, and FreightCode should treat them as one object:

```
DE 2/7   type letter + warehouse ID        R1234567GB
DE 3/39  authorisation type + holder EORI  CWP + GB553202734852
DE 2/3   document code + decision number   C517 + GBCWP12345
```

Mapping: `U`↔`CWP`↔`C517`, `R`↔`CW1`↔`C518`, `S`↔`CW2`↔`C519`.
`S`/`T` are barred from GB or XI; `CW2` likewise.

### The same-warehouse rule

All goods items must be entered to the same warehouse. `DE 2/7` is header-level,
so this is enforced structurally — **do not offer a per-item warehouse field.**

---

## 4. Warehouse layer — data model

Derived from HMRC requirements, not from the example in the task.

### `customs_warehouses`

The master record. One per authorised warehouse, not per organisation.

| Field | Source |
|-------|--------|
| `orgId`, `name` | FreightCode |
| `warehouseType` | `R` \| `S` \| `T` \| `U` — DE 2/7 |
| `warehouseId` | The reference number including country code, e.g. `1234567GB` |
| `authorisationTypeCode` | `CWP` \| `CW1` \| `CW2` — DE 3/39 |
| `authorisationNumber` | The decision number — DE 2/3 |
| `authorisationHolderEori` | DE 3/39 identifier |
| `supervisingCustomsOffice` | DE 5/27, from the authorisation letter |
| `goodsLocationCode` | DE 5/23 |
| `address`, `sites[]` | Authorised premises; a warehouse may have several |
| `permittedCommodityCodes[]` | 6+ digits, from the application |
| `permittedProcedureCodes[]` | From the application |
| **`stockUpdateMode`** | `real_time` \| `closing_balance` — see §6 |
| `eidrAuthorised` | If true, `stockUpdateMode` is forced to `real_time` |
| `coStorageApproved`, `commonStorageApproved`, `fifoApproved`, `ufhApproved` | Per-authorisation permissions |
| `guaranteeReference`, `aeoStatus` | CCG unless AEO |
| `authorisationValidFrom` / `To`, `status` | |

Northern Ireland and Great Britain need **separate authorisations**, so a
GB+NI operator has two warehouse records, not one with two addresses.

### `warehouse_entries`

Links an H2 declaration to a physical receipt. Distinct from the stock lot
because one entry can be received short, over, or damaged.

| Field | Notes |
|-------|-------|
| `customsWarehouseId`, `declarationId` | |
| `entryMrn`, `enteredAt` | `enteredAt` starts the 14-day discrepancy clock |
| `releasedAt` | CDS release; starts the 5-working-day arrival expectation |
| `receivedAt` | Physical receipt |
| `status` | see §5 |
| `discrepancyType` | `none` \| `under` \| `over` \| `damage` \| `packages` |
| `discrepancyReportedAt`, `supervisingOfficeRef` | |

### `warehouse_stock_lots`

The stock account. One row per goods item admitted to the procedure.

| Field | Why |
|-------|-----|
| `customsWarehouseId`, `warehouseEntryId` | |
| `entryMrn`, `entryGoodsItemNumber` | The audit-trail anchor HMRC expects |
| `commodityCode`, `description`, `originCountry` | |
| `packages`, `packageType`, `grossMass` | No net mass — not on H2 |
| `quantityEntered`, `quantityRemaining` | Partial discharge needs both |
| `statisticalValue` | DE 8/6, mandatory at entry |
| `warehouseLocation` | "how the goods will be identified in the warehouse" |
| `procedureCode` | The 71xx used |
| **`licenceRequired`**, `licenceProduced` | DBT licences may be deferred to removal — this pair is what blocks discharge |
| **`preferenceClaimIntended`**, `preferenceType` | Captured at entry via AI `WHSRP`; consumed at discharge |
| `quotaOrderNumber` | Quota is claimed on removal, not entry |
| `proofOfOriginRef` | Must be valid for the goods actually removed |
| `coStorageGroupId`, `commonStorageGroupId` | |
| `status` | see §5 |

### `warehouse_movements` — the ledger

Append-only. Every change to stock is an event; balances are derived, never
edited in place. HMRC audits the trail, not the total.

| Operation | Prior approval? | Effect on customs stock |
|-----------|-----------------|-------------------------|
| `RECEIPT` | no | creates the lot |
| `INTERNAL_MOVE` | no | location only, quantity unchanged |
| `TRANSFER` | authorisation-dependent | moves between warehouses, stays under procedure |
| `ADJUSTMENT` | notify on discrepancy | quantity ±, always needs a reason |
| `USUAL_FORM_OF_HANDLING` | must be authorised | may change description/commodity code |
| `TEMPORARY_REMOVAL` | authorised, time-limited | stays under procedure while off site |
| `RETURN` | no | closes a temporary removal |
| `SAMPLING` | rules per handbook | quantity − |
| `LOSS` | notify | quantity −, may create a customs debt |
| `DESTRUCTION` | must be authorised | quantity −, discharges |
| `DISCHARGE` | no | quantity −, links the discharge declaration |

Each row: `stockLotId`, `type`, `quantity`, `occurredAt`, `recordedAt`,
`userId`, `reason`, `declarationRef`, `documentRef`, `approvalRef`,
`balanceAfter`.

`occurredAt` and `recordedAt` are separate because closing-balance mode permits
a lag, and the lag is exactly what an auditor checks.

### `warehouse_discharges`

| Field | Notes |
|-------|-------|
| `stockLotId`, `quantity` | Partial by design |
| `dischargeType` | `free_circulation` \| `re_export` \| `other_procedure` \| `destruction` |
| `declarationId`, `dischargeMrn` | |
| **`acceptedAt`** | The duty point. Sets the rate. Not the movement date |
| `documentsVerifiedAt` | The licence/preference gate, cleared before release |

---

## 5. States

Validated against the handbook rather than invented.

**Warehouse entry:**
`DRAFT → H2_SUBMITTED → CDS_ACCEPTED → RELEASED_TO_WAREHOUSING → AWAITING_RECEIPT → RECEIVED`
with `DISCREPANCY` reachable from `AWAITING_RECEIPT` or `RECEIVED`, and
`REJECTED` from `H2_SUBMITTED`.

The task's proposed `UNDER_WAREHOUSE_PROCEDURE` is dropped from the entry: it
describes the **stock lot**, not the entry, and conflating them makes partial
discharge unrepresentable.

**Stock lot:**
`UNDER_PROCEDURE → PARTIALLY_DISCHARGED → DISCHARGED`, plus
`TEMPORARILY_REMOVED`, `BLOCKED` (documents outstanding), `WRITTEN_OFF`.

---

## 6. Duty management requirements

Full detail: [`duty-management/approval.md`](duty-management/approval.md) and
[`duty-management/system-requirements.md`](duty-management/system-requirements.md).

The four conditions, as build requirements:

1. **Full audit** — any lot traceable to entry MRN, documents and physical
   location on demand.
2. **Complete stock account** — with the customer's commercial records, one
   system holding everything needed for integrity.
3. **Document gate** — preference, quota and licence restrictions identified,
   and the certificate present **before** release to free circulation.
4. **Update timing** — real time by default; before midnight of the following
   warehouse operation day if authorised for closing balance.

Plus: 4-year retention **from discharge**, on-demand update at an officer's
request, and — if FreightCode operates the DMS as a third party — permanent
warehousekeeper access or daily reporting of receipts, deliveries, adjustments
and balances.

---

## 7. Reuse of FreightCode infrastructure

Mapped against the current repository.

### Reuse unchanged

OAuth and PKCE, token storage and encryption, environment selection and the
live-flip guard, `fetchHmrc`, audit logging, org/tenant access via
`canAccessDeclaration`, rate limiting, `userError`/`ApiError` surfacing,
`xmlEscape`, the notification pipeline and MRN handling, the rule engine, and
the `node --test` + tsx convention.

H2 is a CDS import declaration on the same API as H1 — **the submission engine
is not duplicated**.

### Generalise before H2 can be built

| What | Why |
|------|-----|
| `mapToCDS_H1` | Emits the full valuation block unconditionally — `TradeTerms`, `CustomsValuation`, `DutyTaxFee`, `InvoiceLine`. H2 declares none of it. Same class of problem the B1/I1 work hit. |
| `submit/route.ts` dispatch | Already category-aware from the B1/C1/I1 work. Add `H2` to `resolveDeclarationCategory` and `declarationCategory` in the schema union. |
| Supplementary declaration flow | Must be suppressed for H2, not merely unused. |
| `declarations` table | Needs `identificationOfWarehouse` and the authorisation pair. These are CDS fields, so they belong on the existing table rather than a new one. |
| Rule engine `triggerScope` | Needs `declarationCategories`, the same gap already noted for B1/C1/I1. |

### Build new

The entire warehouse layer: four tables, the movement ledger, the discharge
chain, the document gate, the approval evidence pack. None of it has an
analogue in the codebase — the CNS "inventory" tables are CSP inventory-linked
imports, an unrelated concept.

---

## 8. Proposed layout

```
src/lib/cds/h2/
  h2-mapper.ts            EnsDeclaration-equivalent → H2 WCO payload
  h2-xml-renderer.ts      if the H1 renderer cannot be generalised
  h2-rules.ts             from validation/h2-rules.json
  warehouse-identity.ts   DE 2/7 + 3/39 + 2/3 as one validated object

src/lib/warehouse/
  stock-account.ts        balances derived from the ledger
  movements.ts            the operation set and their effects
  discharge.ts            allocation, FIFO, partial discharge
  document-gate.ts        the licence/preference block
  approval-evidence.ts    the reports a supervising office asks for

convex/
  customs_warehouses.ts
  warehouse_entries.ts
  warehouse_stock.ts      lots + movements
  warehouse_discharges.ts

src/app/api/hmrc/h2/submit/route.ts

tests/h2/                 mapper, rules, XSD structure
tests/warehouse/          ledger arithmetic, partial discharge, document gate
```

---

## 9. Phases

**A — H2 dataset support.** Category-aware engine: `H2` in the union, schema
fields, form. *Done when:* an H2 can be created and saved with no valuation
fields present.

**B — H2 rules.** The 26 declaration rules. *Done when:* every rule in
`validation/h2-rules.json` is enforced or listed as deferred with a reason —
the standard the B1/C1/I1 work already meets.

**C — H2 submission.** Through the existing CDS client. *Done when:* an H2
reaches CDS sandbox and returns an MRN, with the supplementary workflow proven
suppressed.

**D — Warehouse configuration.** `customs_warehouses` and authorisations.
*Done when:* a warehouse can be configured and its identity chain validates
against DE 2/7 / 3/39 / 2/3 consistency.

**E — Receipt.** Released H2 → stock lots. *Done when:* the 5-day expectation,
14-day discrepancy clock, and under/over shipment flows all work, with
overshipment correctly *not* amending the original entry.

**F — Stock account.** Ledger and derived balances. *Done when:* balances are
never stored, always derived, and an officer-requested reconcile can be
demonstrated.

**G — Operations.** Movements, UFH, temporary removals, losses, destruction,
co-storage and common storage. *Done when:* each operation's HMRC prior-approval
requirement is enforced.

**H — Discharge.** Partial and full, multiple discharges per entry.
*Done when:* the document gate blocks release to free circulation without the
licence or proof of origin, and the duty point uses the acceptance date.

**I — Compliance and audit.** The evidence pack. *Done when:* a warehousekeeper
can produce everything their supervising office asks for from the product.

**J — Approval readiness.** *Done when:* the questions in
[`duty-management/approval.md`](duty-management/approval.md) §Unresolved have
been put to a real supervising office and answered.

---

## 10. Unresolved HMRC ambiguity

1. **DE 2/7 types S and T** — the Group 2 guide bars them from `GB`; procedure
   71 bars them from `GB` **or `XI``. Procedure 71 is more recent and more
   specific, so it is followed, but confirm before an XI submission.
2. **Appendix 21B carries no version or date.** Only the retrieval date is
   recordable, so a silent change cannot be detected except by diffing.
3. **Authorisation type vs warehouse type cross-check** — the code sets map one
   to one, but HMRC never states the cross-check. Implemented as a warning, not
   a block, until confirmed.
4. **No DMS conformance standard.** Criteria are prose and the supervising
   office decides, so "approved" varies by office.
5. **SaaS as third-party record keeping** — not addressed. Build the daily
   reporting either way.
6. **Per-code APC lists** for 7110–7178 are in the mirror but not structured.
