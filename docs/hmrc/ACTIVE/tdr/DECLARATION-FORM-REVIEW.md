# Declaration form — review

**Status:** ACTIVE — record of what the form collects, what was wrong with it,
and what is still open.

Covers `src/app/dashboard/declarations/[id]/page.tsx` and the four category
mappers. Written 2026-08-27, on `feature/b1-export-obligations`.

---

## 1. What the form collects now

28 data-element fields. Visibility is driven by the declaration category.

| DE | Field | Shown on |
|---|---|---|
| 1/2 | Declaration category | all |
| 1/2 | Arrival status (A/D) | export |
| 1/2 | Additional declaration type (C/F) | simplified |
| 2/6 | Deferment account | all |
| 3/1 + 3/2 | Exporter | export |
| 3/1 | Overseas exporter | overseas dispatch — import rule |
| 3/9 | Consignee name | export |
| 3/10 | Consignee EORI | export |
| 3/16 | Importer EORI | import |
| 3/18 | Declarant EORI | all |
| 3/39 | Holder of the authorisation | simplified |
| 4/1 | Incoterms, Incoterm location | import |
| 4/8 | Method of payment | import |
| 4/11 | Invoice currency, Invoice total | all |
| 5/8 | Destination country | all |
| 5/12 | Customs office of exit | export |
| 5/14 | Dispatch country | all |
| 5/23 | Location of goods | all |
| 5/26 | Customs office of presentation | all |
| 7/4 | Transport mode | all |
| 7/9 | Identification type, Identification | all |
| 7/10 | Container number | all |
| 7/18 | Seal number | export |
| 8/5 | Nature of transaction | all |

Mandatory elements the form does not collect are derived by the mapper and
cannot be missing: DE 1/1 from the category, 2/1 from the DUCR, 2/5 generated,
6/5 and 6/18 summed from the goods items, 7/2 from the container number.

---

## 2. What was wrong, and what fixed it

Everything below was found between 23 and 27 August. Each was a real defect,
not a preference.

### Found by testing

| Fault | Effect |
|---|---|
| DE 1/2 read from `declarationType`, which holds the category | Every B1 emitted `EXA` whatever was selected; C1 and I1 could never validate at all |
| Exporter block gated on `dispatchCountry !== GB` — an import rule | DE 3/1 unreachable on an export; a declaration went to HMRC with no exporter |
| Import-only fields visible and submitted after a category switch | Mapper rejected the declaration; nothing on screen explained it |
| Category clearing only fired if the value was already stored | A value typed before the switch was written through anyway |
| Submit errors thrown as plain `Error` | `userMessageFromError` discarded them; every failure read "Dry run failed" |
| Payload preview hardcoded to `mapToCDS_H1` | A B1 was shown an H1 payload captioned as exactly what would be sent |
| Cost estimate not category-aware | £2,088 of import duty shown on an export |
| Design tokens deleted in March | `bg-popover` generated no CSS; the country dropdowns opened transparent and could not be used |
| DE 4/11 used the field directly | Emitted `0.00` against a populated statistical value |

### Found by CDS rejecting a real submission

The first export CDS validated came back with nine errors. Codes resolved
against `docs/hmrc/specs/error-codes/cds-error-codes-2026-03-11.ods`.

| Code | Meaning | Fix |
|---|---|---|
| CDS12071 | DE declared at both header and item level | DE 6/5 emitted per item only |
| CDS12074 | DE 3/19 absent makes DE 2/2 mandatory | AI `00400` "Exporter" at item level |
| CDS77002 ×3 | Document status code missing | Defaults to `AC`, as the H1 path does |
| CDS10010 | Format error on the consignee address | Data — city and postcode were repeated into the street line |
| CDS12070 | Seal missing | DE 7/18 declared as `0` / `NOSEALS` when nothing is sealed |

### Two of my own

| | |
|---|---|
| A hydration guard meant to protect unsaved edits | Left the form permanently unpopulated. Reverted |
| Explicit `SelectValue` children | Broke Radix's portal. Reverted |

Also: dropping DE 6/5 from the mapper left the renderer emitting an empty
element, which HMRC rejected as an invalid decimal. The preflight's empty-tag
check could not see it — it required an element with no attributes, and every
measure carries `unitCode`. Both fixed.

---

## 3. Still open

**CDS12070 at `Declaration/TypeCode`.** Survived every submission on both
arrived and pre-lodged. It says the value in DE 1/1 mandates another element
without naming which. Unexplained.

**CDS12120 on arrived exports.** An `EXA` needs DE 3/39, and the field is
gated on `isSimplifiedCategory` so it never renders for B1. Same shape of bug
as the exporter one. Not yet fixed.

**No export has cleared.** Every submission so far has been rejected or is
awaiting a result.

---

## 4. The structural problem underneath

Every one of the visibility bugs has the same cause: this is an H1 import form
with export fields bolted on, and category flags sprinkled through one long
list. A field can be gated on the wrong condition, stay visible when it should
not, keep submitting after being hidden, or exist twice for one data element —
DE 1/2 currently has two separate controls.

Each fix has been per-field. The category is the thing that should drive it:
each data set declares its own fields from its appendix, and the form renders
those. Then a field cannot be missing, cannot linger, and cannot be duplicated.

`src/app/design-preview/[id]/` on `feature/design-system-preview` is a version
of these pages built that way — 25 DE fields against this form's 28, with
category logic throughout rather than bolted on, and layouts the fields sit in
properly. Adopting it means moving those pages onto the real routes, wiring the
real mutations, and carrying across every fix listed in section 2, all of which
postdate it.
