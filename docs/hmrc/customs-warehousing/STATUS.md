# Customs Warehousing — where the work stands

**Status:** ACTIVE — H2 declaration filing is the feature, and it is done.
Warehouse stock management is out of scope.

Branch `feature/customs-warehousing`, commit `8bcf0b0d`. Not pushed, not merged.

This is the answer to "where are we on customs warehousing". It is a record of
what the feature is, not a plan for extending it.

---

## The scope

**The feature is filing an H2 declaration** — putting imported goods into a
customs warehouse with the duty and import VAT suspended. That is what was
asked for and that is what is built.

**Running a warehouse is not the feature.** The stock account a warehousekeeper
keeps day to day — movements, usual forms of handling, temporary removals,
losses, destruction, discharge paperwork — is a different product with its own
HMRC approval route. FreightCode is not building it.

The specification pack in this directory covers both, because the research
covered the whole regime. Most of it documents ground the product does not
stand on. That is fine; it is reference, not a backlog.

---

## What is built

Keep exactly as it stands. Do not remove, roll back or refactor.

| | |
|--|--|
| H2 declaration layer | `src/lib/h2-mapper.ts`, `src/lib/h2-xml-renderer.ts`, H2 in `src/lib/submit-category.ts` |
| Warehouse configuration | `convex/customs_warehouses.ts` |
| Receipt of goods | `convex/warehouse_entries.ts` |
| Schema | 5 tables in `convex/schema.ts` — `customs_warehouses`, `warehouse_entries`, `warehouse_stock_lots`, `warehouse_movements`, `warehouse_discharges` |
| Stock-account logic | `src/lib/warehouse/stock-account.ts` — pure functions, no persistence |
| Receipt logic | `src/lib/warehouse/receipt.ts` — pure functions, no persistence |
| Tests | `tests/h2/` (47), `tests/warehouse/` (86) |
| Specification pack | `docs/hmrc/customs-warehousing/` — 24 files, 15 handbook mirrors, 37 rules |

All green: `tsc --noEmit` clean, `lint:security` clean, 133 tests across the two
suites, wired into `npm run test:tdr` and the CI gate in
`.github/workflows/tdr-regression.yml`.

The warehouse configuration, receipt and stock-account code went past the
declaration and into warehouse operation. It was built before the scope line
was drawn, it is correct and tested, and it stays. **It is not unfinished
work.** Nothing depends on it being extended, and its presence is not a reason
to continue in that direction.

---

## What is not built, and is not planned

Warehouse movements, stock-account persistence, discharge workflows, the
approval evidence pack, and supervising-office readiness. Listed as phases F–J
in [`IMPLEMENTATION_SPEC.md`](IMPLEMENTATION_SPEC.md) §9.

Do not start any of them without a separate instruction.

---

## Three findings worth not rediscovering

**CDS approval is not stock-system approval.** They are unrelated. HMRC:
*"Software that has not been approved by HMRC cannot be used."* There is no
product certification scheme and no vendor testing route — approval happens per
warehouse authorisation, via the customer's supervising office, from
screenshots they submit with their application. This is the main reason
warehouse stock management is a different product, not a bigger version of this
one. Full finding in [`duty-management/approval.md`](duty-management/approval.md).

**Customs warehousing is not excise warehousing.** Different regime, different
authorisation, different declaration path. A single site can hold both
approvals and then keeps two stock accounts. Only the customs half is relevant
here — DE 2/7 types `R`/`S`/`T`/`U`, procedure 71, authorisations
`CWP`/`CW1`/`CW2`. Temporary storage is a third thing again, and also out.

**Four HMRC ambiguities remain unresolved**, listed in
[`IMPLEMENTATION_SPEC.md`](IMPLEMENTATION_SPEC.md) §10. The one that could
affect a live filing is DE 2/7 types S and T: the Group 2 guide bars them from
`GB`, procedure 71 bars them from `GB` or `XI`. The stricter reading is
implemented. Confirm before an XI submission.
