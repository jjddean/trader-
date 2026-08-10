# HMRC official mirrors (data only)

**Behaviour is defined in `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` only.** This directory holds verbatim HMRC source copies.

---

## Version

| | |
|--|--|
| Catalogue version | 0.2.0 |
| Updated | 2026-06-08 |
| Active environment | TDR — see `docs/hmrc/ACTIVE/tdr/environment-matrix.md` |
| Archived environment | Trade Test v2.0 — `docs/hmrc/ARCHIVE/trade-test/` |

---

## Source policy

1. **HMRC** (gov.uk) overrides every other source.
2. **WCO Data Model 3.6** is reference for XML element meaning only — never for HMRC-valid combinations.
3. **DMSREJ** is negative evidence only — proves a structure failed; does not prove an alternative is valid.
4. **In-repo paraphrased docs** are unofficial:
   - `convex/lib/cds_h1_data_elements.ts` — extracted obligation flags only
   - `convex/lib/cds_wco_references.ts` — WCO meaning only
   - `src/lib/cds_error_codes.ts` — paraphrased
   - `test-evidence/archive-pre-p0/*.xml` — no acceptance proof
5. **Mapper changes require** a cited HMRC URL + DE number + retrieval date + verbatim rule text.

---

## Authoritative HMRC URLs

### Navigation
- Imports — https://www.gov.uk/guidance/navigate-the-uk-trade-tariff-cds-volume-3-for-imports
- Exports — https://www.gov.uk/guidance/navigate-the-uk-trade-tariff-cds-volume-3-for-exports
- Step-by-step manual — https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide

### Completion guide groups (Volume 3 Imports)
- Group 1 — message info, procedure codes — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-1-message-information-including-procedure-codes
- Group 2 — references of messages, documents — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-2-references-of-messages-documents-certificates-and-authorisations
- Group 3 — parties — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-3-parties
- Group 4 — valuation, taxes — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-4-valuation-information-and-taxes
- Group 5 — places, countries — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-5-dates-times-periods-places-countries-and-regions
- Group 6 — goods identification — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-6-goods-identification
- Group 7 — transport — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-7-transport-information-modes-means-and-equipment
- Group 8 — other data elements — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-8-other-data-elements

### Appendices (correct URLs verified 2026-05-27)
- Appendix 1 — DE 1/10 procedure codes — https://www.gov.uk/government/publications/appendix-1-de-110-requested-and-previous-procedure-codes
- Appendix 2 — DE 1/11 additional procedure codes — https://www.gov.uk/government/publications/appendix-2-de-111-additional-procedure-codes
- Appendix 3 — DE 2/1 previous documents — https://www.gov.uk/government/publications/appendix-3-de-21-previous-document-codes
- Appendix 4 — DE 2/2 additional information — https://www.gov.uk/government/publications/appendix-4-de-22-additional-information-ai-statement-codes
- Appendix 5A (Union) — DE 2/3 document codes — https://www.gov.uk/government/publications/data-element-23-documents-and-other-reference-codes-union-of-the-customs-declaration-service-cds
- Appendix 5A (National) — DE 2/3 national document codes — https://www.gov.uk/guidance/data-element-23-documents-and-other-reference-codes-national-of-the-customs-declaration-service-cds
- Appendix 5B — DE 2/3 document status codes
- Appendix 13 — country codes
- Appendix 16 collection — DE 5/23 goods location — https://www.gov.uk/government/collections/goods-location-codes-for-data-element-523-of-the-customs-declaration-service
- Appendix 16C — maritime ports — https://www.gov.uk/government/publications/maritime-ports-and-wharves-location-codes-for-data-element-523-of-the-customs-declaration-service
- Appendix 16I — GB place names & UN/LOCODE — https://www.gov.uk/government/publications/gb-place-names-and-unlocode-codes-for-data-element-523-of-the-customs-declaration-service
- Appendix 16J — other locations — https://www.gov.uk/government/publications/other-location-codes-for-data-element-523-of-the-customs-declaration-service
- Appendix 16S — GVMS — https://www.gov.uk/government/publications/goods-vehicle-movement-service-codes-for-data-element-523-of-the-customs-declaration-service
- Appendix 21A — H1 data set — https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21a-declaration-category-data-sets-h1
- Appendix 21F/G — I1 simplified import — https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets (index → 21F, 21G)
- Appendix 22 — Export declaration category data sets — https://www.gov.uk/government/publications/appendix-22-export-declaration-category-data-sets
- Appendix 21 — reading notes — https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21-introduction-to-declaration-category-data-sets

### Code list downloads (CSV)
- https://www.uktradeinfo.com/help-and-support/customs-declaration-service-codes — Appendix 16 A–L as CSV
- Appendix 16C maritime ports CSV — 10.7 KB

### HMRC API guides (transport / submission layer)
- End-to-end service guide repo — https://github.com/hmrc/customs-declarations-end-to-end-service-guide

### WCO (reference only)
- WCO Data Model 3.6 — https://mag.wcoomd.org/magazine/wco-news-90/wco-data-model-version-3-9/

---

## File index

| File | Status | Source |
|------|--------|--------|
| `lane.md` | draft | repo lane data |
| `appendix-21a-h1-obligations.md` | verbatim | Appendix 21A |
| `appendix-21f-i1-obligations.md` | implementation mirror | Appendix 21F I1 C&F |
| `appendix-22a-b1-obligations.md` | implementation mirror | Appendix 22A B1 |
| `appendix-22d-c1-obligations.md` | implementation mirror | Appendix 22D C1 C&F |
| `declaration-categories-index.md` | verbatim excerpts | CDSSG04130/06030 + import/export general notes |
| `de-1-10-procedures.md` | placeholder | Appendix 1 — to fetch |
| `de-2-3-documents.md` | partial | Appendix 5A landing — rows pending |
| `hmrc-mirror/appendix-4a-00500.md` | verbatim | DE 2/2 self-representation AI `00500` |
| `de-3-x-parties.md` | placeholder | Group 3 — to fetch |
| `de-4-x-valuation.md` | placeholder | Group 4 + Appendix 21A — to fetch |
| `de-5-23-goods-location.md` | partial (XML inference documented) | Group 5 + Appendix 16C ODS + DMSREJ/XSD |
| `de-7-x-transport.md` | full | Group 7 |
| `errors-handled.md` | tracking | DMSREJ corpus |
| `passing-payload.xml` | **frozen 2026-06-03** | DMSACC baseline (FC-MPYAJ7RN) |
| `hmrc-mirror/` | verbatim mirror dir | gov.uk pages |

---

## Mapper change protocol

For any mapper / renderer change:

1. Cite spec file section.
2. Spec file section must cite HMRC URL + retrieval date.
3. If no HMRC evidence exists → STOP. Do not alter XML.
4. DMSREJ alone is not sufficient justification.
