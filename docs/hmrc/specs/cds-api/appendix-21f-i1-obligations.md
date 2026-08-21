# Appendix 21F — I1 C&F simplified import declaration data set

| | |
|--|--|
| Source | https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21f-declaration-category-data-sets-i1-cf |
| Retrieved | 2026-08-05 (obligation matrix re-verified against source 2026-08-21) |
| Status | implementation mirror (official page retrieved in-session; obligation matrix captured for engineering use) |
| Behaviour authority | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |

## 1. Scope and rule summary

This is the obligation matrix for the I1 C&F simplified import declaration category. It is the engineering source for the reduced-form import path and is not a replacement for the official GOV.UK page.

Key conditions from the published page:

- I1 C&F is the simplified import declaration with regular use.
- `DE 1/2` is the import simplified category code set (`C + F`).
- The simplified declaration must not be used when the selected procedure requires a full H1 declaration; the procedure-code completion notes and Appendix 1 rules override the reduced form.
- `DE 2/3` is mandatory at item level for the simplified declaration.
- `DE 5/23` remains required as the goods location.
- `DE 7/4` (mode of transport at the border) remains required.
- `DE 8/2` / `DE 8/3` guarantee fields remain relevant when the scenario requires a guarantee.

## 2. Symbols

| Symbol | Meaning |
|--------|---------|
| A | Mandatory |
| C | Optional for economic operators |
| D | Conditional / dependent on process |
| X | Item level |
| Y | Header level |

## 3. Core I1 obligation matrix

| DE | Name | Symbol | Level | Notes |
|----|------|--------|-------|------|
| 1/1 | Declaration type | A | Y | Required for all declarations |
| 1/2 | Additional declaration type | A | Y | Required for I1 C&F |
| 1/6 | Goods item number | A | X | Required item count |
| 1/8 | Signature / authentication | D | Y | Only when a paper declaration is used |
| 1/9 | Total number of items | C | Y | Optional for economic operators |
| 1/10 | Procedure | A | X | Procedure code required |
| 1/11 | Additional procedure | A | X | Additional procedure code required |
| 2/1 | Previous documents | A | X, Y | Must reference prior docs when applicable |
| 2/2 | Additional information | D | X, Y | Conditional |
| 2/3 | Documents produced, certificates and authorisations | A | X | Critical for SDP / simplified import |
| 2/4 | Reference number / UCR | C | X, Y | Optional |
| 2/5 | LRN | A | Y | Required |
| 2/6 | Deferred payment | D | Y | Conditional on deferment |
| 2/7 | Identification of warehouse | D | Y | Conditional |
| 3/1 | Exporter | D | X, Y | Conditional |
| 3/2 | Exporter identification no | D | X, Y | Conditional |
| 3/15 | Importer | D | Y | Conditional |
| 3/16 | Importer identification no | D | Y | Required for importer identification |
| 3/17 | Declarant | C | Y | Optional but allowed |
| 3/18 | Declarant identification no | A | Y | Required |
| 3/19 | Representative | D | Y | Conditional |
| 3/20 | Representative identification no | D | Y | Conditional |
| 3/21 | Representative status code | D | Y | Conditional |
| 3/37 | Additional supply chain actor(s) identification no | C | X, Y | Optional |
| 3/39 | Holder of authorisation identification no | A | Y | Required for authorisation scenario |
| 4/1 | Delivery terms | D | Y | Conditional |
| 4/3 | Calculation of taxes — tax type | D | X | Conditional |
| 4/4 | Calculation of taxes — tax base | D | X | Conditional |
| 4/8 | Calculation of taxes — method of payment | D | X | Conditional |
| 4/9 | Additions and deductions | D | X, Y | Conditional |
| 4/11 | Total amount invoiced | C | Y | Optional |
| 4/14 | Item price / amount | D | X | Conditional |
| 4/16 | Valuation method | D | X | Conditional |
| 4/17 | Preference | D | X | Conditional |
| 5/8 | Country of destination code | D | X, Y | Conditional |
| 5/14 | Country of dispatch/export code | D | X, Y | Conditional |
| 5/15 | Country of origin code | D | X | Conditional |
| 5/16 | Country of preferential origin code | D | X | Conditional |
| 5/21 | Place of loading | D | Y | Conditional |
| 5/23 | Location of goods | A | Y | Required |
| 5/26 | Customs office of presentation | D | Y | Conditional |
| 5/27 | Supervising customs office | D | Y | Conditional |
| 6/1 | Net mass (kg) | D | X | Conditional |
| 6/2 | Supplementary units | D | X | Conditional on commodity requirements |
| 6/5 | Gross mass (kg) | A | X, Y | Required |
| 6/8 | Description of goods | A | X | Required |
| 6/9 | Type of packages | A | X | Required |
| 6/10 | Number of packages | A | X | Required |
| 6/11 | Shipping marks | A | X | Required |
| 6/13 | CUS code | D | X | Conditional |
| 6/14 | Commodity code — CN code | D | X | Conditional |
| 6/15 | Commodity code — TARIC code | D | X | Conditional |
| 6/16 | Commodity code — TARIC additional code(s) | D | X | Conditional |
| 6/17 | Commodity code — national additional code(s) | D | X | Conditional |
| 6/18 | Total packages | A | Y | Required |
| 7/2 | Container | A | Y | Required |
| 7/4 | Mode of transport at the border | A | Y | Required |
| 7/10 | Container identification number | D | X, Y | Conditional |
| 8/1 | Quota order number | D | X | Conditional |
| 8/2 | Guarantee type | D | Y | Conditional |
| 8/3 | Guarantee reference | D | Y | Conditional |

## 4. Engineering interpretation for Freightcode

These are the most important implementation rules for the current app:

- `declarationCategory` must be set to `I1` for simplified import category selection.
- `route` must be `import`.
- `DE 1/2` is category-specific; for regular I1 it is `C+F`.
- `DE 5/23` remains mandatory and must be resolved by the existing goods-location logic.
- `DE 7/4` remains mandatory for the border transport block.
- `DE 2/3` must remain valid for item-level document handling; reduced-form import does not mean document-less import.
- Procedure-code guard is mandatory: the app must reject I1 if the selected CPC requires H1.

## 4a. Build state (2026-08-22)

| Item | State |
|------|-------|
| `declarationCategory = "I1"` in schema | done — `convex/schema.ts` |
| `mapToCDS_I1` | done — `src/lib/i1-mapper.ts` |
| I1 renderer, XSD-ordered | done — `src/lib/i1-xml-renderer.ts` |
| Category dispatch on the submit route | done — `src/app/api/hmrc/submit/route.ts` |
| Mandatory-element gate | done — `validateI1Declaration()` / `validateI1SubmitGate()`; **not** yet in `rule_seed.ts` |
| Fixtures | done — `tests/i1/`, run by `npm run test:i1` |
| Procedure-code guard (CPC requiring H1) | **not started** — DE 1/2 is guarded to C/F, but the CPC-level check in §4 is not implemented |
| I1 UI field set | **not started** |

## 5. Implementation gate

Before I1 is accepted for production use, the mapping and validation rules must be checked against:

- `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`
- `docs/hmrc/specs/cds-api/declaration-categories-index.md`
- the official GOV.UK Appendix 21F page
- the procedure-code completion notes for the selected CPC

This is the current engineering matrix for the simplified import category.
