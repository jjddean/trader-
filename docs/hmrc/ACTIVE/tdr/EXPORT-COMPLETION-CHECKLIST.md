# B1 / C1 / I1 — completion checklist

**Status:** ACTIVE — B1 has been submitted to HMRC twice and returned HTTP 202
both times. "Accepted" means only that the gateway took the message: no MRN was
issued and no DMS notification has ever come back, so B1 has not been processed
by CDS. C1 and I1 have never been submitted.

**Supersedes the "not started" claim in**
[`../../FUTURE/CDS-EXPANSION-BUILD-PLAN.md`](../../FUTURE/CDS-EXPANSION-BUILD-PLAN.md).

**Obligation sources**
[`appendix-22a-b1-obligations.md`](../../specs/cds-api/appendix-22a-b1-obligations.md) ·
[`appendix-22d-c1-obligations.md`](../../specs/cds-api/appendix-22d-c1-obligations.md) ·
[`appendix-21f-i1-obligations.md`](../../specs/cds-api/appendix-21f-i1-obligations.md)

---

## Where this stands

| | B1 | C1 | I1 |
|---|---|---|---|
| Data elements in the appendix | 60 | 48 | 56 |
| Of those, mandatory (`A`) | 19 | 19 | 19 |
| Mandatory DEs emitted by the mapper | 19 | 19 | 19 |
| Mandatory DEs with their own validation message | 16 | 16 | 14 |
| Submitted to HMRC | yes, 202 | no | no |
| Cleared by CDS | **no** | no | no |

The three unvalidated DEs on B1 are DE 2/1, DE 2/5 and DE 6/18. All are derived
by the mapper — previous document from the DUCR, LRN from the reference, total
packages summed from the items — so they cannot be absent. The I1 gap has not
been examined.

**Accepted is not cleared.** Two B1 submissions returned HTTP 202 with a
conversation ID. Neither produced an MRN or any DMS notification, and the
second was later found to carry no exporter at all. A 202 says the message was
taken, nothing more.

---

## 1. Data set correctness

- [x] DE 1/1 + 1/2 — `EXA`/`EXD` derived from the user's selection, not forced
      to `A`. Read from `additionalDeclarationType`; `declarationType` holds the
      category and must never be used for this
- [x] DE 1/2 validated against HMRC's published code list, not merely non-empty
- [x] DE 3/1 + 3/2 — exporter reachable on the export form, EORI or name and
      address, mutually exclusive per Group 3
- [x] DE 4/11 — invoice total falls back to the sum of item values
- [x] DE 5/12 customs office of exit, mandatory and collected
- [x] Import-only elements absent from the payload and hidden on the form
- [x] Category dispatch in the submit route and in the on-screen preview
- [ ] DE 3/2 accepts an EU EORI. HMRC permits GB, EU or XI; only GB and XI are
      recognised, so an EU exporter is asked for a DE 3/1 address instead.
      Produces a valid declaration, more paperwork than required
- [ ] I1 mandatory-DE validation reviewed — 14 of 19 named, unexamined
- [ ] C1-specific rules beyond DE 1/2 reviewed against Appendix 22D

## 2. Submission path

- [x] Renders XML that passes the WCO XSD structural check
- [x] Accepted by HMRC — 202 with a conversation ID
- [ ] **DMSACC or DMSREJ received.** Nothing has come back from either
      submission. Imports on the same setup answer in 39–51 seconds
- [ ] MRN issued
- [ ] Establish whether the sandbox host answers export declarations at all.
      Every notification in the table to date came from an import
- [ ] C1 submitted
- [ ] I1 submitted

## 3. Product surfaces

- [x] Real failure messages reach the user instead of "Dry run failed"
- [x] Payload preview shows the category's own data set
- [x] No import duty or VAT estimate on an export
- [ ] A declaration HMRC never answers is locked in `Processing` for good —
      not editable, not cancellable, no way back to draft. Blocks retesting and
      would strand a real filing
- [ ] Consignee name (DE 3/9) renders on imports, where it is not in the H1 set
- [ ] DE 1/2 has two separate controls — "Arrival status" and "Additional
      Declaration Type" — for one data element

## 4. Regression cover

- [x] B1 83 · C1 20 · I1 25 · H1 198 · unit 94, all passing
- [x] XSD structural conformance for all four categories
- [x] Fixtures use the field names the database actually stores. They did not,
      which is why the DE 1/2 defect passed every suite
- [ ] A test that builds a declaration from a real stored row rather than a
      hand-written fixture

## 5. Before this can be called done

- [ ] One B1 cleared by CDS with an MRN
- [ ] One C1 cleared
- [ ] One I1 cleared
- [ ] Submitted XML retained as evidence for each, under
      `docs/hmrc/ACTIVE/tdr/evidence/`
- [ ] Notification round trip proven by both push and pull
- [ ] `CDS-EXPANSION-BUILD-PLAN.md` status line corrected and the plan archived

---

## What would move this furthest

Nothing on the correctness list changes the fact that CDS has never answered an
export. Until a DMSACC or DMSREJ arrives, every fix is inferred from the
specification rather than confirmed by HMRC — which is how a missing exporter
reached them in the first place.

The open question is whether the sandbox host answers export declarations at
all. It is answerable by submitting one import on the same configuration: if
that returns a notification within the usual minute and the export still does
not, the difference is the data set, not the declaration.
