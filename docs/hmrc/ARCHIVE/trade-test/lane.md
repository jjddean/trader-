# Active Lane — **passing configuration** (DMSACC 2026-06-03)

| Field | Value | Source |
|-------|-------|--------|
| Declaration category | H1 | Appendix 21A |
| Declaration type (DE 1/1) | IM | Group 1 |
| Additional declaration type (DE 1/2) | A (standard frontier, goods arrived) | Group 1 — TBD verify |
| Procedure (DE 1/10) | 4000 | Appendix 1 — release for free circulation |
| Additional procedure (DE 1/11) | 000 | Appendix 2 — none |
| Commodity (DE 6/14) | 8471300000 | UK Integrated Online Tariff |
| Description | Portable automatic data processing machine, weight not exceeding 10kg | n/a |
| Dispatch country (DE 5/14) | DE | Appendix 13 |
| Destination country (DE 5/8) | GB | Appendix 13 |
| Origin country (DE 5/15) | DE | Appendix 13 |
| Goods location (DE 5/23) | **GBAUFXTFXTFXT** — Felixstowe Dock & Railway Company T/A Port of Felixstowe | Appendix 16C ODS 2026-05-18, column 3 (see `hmrc-mirror/appendix-16c-felixstowe.md`) |
| Customs office of presentation (DE 5/26) | GBLON004 | Appendix 14 — UK COL |
| Transport mode at border (DE 7/4) | 1 (Maritime) | Group 7 |
| Transport identity type (DE 7/9) | 11 (Name of sea-going vessel) | Group 7 |
| Transport identity number (DE 7/9) | CSCL GLOBE | trader input |
| Container (DE 7/2) | 0 (not containerised — TBD verify) | Group 7 |
| Incoterms (DE 4/1) | CIF + location GBFELIXSTOWE (or GB-prefixed UN/LOCODE) | Group 4 — both components mandatory for method 1 |
| Invoice currency (DE 4/10) | GBP | Appendix 11 |
| Invoice total (DE 4/11) | 5000.00 GBP | trader input |
| Supplementary units (DE 6/2) | **10** + unit **NAR** (p/st) | UK tariff 8471300000 — cleared CDS40011 on FC-MPYAJ7RN |
| Declarant EORI (DE 3/18) | GB553202734852 | TDL-listed; OAuth Romwan (`GB531765313922`) |
| Importer EORI (DE 3/16) | GB553202734852 | same |
| Passing LRN / MRN | FC-MPYAJ7RN / 26GB63M1I0RQFCVAR4 | DMSACC — baseline XML `spec/passing-payload.xml` |
| Exporter (DE 3/1) | foreign — Name + Address (no GB/XI EORI) | Group 3 — pending verification |

## Documents claimed for this lane

| Code | Type | Status | Notes |
|------|------|--------|-------|
| N935 | Commercial invoice | AC | Verified on DMSACC FC-MPYAJ7RN |
| N271 | Packing list | AC | Verified on DMSACC FC-MPYAJ7RN |

## Acceptance notes

- **DMSACC** 2026-06-03 — **0** CDS validation errors; MRN issued.
- **Advisory:** CDS13000 (value per kilo credibility) — non-blocking; tune gross/net vs £5000 on next submit if desired.
- **Follow-on:** DMSTAX ×2 (NameCode 67, 4); **DMSCLE** not on this MRN — handler + pull UI ready (`test-evidence/passing/notification-audit-FC-MPYAJ7RN.md`).
- **Regression baseline:** `spec/passing-payload.xml`, `test-evidence/passing/`.

## Outstanding lane verification

| Item | Open question |
|------|---------------|
| ~~GBAUFXTFXTGW~~ | **RESOLVED 2026-05-27**: code `GBAUFXTFXTGW` is NOT in Appendix 16C ODS (2026-05-18). The correct code for Felixstowe is `GBAUFXTFXTFXT`. All prior submissions using `GBAUFXTFXTGW` were submitting an invalid Appendix 16C code. Source: `hmrc-mirror/appendix-16c-felixstowe.md`. |
| Additional declaration type | A vs Y/Z — depends on supplementary vs frontier arrival |
| Document set for HS 8471300000 + CPC 4000 | Whether N935 alone suffices, or whether Y codes are needed for export controls (dual use, encryption) |
| DE 3/1 Exporter rule | Confirm Name+Address mandatory format for foreign exporter from Group 3 |
