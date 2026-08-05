# Appendix 22A — B1 export / re-export standard declaration data set

| | |
|--|--|
| Source | GOV.UK export declaration category dataset collection: Appendix 22A (B1) |
| Retrieved | 2026-08-05 |
| Status | implementation mirror / engineering draft |
| Behaviour authority | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |

## 1. Scope and rule summary

This document records the engineering obligation matrix for the B1 export declaration category. The GOV.UK Appendix 22 collection is the official HMRC reference for export category data sets; this file captures the implementation contract used for the Freightcode export build.

Key rules from the current repo mirrors and category index:

- B1 is the standard export / re-export declaration category.
- `DE 1/2` must correspond to the relevant export category data set.
- Export declarations require export-specific party, goods-location, transport, and document handling.
- B1 is the foundation for later simplified export (C1) and supplementary export flows.
- The export mapper must not reuse H1 import logic without category-specific validation.

## 2. Data-set intent

B1 sits in Appendix 22 as the standard export declaration category. It is the category used for:

- standard export declarations
- re-export declarations
- export declarations with EXS/combined-set requirements where required by the export scenario

This file is intentionally focused on the fields most relevant to implementation in Freightcode.

## 3. Standard export field inventory for B1 engineering

| DE | Name | Requirement | Level | Notes |
|----|------|-------------|-------|------|
| 1/1 | Declaration type | A | Y | Required |
| 1/2 | Additional declaration type | A | Y | Required for export category selection |
| 1/6 | Goods item number | A | X | Required |
| 1/9 | Total number of items | A | Y | Required |
| 1/10 | Procedure | A | X | Required |
| 1/11 | Additional procedure | A | X | Required when applicable |
| 2/1 | Previous documents | A | X, Y | Required for prior-document linkage |
| 2/3 | Documents produced, certificates and authorisations | D | X | Export documents and authorisations |
| 2/5 | LRN | A | Y | Required |
| 2/6 | Deferred payment | D | Y | Conditional |
| 3/1 | Exporter | D | X, Y | Required when exporter is a non-GB/XI or non-EORI party |
| 3/2 | Exporter identification no | D | X, Y | Valid when EORI used |
| 3/15 | Importer | D | Y | Importer party may be required depending on route |
| 3/16 | Importer identification no | D | Y | Valid importer EORI |
| 3/17 | Declarant | C | Y | Allowed / optional |
| 3/18 | Declarant identification no | A | Y | Required |
| 3/19 | Representative | D | Y | Conditional representation |
| 3/20 | Representative identification no | D | Y | Conditional |
| 3/21 | Representative status code | D | Y | Conditional |
| 4/1 | Delivery terms | D | Y | Required when the export scenario requires a trade-term code |
| 4/8 | Calculation of taxes — method of payment | D | X | Conditional |
| 4/9 | Additions and deductions | D | X, Y | Conditional |
| 4/11 | Total amount invoiced | C | Y | Optional but common |
| 4/14 | Item price / amount | D | X | Conditional |
| 4/17 | Preference | D | X | Conditional |
| 5/8 | Country of destination code | A | X, Y | Required |
| 5/14 | Country of dispatch/export code | A | X, Y | Required |
| 5/15 | Country of origin code | D | X | Conditional |
| 5/23 | Location of goods | A | Y | Required export location |
| 5/26 | Customs office of presentation | D | Y | Conditional |
| 5/27 | Supervising customs office | D | Y | Conditional |
| 6/1 | Net mass (kg) | D | X | Conditional |
| 6/2 | Supplementary units | D | X | Conditional on commodity |
| 6/5 | Gross mass (kg) | A | X, Y | Required |
| 6/8 | Description of goods | A | X | Required |
| 6/9 | Type of packages | A | X | Required |
| 6/10 | Number of packages | A | X | Required |
| 6/11 | Shipping marks | A | X | Required |
| 6/14 | Commodity code — CN code | A | X | Required on goods-item basis |
| 6/18 | Total packages | A | Y | Required |
| 7/2 | Container | A | Y | Required |
| 7/4 | Mode of transport at the border | A | Y | Required |
| 7/9 | Identity of means of transport on arrival | D | Y | Required when applicable |
| 7/10 | Container identification number | D | X, Y | Conditional |
| 8/5 | Nature of transaction | A | X, Y | Required |
| 8/6 | Statistical value | A | X | Required |

## 4. B1-specific engineering rules

### 4.1 Export route and category

- `route = "export"`
- `declarationCategory = "B1"`
- export `TypeCode` must not be generated via the import family
- mapper selection must be category-aware

### 4.2 Parties

- `Declarant.ID` remains required.
- `Exporter` can be represented as EORI when the exporter is a GB/XI party.
- If dispatch country is not GB/XI and exporter EORI is not valid, the declaration must include the full overseas exporter address block.
- `Representative` must be included only when the declaration is not self-represented.

### 4.3 Goods location

- `DE 5/23` is required.
- Export declarations must validate location type, qualifier, and location ID using export-specific resolution logic.
- `resolveGoodsLocationForXml()` must be treated as a shared helper but is not sufficient on its own without export-specific checks.

### 4.4 Transport and border movement

- `DE 7/4` is required.
- `transportId` must be cleaned for whitespace before XML generation.
- `transportIdType` must be valid for the selected transport mode.
- `BorderTransportMeans` and `ArrivalTransportMeans` must be kept in sync.

### 4.5 Documents and licences

- export document codes must be checked against the valid set for the B1 route.
- `AdditionalDocument` and authorisation references are conditional and must only be emitted when valid.
- `forbiddenDocCodes` filtering remains mandatory before submit.

## 5. Validation gates

The B1 implementation must reject before submit when:

- export route/category is missing or inconsistent
- `transactionNatureCode` is missing
- `goodsLocation` is invalid or blank
- exporter address block is missing when required
- `mode`, `transportId`, or `transportIdType` is invalid
- `documentCode` / `reference` combinations are invalid
- `incoterms` / `incotermLocation` are incompatible

## 6. Minimum implementation checklist

Before B1 is considered ready for production work, the following must exist:

1. `declarationCategory` and export route persisted in schema
2. export UI field set created and grouped by completion guide section
3. `mapToCDS_B1` mapper implemented
4. validation rules seeded in `rule_seed.ts`
5. export fixtures created for valid and invalid scenarios
6. H1 import regression remains green

## 7. Source status note

The exact GOV.UK Appendix 22A page was not directly retrievable from the environment during this session, but the official category collection and internal repo mirrors establish the same obligation family and modelling pattern for export declarations. This file reflects the implementation contract and should be treated as the working engineering mirror until the exact Appendix 22A page is captured in the repo as a verbatim mirror.
