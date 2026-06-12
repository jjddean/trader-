# DE 3/x — Parties

| | |
|--|--|
| Source — Group 3 completion guide | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-3-parties |
| Status | partial — Group 3 paste pending |

## Obligation summary (from Appendix 21A)

| DE | Name | Symbol | Level | Note |
|----|------|--------|-------|------|
| 3/1 | Exporter | D | X, Y | [12] |
| 3/2 | Exporter identification no | D | X, Y | [12g] |
| 3/15 | Importer | D | Y | [12t] [12u] |
| 3/16 | Importer identification no | D | Y | [12a] |
| 3/17 | Declarant | C | Y | — |
| 3/18 | Declarant identification no | A | Y | — |
| 3/19 | Representative | D | Y | [12] [12b] |
| 3/20 | Representative identification no | D | Y | [12b] |
| 3/21 | Representative status code | D | Y | [12c] |
| 3/24 | Seller | D | X, Y | [12] [12d] |
| 3/25 | Seller identification no | D | X, Y | [12d] |
| 3/26 | Buyer | D | X, Y | [12] [12e] |
| 3/27 | Buyer identification no | D | X, Y | [12e] |
| 3/37 | Additional supply chain actor(s) identification no | C | X, Y | — |
| 3/39 | Holder of the authorisation identification no | D | Y | [12f] |
| 3/40 | Additional fiscal references identification no | D | X, Y | [67b] [67c] |

Reading notes [12], [12a]–[12u]: see Appendix 21 reading notes — pending paste.

## Lane (DE→GB, foreign exporter without GB/XI EORI)

| DE | Value | Status |
|----|-------|--------|
| 3/1 Exporter | Name + Address (foreign) | Group 3 conditionality pending |
| 3/2 Exporter EORI | omitted (no GB/XI EORI) | TBD |
| 3/15 Importer | GB553202734852 (or omit if 3/16 alone) | TBD |
| 3/16 Importer EORI | GB553202734852 | Trade Test Data Library — `spec/hmrc-mirror/trade-test-data-library.md` |
| 3/17 Declarant | omit (Declarant EORI in 3/18) | C — optional |
| 3/18 Declarant EORI | GB553202734852 | A — mandatory; must be **recognised** by CDS (Group 3) |
| 3/19 Representative | TBD — depends on self-rep vs broker | reading note [12b] |
| 3/21 Representative status | TBD | reading note [12c] |
| 3/24 Seller | TBD — depends on Incoterm / valuation | reading note [12d] |
| 3/26 Buyer | TBD — depends on Incoterm / valuation | reading note [12e] |

## Self-representation lane rule

Sources:

- Group 3 completion guide — https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-3-parties (retrieved 2026-05-31)
- Appendix 4A row `00500` — `spec/hmrc-mirror/appendix-4a-00500.md` (ODS retrieved 2026-05-31)

For the current lane the declarant EORI and importer EORI are both `GB553202734852` (Trade Test Data Library profile); this is self-representation. Representative (`05A`, DE 3/19–3/21) remains omitted.

Required DE 2/2 at item level (`GovernmentAgencyGoodsItem/AdditionalInformation`):

| XML element | Value | HMRC source |
|-------------|-------|-------------|
| `StatementCode` | `00500` | Appendix 4A — “Identity between declarant and importer” |
| `StatementDescription` | `Importer` | Appendix 4A — “Enter Importer” |

DMSREJ `CDS12070` on `03A/225`–`226` (FC-MPUAL5NT) = `StatementCode` without paired `StatementDescription`.

## Known errors

| Code | Pointer | Meaning |
|------|---------|---------|
| CDS12005 / R038 | 74A (`Importer/ID`, DE 3/16) | Importer EORI business rule — rule text not in Tariff Vol 3; see `errors-handled.md` |
| CDS12073 | 57A / 67A 103 / 68A 103 | Country duplicated between Exporter / ExportCountry / Origin / Buyer — Group 3 reading notes will resolve |
| CDS12005 / R123 | 57B (`Declarant/ID`, DE 3/18) | Party ID rule — TagID R123 = `Declarant/ID` (`cds_wco_references.ts`); see `errors-handled.md` **R123 investigation** |
