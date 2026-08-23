# Customs Warehousing specification pack — provenance

**Status:** ACTIVE — reference data only, no behaviour

| | |
|--|--|
| Feature | Customs Warehousing (CW) |
| CDS category | H2 |
| Primary requested procedure | 71 |
| Appendix 21B | undated on the page; part of the Appendix 21 collection |
| Procedure 71 guidance | **HMRC updated 13 August 2026** |
| Customs Warehousing handbook | **HMRC updated 30 April 2025** |
| Retrieved | 2026-08-23 |
| Retrieval method | Direct HTTPS download (`curl`), then mechanical HTML→markdown conversion |

## Licence

All GOV.UK material copied here is © Crown copyright and licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/),
as stated on each source page:

> "This publication is licensed under the terms of the Open Government Licence
> v3.0 except where otherwise stated. […] Where we have identified any third
> party copyright information you will need to obtain permission from the
> copyright holders concerned."

Mirrors are retained unmodified apart from the header block naming the source
and retrieval date.

---

## 1. Declaration layer — normative

| Source | Official URL | HMRC updated | Retrieved | Local path | Subject |
|--------|--------------|--------------|-----------|------------|---------|
| Appendix 21B — Declaration Category Data Sets H2 | https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21b-declaration-category-data-sets-h2 | not stated | 2026-08-23 | [`../specs/cds-api/appendix-21b-h2-obligations.md`](../specs/cds-api/appendix-21b-h2-obligations.md) | The H2 obligation matrix — 46 DEs, 25 mandatory |
| Appendix 1 — Requested Procedure 71 | https://www.gov.uk/government/publications/appendix-1-de-110-requested-and-previous-procedure-codes-of-the-customs-declaration-service-cds/requested-procedure-71-entry-to-a-customs-warehouse-cw | **13 Aug 2026** | 2026-08-23 | [`declarations/procedure-71.md`](declarations/procedure-71.md) | All ten 71-series codes with per-code completion rules |
| Appendix 1 — Requested Procedure 40 | https://www.gov.uk/government/publications/appendix-1-de-110-requested-and-previous-procedure-codes-of-the-customs-declaration-service-cds/requested-procedure-40-release-to-free-circulation | not captured | 2026-08-23 | recorded in [`reference/procedure-codes.json`](reference/procedure-codes.json) | `4071` removal to free circulation |
| CDS Volume 3 Imports — Group 2 | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-2-references-of-messages-document-certificates-and-authorisations | not captured | 2026-08-23 | recorded in [`reference/warehouse-types.json`](reference/warehouse-types.json) | DE 2/7 format and the full warehouse type list |

**Normative.** The Appendix 21B mirror predates this pack — it was written on
2026-08-23 in the same session and lives with the other appendix mirrors, per
the repository's existing convention that `docs/hmrc/specs/` holds HMRC data
copies.

---

## 2. Operational layer — normative

The current HMRC technical handbook, **Special procedure: customs warehousing**,
updated **30 April 2025**. All fifteen sections captured.

Base: `https://www.gov.uk/guidance/special-procedure-customs-warehousing`

| Section | Local path |
|---------|-----------|
| Introduction | [`operations/introduction.md`](operations/introduction.md) |
| Using a customs warehouse | [`operations/using-a-customs-warehouse.md`](operations/using-a-customs-warehouse.md) |
| Applying to be approved as a warehousekeeper | [`authorisation/warehousekeeper.md`](authorisation/warehousekeeper.md) |
| Receiving goods into a customs warehouse | [`operations/receiving.md`](operations/receiving.md) |
| Using simplified procedures | [`operations/simplified-procedures.md`](operations/simplified-procedures.md) |
| Discharge of the customs warehousing procedure | [`operations/discharge.md`](operations/discharge.md) |
| Removals for export or re-export | [`operations/removals-for-export.md`](operations/removals-for-export.md) |
| Usual forms of handling | [`operations/usual-forms-of-handling.md`](operations/usual-forms-of-handling.md) |
| Duty management and closing stock balance systems | [`duty-management/system-requirements.md`](duty-management/system-requirements.md) |
| Losses in warehouse | [`operations/losses.md`](operations/losses.md) |
| Co-storage | [`operations/co-storage.md`](operations/co-storage.md) |
| Common storage | [`operations/common-storage.md`](operations/common-storage.md) |
| Destruction | [`operations/destruction.md`](operations/destruction.md) |
| Temporary removals | [`operations/temporary-removals.md`](operations/temporary-removals.md) |
| Sampling and testing | [`operations/sampling-and-testing.md`](operations/sampling-and-testing.md) |

**Normative.** This is the current handbook, not the archived Special
Procedures Manual.

---

## 3. Archived / non-normative — deliberately not used

The HMRC internal manual pages `SPE15020`, `SPE15080` and `SPE15090` cover duty
management systems and appear in search results. They are **superseded** by the
handbook section at
`/guidance/special-procedure-customs-warehousing/duty-management-and-closing-stock-balance-systems`,
which carries the same material in current form.

Per the task's instruction, current guidance was used and the archived manual
pages were not copied. They are recorded here only so a later reader knows they
were considered and rejected, not missed.

---

## 4. Derived files

Generated from the mirrors above, not from any other source.

| Local path | Derived from | Contents |
|------------|--------------|----------|
| [`reference/procedure-codes.json`](reference/procedure-codes.json) | `declarations/procedure-71.md` | 10 entry codes, DE 1/1, 1/2, 2/1 rules, APCs, discharge codes |
| [`reference/warehouse-types.json`](reference/warehouse-types.json) | procedure 71 + Group 2 guide | DE 2/7 types, DE 2/3 document codes, DE 3/39 authorisation codes, DE 2/2 AI codes |
| [`validation/h2-rules.json`](validation/h2-rules.json) | all of the above | 26 declaration rules + 11 operational rules, each with source and FreightCode field |
| [`duty-management/approval.md`](duty-management/approval.md) | handbook DMS + warehousekeeper sections | The approval question, answered |

---

## 5. Reference data FreightCode already holds

Not duplicated here. The implementation should read these rather than create a
second source:

| Data | Existing location |
|------|-------------------|
| Country codes | `src/lib/data/countries.ts` |
| Goods location codes (Appendix 16C) | `src/lib/generated/appendix-16c-codes.ts` |
| CDS code lists, seeded | `cds_code_lists` table, `convex/cds_codes.ts` |
| WCO element paths | `convex/lib/cds_wco_references.ts` |
| CDS error codes | `src/lib/cds_error_codes.ts` |
| Package types, document types, additional information | `docs/hmrc/ens/reference/` — captured for ENS, same HMRC code lists |

Appendix 4 (AI statements), Appendix 5 (document codes), Appendix 6
(authorisation type codes) and Appendix 17 (supervising office codes) are
referenced by procedure 71 but **not** copied in full — only the H2-relevant
entries are recorded in `reference/warehouse-types.json`. Capturing them
wholesale is a separate job if H2 needs full code-list validation.

---

## 6. Not obtained

| Item | Reason |
|------|--------|
| Appendix 21B publication date | The page carries no version or last-updated stamp. Only the retrieval date can be recorded. |
| Per-code APC lists for 7110–7178 | Present in the `procedure-71.md` mirror but not extracted into JSON. Only 7100's list is structured. |
| Appendices 4, 5, 6, 17 in full | See above. |
| A DMS conformance standard | HMRC publishes criteria in prose and defers to the supervising office. No technical standard exists to build against. |

---

## 7. Rules for future updates

1. Never edit a mirror by hand. Re-download it.
2. Regenerate the JSON only from the mirrors in this pack.
3. Record every re-retrieval in [`CHANGELOG_TRACKING.md`](CHANGELOG_TRACKING.md).
4. HMRC (gov.uk) overrides every other source, consistent with
   [`../specs/README.md`](../specs/README.md) §"Source policy".
