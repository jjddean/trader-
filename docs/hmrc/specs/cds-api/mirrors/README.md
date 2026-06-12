# HMRC Verbatim Mirror

Raw HMRC source copies. Do not paraphrase. Do not edit. Re-fetch on demand.

| File | Source URL | Retrieved | Format |
|------|-----------|-----------|--------|
| `appendix-16c-maritime.ods` | https://assets.publishing.service.gov.uk/media/6a0adb99279ebb7d24f8f388/20260514_CDS_DE_5-23_Appendix16C_MaritimePortsandWharves.ods | 2026-05-27 | binary ODS (last published 2026-05-18) |
| `appendix-16c-maritime.psv` | derived from ODS | 2026-05-27 | pipe-separated values |
| `appendix-16c-page.md` | https://www.gov.uk/government/publications/maritime-ports-and-wharves-location-codes-for-data-element-523-of-the-customs-declaration-service | 2026-05-27 | gov.uk page text |
| `appendix-16c-felixstowe.md` | derived from ODS row | 2026-05-27 | text |
| `appendix-21a-h1-page.md` | https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21a-declaration-category-data-sets-h1 | 2026-05-27 | gov.uk page text |
| `appendix-5a-union-landing.md` | https://www.gov.uk/government/publications/data-element-23-documents-and-other-reference-codes-union-of-the-customs-declaration-service-cds | 2026-05-27 | gov.uk page text (landing — ODS not yet downloaded) |
| `cdssg13070.md` | https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide/cdssg13070 | 2026-05-27 | gov.uk page text |
| `group-5-completion-guide.md` | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-5-dates-times-periods-places-countries-and-regions | 2026-05-27 | gov.uk page text |
| `group-7-completion-guide.md` | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-7-transport-information-modes-means-and-equipment | 2026-05-27 | gov.uk page text |
| `imports-navigation.md` | https://www.gov.uk/guidance/navigate-the-uk-trade-tariff-cds-volume-3-for-imports | 2026-05-27 | gov.uk page text |
| `appendix-4a-union.ods` | https://assets.publishing.service.gov.uk/media/68e7b0381c8b2a3b506907ca/20251003_CDS_DE_2-2_Appendix4A_Union.ods | 2026-05-31 | binary ODS |
| `appendix-4a-00500.md` | derived from 4A ODS row | 2026-05-31 | text (code `00500`) |
| `appendix-4b-national.ods` | https://assets.publishing.service.gov.uk/media/69ea3179d36883a64473b8fb/20260429_CDS_DE_2-2_Appendix4B_NationalCodes.ods | 2026-05-31 | binary ODS |
| `appendix-4b-national.ods.meta.md` | derived | 2026-05-31 | index note (numeric AI codes are in 4A) |

## Pending downloads

- Appendix 5A Union ODS (document codes list) — landing page only so far
- Appendix 5A National ODS
- Appendix 5B status codes
- Appendix 1 (DE 1/10 procedure code 4000 row)
- Appendix 2 (DE 1/11 additional procedure code 000 row)
- DE 1/10 → 1/11 correlation matrix
- Group 1, Group 2, Group 3, Group 4, Group 6, Group 8 completion guides
- Appendix 13 country codes
- Appendix 14 UK COL codes (for DE 5/26)

## Update protocol

When re-fetching:

1. Replace the file verbatim.
2. Update the "Retrieved" date here.
3. Diff against the previous version — note any rule change in the corresponding `docs/hmrc/ACTIVE/tdr/mapping/de-*.md` file.
4. Never edit a mirror file by hand.
