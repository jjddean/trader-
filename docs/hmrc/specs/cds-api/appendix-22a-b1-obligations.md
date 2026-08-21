# Appendix 22A — B1 export / re-export standard declaration data set

| | |
|--|--|
| Source | https://www.gov.uk/government/publications/appendix-22-declaration-category-data-sets-landing-page-and-introductory-text--2/appendix-22a-declaration-category-data-set-b1 |
| Retrieved | 2026-08-21 |
| Status | implementation mirror (obligation table transcribed from the official page) |
| Behaviour authority | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |

## 1. Scope and rule summary

Obligation matrix for the B1 standard export / re-export declaration category. Section 3 is transcribed from the GOV.UK page named above; sections 4–6 are Freightcode engineering rules layered on top and are **not** HMRC text.

- B1 is the standard export / re-export declaration category, including EXS where the scenario requires it.
- `DE 1/2` must carry an additional declaration type valid for the standard export data set.
- `DE 4/10` invoice currency is not a separate data element — a currency must accompany every monetary amount.
- The procedure-code completion notes and Appendix 1 rules override this table where they conflict.

## 2. Symbols

| Symbol | Meaning |
|--------|---------|
| A | Mandatory — required by every Member State, or mandated by the UK as always required |
| C | Optional for economic operators |
| D | Dependent on the declaration scenario (procedure code, authorisations, and so on) |
| X | Required at item level |
| Y | Required at header level |

## 3. B1 obligation matrix

| DE | Name | Requirement | Level |
|----|------|-------------|-------|
| 1/1 | Declaration type | A | Y |
| 1/2 | Additional Declaration type | A | Y |
| 1/6 | Goods item number | A | X |
| 1/7 | Specific circumstance indicator | D | Y |
| 1/8 | Signature/Authentication | D | Y |
| 1/9 | Total number of items | C | Y |
| 1/10 | Procedure | A | X |
| 1/11 | Additional Procedure | A | X |
| 2/1 | Simplified declaration/Previous documents | A | X, Y |
| 2/2 | Additional information | D | X, Y |
| 2/3 | Documents produced, certificates and authorisations, additional references | D | X |
| 2/4 | Reference number/UCR | C | X, Y |
| 2/5 | LRN | A | Y |
| 2/7 | Identification of warehouse | D | Y |
| 3/1 | Exporter | D | Y |
| 3/2 | Exporter identification no | D | Y |
| 3/9 | Consignee | D | X, Y |
| 3/10 | Consignee identification no | D | X, Y |
| 3/17 | Declarant | C | Y |
| 3/18 | Declarant identification no | A | Y |
| 3/19 | Representative | D | Y |
| 3/20 | Representative identification no | D | Y |
| 3/21 | Representative status code | D | Y |
| 3/31 | Carrier | D | Y |
| 3/32 | Carrier identification no | D | Y |
| 3/37 | Additional supply chain actor(s) identification no | C | X, Y |
| 3/39 | Holder of the authorisation identification no | D | Y |
| 3/40 | Additional fiscal references identification no | D | X, Y |
| 4/2 | Transport charges method of payment | D | X, Y |
| 4/11 | Total amount invoiced | D | Y |
| 4/15 | Exchange rate | D | Y |
| 5/8 | Country of destination code | A | X, Y |
| 5/12 | Customs office of exit | A | Y |
| 5/14 | Country of dispatch/export code | D | Y |
| 5/15 | Country of origin code | D | X |
| 5/18 | Countries of routing codes | D | Y |
| 5/23 | Location of goods | A | Y |
| 5/26 | Customs office of presentation | D | Y |
| 5/27 | Supervising customs office | D | Y |
| 6/1 | Net mass (kg) | A | X |
| 6/2 | Supplementary units | D | X |
| 6/5 | Gross mass (kg) | A | X, Y |
| 6/8 | Description of goods | A | X |
| 6/9 | Type of packages | D | X |
| 6/10 | Number of packages | A | X |
| 6/11 | Shipping marks | D | X |
| 6/12 | UN Dangerous Goods code | D | X |
| 6/13 | CUS code | D | X |
| 6/14 | Commodity code — Combined Nomenclature code | A | X |
| 6/16 | Commodity code — TARIC additional code(s) | D | X |
| 6/17 | Commodity code — National additional code(s) | D | X |
| 6/18 | Total packages | A | Y |
| 7/2 | Container | D | Y |
| 7/4 | Mode of transport at the border | A | Y |
| 7/5 | Inland mode of transport | D | Y |
| 7/7 | Identity of means of transport at departure | D | Y |
| 7/10 | Container identification number | D | X, Y |
| 7/14 | Identity of active means of transport crossing the border | D | Y |
| 7/15 | Nationality of active means of transport crossing the border | D | Y |
| 7/18 | Seal number | D | Y |
| 8/2 | Guarantee type | D | Y |
| 8/3 | Guarantee reference | D | Y |
| 8/5 | Nature of transaction | A | X, Y |
| 8/6 | Statistical value | D | X |

64 rows.

## 4. B1-specific engineering rules

> Freightcode implementation notes. Not HMRC text.

### 4.1 Export route and category

- `route = "export"`
- `declarationCategory = "B1"`
- export `TypeCode` must not be generated via the import family
- mapper selection must be category-aware
- import-only data elements must never be emitted on a B1: there is no `DE 3/15`/`3/16` importer, no `DE 4/17` preference, no `DE 4/1` delivery terms, no `DE 2/6` deferred payment, no `DE 4/8`/`4/9`/`4/14` valuation block

### 4.2 Parties

- `Declarant.ID` (`DE 3/18`) is mandatory.
- `Exporter` (`DE 3/1`/`3/2`) is header level only on B1 — do not emit it at item level.
- If dispatch country is not GB/XI and exporter EORI is not valid, the declaration must include the full overseas exporter address block.
- The receiving party on an export is `Consignee` (`DE 3/9`/`3/10`), not an importer.
- `Representative` must be included only when the declaration is not self-represented.
- `Carrier` (`DE 3/31`/`3/32`) is scenario-dependent and must be supported.

### 4.3 Goods location and exit

- `DE 5/23` is mandatory.
- `DE 5/12` customs office of exit is **mandatory** and has no import equivalent — it needs its own field, validation and code list.
- Export declarations must validate location type, qualifier, and location ID using export-specific resolution logic.
- `resolveGoodsLocationForXml()` may be reused as a shared helper but is not sufficient without export-specific checks.

### 4.4 Transport and border movement

- `DE 7/4` is mandatory.
- Export identifies the means of transport **at departure** (`DE 7/7`), not on arrival — do not map `ArrivalTransportMeans` on a B1.
- `DE 7/14`/`7/15` cover the active means crossing the border and are scenario-dependent.
- `transportId` must be cleaned for whitespace before XML generation.
- `transportIdType` must be valid for the selected transport mode.

### 4.5 Documents and licences

- export document codes must be checked against the valid set for the B1 route.
- `AdditionalDocument` and authorisation references are conditional and must only be emitted when valid.
- `forbiddenDocCodes` filtering remains mandatory before submit.

## 5. Validation gates

The B1 implementation must reject before submit when:

- export route/category is missing or inconsistent
- `DE 8/5` transaction nature code is missing
- `DE 5/12` customs office of exit is missing or not a valid office code
- `DE 6/1` net mass is missing at item level
- `goodsLocation` (`DE 5/23`) is invalid or blank
- exporter address block is missing when required
- `mode`, `transportId`, or `transportIdType` is invalid
- `documentCode` / `reference` combinations are invalid
- any import-only data element is present on the payload

## 6. Minimum implementation checklist

Before B1 is considered ready for production work, the following must exist:

| # | Item | State |
|---|------|-------|
| 1 | `declarationCategory` and export fields persisted in schema | done — `convex/schema.ts` |
| 2 | export UI field set grouped by completion guide section | **not started** |
| 3 | `mapToCDS_B1` mapper implemented | done — `src/lib/b1-mapper.ts` |
| 4 | B1 renderer with XSD-ordered output | done — `src/lib/b1-xml-renderer.ts` |
| 5 | category dispatch on the submit route | done — `src/app/api/hmrc/submit/route.ts` |
| 6 | mandatory-element validation | done — `validateB1Declaration()`; **not** yet expressed as `rule_seed.ts` rules |
| 7 | export fixtures for valid and invalid scenarios | done — `tests/b1/`, run by `npm run test:b1` |
| 8 | H1 import regression remains green | done — 125/125 |

Outstanding before a live B1 submission: the export UI (2), rule-engine
coverage (6), and a CDS-validated round trip — nothing here has been sent to
HMRC.

## 7. Source status note

Section 3 was transcribed from the official GOV.UK Appendix 22A page on 2026-08-21. It replaces an earlier engineering draft whose rows had been derived from the I1 import data set and were wrong in both directions — mandatory elements missing (`DE 5/12`, and `DE 6/1` marked conditional) and import-only elements present. Verify against the source page before relying on it for a submission build.
