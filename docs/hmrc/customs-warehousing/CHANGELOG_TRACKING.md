# Customs Warehousing specification — version tracking

**Status:** ACTIVE — process document

Regulatory specification data. Stored, not cached. Do not silently refresh.

---

## Current baseline

```
Feature:                       Customs Warehousing
CDS category:                  H2
Primary requested procedure:   71

Appendix 21B version/date:     no version or last-updated stamp on the page
Procedure 71 guidance:         HMRC updated 13 August 2026
Customs Warehousing handbook:  HMRC updated 30 April 2025

Retrieved:                     2026-08-23
```

Appendix 21B carrying no date is a real gap: a silent change to the H2 matrix
cannot be detected except by diffing the content. Diff it every refresh.

---

## Update procedure

1. Download to a scratch directory, never into `docs/hmrc/customs-warehousing/`.
2. Diff against the stored copy.
3. Record the result below, including "no change" runs.
4. Only then copy in changed files, regenerating the JSON from the mirrors in
   the same change.
5. Re-run the verification below.

## What to diff

| Area | Files | Why it matters |
|------|-------|----------------|
| H2 field changes | `../specs/cds-api/appendix-21b-h2-obligations.md` | A requirement letter flipping A↔C↔D changes what must be collected |
| Mandatory/conditional changes | same | Particularly DE 2/7, 3/39, 2/3, 8/6 |
| Procedure code changes | `declarations/procedure-71.md`, `reference/procedure-codes.json` | Codes added or withdrawn from the 71 series |
| APC changes | same | Per-code DE 1/11 lists |
| Document code changes | `reference/warehouse-types.json` | C517/C518/C519 and the DE 3/39 pairs |
| Warehouse operational rules | `operations/*.md` | The 5-day, 14-day and discrepancy rules |
| Authorisation changes | `authorisation/warehousekeeper.md` | Application requirements |
| Stock record requirements | `duty-management/system-requirements.md` | Update timing, retention, approval conditions |
| Discharge rules | `operations/discharge.md` | Duty point, FIFO, document gate |

Watch particularly for changes to the sentence that shapes the product:

> "identify goods with a tariff preference or quota or licensing restriction and
> make sure the appropriate certificate or licence is available prior to removal
> of the goods to free circulation"

## Generated files

Derived, never hand-edited:

| Generated | From |
|-----------|------|
| `reference/procedure-codes.json` | `declarations/procedure-71.md` |
| `reference/warehouse-types.json` | `declarations/procedure-71.md` + the Group 2 completion guide |
| `validation/h2-rules.json` | all mirrors in the pack |

## Verification after any update

1. All 15 handbook sections still present and non-empty.
2. The ten 71-series codes still match `reference/procedure-codes.json`.
3. DE 2/7 type set unchanged, and the S/T country restriction re-checked.
4. The four DMS approval conditions re-read for wording changes.
5. `SOURCES.md` retrieval dates updated.

---

## History

### 2026-08-23 — initial retrieval

Baseline. Nothing to diff against.

Captured:

| | Count |
|--|-------|
| HMRC handbook sections mirrored | 15 |
| Procedure 71 completion rules | 2,307 lines, all ten codes |
| H2 data elements | 46, of which 25 mandatory |
| Declaration validation rules recorded | 26 |
| Operational rules recorded | 11 |
| Reference code sets | 4 (DE 2/7, 2/3, 3/39, 2/2) |

Findings recorded at retrieval:

1. **CDS approval does not confer stock-system approval.** Approval is per
   warehouse authorisation via the supervising office, with no product
   certification scheme and no published conformance standard. See
   `duty-management/approval.md`.
2. **DE 2/7 types S and T** — the Group 2 completion guide bars them from `GB`;
   the procedure 71 page bars them from `GB` or `XI`. Procedure 71 is more
   recent and specific and is followed. Unresolved.
3. **Appendix 21B has no version or date**, so silent changes are undetectable
   except by content diff.
4. **The supplementary declaration is waived** on entry (UCC 167(2)(a)), so DE
   1/2 types Y and Z must be rejected and the CDS supplementary workflow
   actively suppressed for H2 — not merely left unused.
5. **Per-code APC lists for 7110–7178** exist in the mirror but were not
   extracted into JSON; only 7100 is structured.
