# Customs Warehousing — specification pack

**Status:** FUTURE — not started

| | |
|--|--|
| Feature | Customs Warehousing (CW) |
| CDS category | H2 |
| Primary requested procedure | 71 |
| Procedure 71 guidance | HMRC updated 13 August 2026 |
| Customs Warehousing handbook | HMRC updated 30 April 2025 |
| Specification retrieved | 2026-08-23 |

Versioned HMRC source material for customs warehousing, held in-repo so the
implementation works from stored specification rather than re-reading GOV.UK.

**No customs warehousing functionality exists.** Documentation and reference
data only. No CDS behaviour was changed to create this.

---

## Where to start

| You want to | Read |
|-------------|------|
| Build it | [`IMPLEMENTATION_SPEC.md`](IMPLEMENTATION_SPEC.md) |
| Know whether FreightCode can legally be a stock system | [`duty-management/approval.md`](duty-management/approval.md) — **read this first** |
| Know where a file came from | [`SOURCES.md`](SOURCES.md) |
| Update the pack later | [`CHANGELOG_TRACKING.md`](CHANGELOG_TRACKING.md) |
| Fill in a declaration | [`../specs/cds-api/appendix-21b-h2-obligations.md`](../specs/cds-api/appendix-21b-h2-obligations.md) and [`declarations/procedure-71.md`](declarations/procedure-71.md) |

---

## Layout

```
docs/hmrc/customs-warehousing/
  README.md  SOURCES.md  IMPLEMENTATION_SPEC.md  CHANGELOG_TRACKING.md

  declarations/
    procedure-71.md          all ten 71-series codes, per-code completion rules

  operations/                the HMRC handbook, 15 sections mirrored
    introduction.md  using-a-customs-warehouse.md  receiving.md
    simplified-procedures.md  discharge.md  removals-for-export.md
    usual-forms-of-handling.md  losses.md  co-storage.md  common-storage.md
    destruction.md  temporary-removals.md  sampling-and-testing.md

  authorisation/
    warehousekeeper.md       approval requirements and the application pack

  duty-management/
    system-requirements.md   the DMS handbook section, verbatim
    approval.md              can FreightCode be an approved stock system

  reference/
    procedure-codes.json     entry + discharge codes, DE 1/1, 1/2, 2/1, APCs
    warehouse-types.json     DE 2/7, 2/3, 3/39, 2/2 code sets

  validation/
    h2-rules.json            26 declaration rules + 11 operational rules
```

The H2 obligation matrix lives at
[`../specs/cds-api/appendix-21b-h2-obligations.md`](../specs/cds-api/appendix-21b-h2-obligations.md),
with the other Appendix mirrors, following the repository's existing convention.

---

## What customs warehousing is

Goods are stored with **duty and import VAT suspended**. The charge crystallises
only when they leave for free circulation — or never, if they are re-exported.
For an importer it is cash flow; for a broker it is a service line.

Two declarations bracket the procedure:

- **Entry** — H2, procedure `71xx`
- **Discharge** — a *separate* declaration, `4071` to free circulation or `31xx`
  to re-export, citing 71 as the previous procedure

Between them sits the stock account, which is what HMRC actually approves.

---

## Five things that will catch out an implementer

**1. This is not primarily a declaration feature.** Filing H2 is the easy half.
The stock account, movement ledger and discharge chain are what make it customs
warehousing software, and they need their own HMRC approval.

**2. CDS approval does not make FreightCode an approved stock system.** HMRC:
*"Software that has not been approved by HMRC cannot be used."* Approval is per
warehouse authorisation, through the customer's supervising office. See
[`duty-management/approval.md`](duty-management/approval.md).

**3. Discharge must be blockable.** A lot needing a licence, preference proof or
quota certificate cannot be released to free circulation until the document is
present. That is an HMRC approval condition, not a feature request.

**4. One entry, many discharges.** Partial discharge is normal. Modelling one
warehouse entry as having one discharge MRN makes the product non-compliant.

**5. H2 has almost no Group 4.** No valuation method, delivery terms, tax
calculation, payment method or deferred payment — no charge arises at entry.
Reusing the H1 mapper unchanged will emit fields HMRC does not accept.

---

## Ground rules

1. Files under `operations/`, `authorisation/`, `duty-management/system-requirements.md`
   and `declarations/procedure-71.md` are HMRC's. Do not edit — re-download.
2. Files under `reference/` and `validation/` are generated from those mirrors.
3. GOV.UK material is © Crown copyright under the Open Government Licence v3.0.
4. HMRC overrides every other source, per [`../specs/README.md`](../specs/README.md).
5. Do not overwrite this pack on a later run — diff first, see
   [`CHANGELOG_TRACKING.md`](CHANGELOG_TRACKING.md).
