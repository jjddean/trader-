# Appendix 22D — C1 C&F simplified export declaration data set

| | |
|--|--|
| Source | https://www.gov.uk/government/publications/appendix-22-declaration-category-data-sets-landing-page-and-introductory-text--2/appendix-22d-declaration-category-data-set-c1-cf |
| Retrieved | 2026-08-21 |
| Status | implementation mirror (obligation table transcribed from the official page) |
| Behaviour authority | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |

## 1. Scope and rule summary

Obligation matrix for the C1 C&F simplified export / re-export declaration category (regular use). Section 3 is transcribed from the GOV.UK page named above; sections 4–6 are Freightcode engineering rules and are **not** HMRC text.

- C1 C&F is the export or re-export simplified declaration for regular use.
- Where `DE 1/2` is `C`, `F`, `Y` or `Z`, authorisation to use SDP or EIDR must be held. `DE 3/39` holder of the authorisation is mandatory on this category.
- The Pre-Shipment Advice used under SDP is the UCC simplified declaration regular use (`DE 1/2` codes C and F).
- `DE 4/10` invoice currency is not a separate data element — a currency must accompany every monetary amount.
- If the scenario requires a full B1 declaration, the app must not silently downgrade to the simplified form.

## 2. Symbols

| Symbol | Meaning |
|--------|---------|
| A | Mandatory — required by every Member State, or mandated by the UK as always required |
| C | Optional for economic operators |
| D | Dependent on the declaration scenario (procedure code, authorisations, and so on) |
| X | Required at item level |
| Y | Required at header level |

## 3. C1 C&F obligation matrix

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
| 2/3 | Documents produced, certificates and authorisations, additional references | A | X |
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
| 3/39 | Holder of the authorisation identification no | A | Y |
| 3/40 | Additional fiscal references identification no | D | X, Y |
| 4/2 | Transport charges method of payment | D | X, Y |
| 5/8 | Country of destination code | A | X, Y |
| 5/12 | Customs office of exit | A | Y |
| 5/15 | Country of origin code | D | X |
| 5/18 | Countries of routing codes | D | Y |
| 5/23 | Location of goods | A | Y |
| 5/26 | Customs office of presentation | D | Y |
| 5/27 | Supervising customs office | D | Y |
| 6/1 | Net mass (kg) | D | X |
| 6/2 | Supplementary units | D | X |
| 6/8 | Description of goods | A | X |
| 6/9 | Type of packages | A | X |
| 6/10 | Number of packages | A | X |
| 6/11 | Shipping marks | A | X |
| 6/12 | UN Dangerous Goods code | D | X |
| 6/13 | CUS code | C | X |
| 6/14 | Commodity code — Combined Nomenclature code | D | X |
| 6/16 | Commodity code — TARIC additional code(s) | D | X |
| 6/17 | Commodity code — National additional code(s) | D | X |
| 7/2 | Container | A | Y |
| 7/4 | Mode of transport at the border | A | Y |
| 7/10 | Container identification number | D | X, Y |
| 7/18 | Seal number | D | Y |
| 8/2 | Guarantee type | D | Y |
| 8/3 | Guarantee reference | D | Y |

53 rows.

## 4. C1 engineering interpretation

> Freightcode implementation notes. Not HMRC text.

### 4.1 Reduced form

C1 must not be treated as "B1 with fields hidden." It is a reduced export declaration with a different declaration class and a smaller valid field set.

The app must enforce:

- `route = "export"`
- `declarationCategory = "C1"`
- category-specific `TypeCode` / declaration-type logic
- reduced document sets only where valid under Appendix 22D

Elements that exist on B1 but **not** on C1, and must not be emitted: `DE 4/11` total amount invoiced, `DE 4/15` exchange rate, `DE 5/14` country of dispatch/export, `DE 6/5` gross mass, `DE 6/18` total packages, `DE 7/5`, `DE 7/7`, `DE 7/14`, `DE 7/15`, `DE 8/5` nature of transaction, `DE 8/6` statistical value.

### 4.2 Field handling

The reduced form still requires:

- valid destination country (`DE 5/8`) — note there is no dispatch-country element on C1
- customs office of exit (`DE 5/12`) — mandatory
- valid export goods location (`DE 5/23`)
- transport mode at the border (`DE 7/4`) and container indicator (`DE 7/2`), both mandatory
- item-level description, package type, package count and shipping marks (`DE 6/8`, `6/9`, `6/10`, `6/11`), all mandatory
- documents, certificates and authorisations (`DE 2/3`) — mandatory on C1, unlike B1 where it is conditional
- holder of the authorisation (`DE 3/39`) — mandatory, this is the SDP/EIDR authorisation and is the basis of the simplified declaration
- valid exporter block logic

### 4.3 Supplementary export flow

The C1 category is not the end state of export implementation. The accepted C1 declaration is a prerequisite for the supplementary export flow:

- create supplementary export after accepted C1
- preserve prior-document linkage (`DE 2/1`) to the accepted C1 MRN
- keep the supplementary declaration on the category Appendix 22 requires for the scenario
- omit repeated EXS/combined elements only when the export category rules permit omission

## 5. Validation gates

Before `mapToCDS_C1` is accepted, the app must block when:

- route/category is missing or mismatched
- `DE 3/39` holder of the authorisation is missing
- `DE 5/12` customs office of exit is missing or not a valid office code
- `DE 2/3` documents/certificates set is empty or invalid for the C1 category
- exporter block is invalid for the dispatch-country scenario
- `DE 5/23` is missing or invalid
- `DE 7/4` is missing, or `DE 7/2` container indicator is unset
- `DE 6/9`, `DE 6/10` or `DE 6/11` are missing at item level
- B1-only or import-only data is present on the payload

## 6. Minimum implementation checklist for C1

1. `declarationCategory = "C1"` supported in schema
2. C1 export UI available behind the export route
3. `mapToCDS_C1` implemented and category-aware
4. reduced-form validation rules seeded
5. accepted C1 → supplementary export flow implemented
6. B1 and H1 regression tests kept green

## 7. Source status note

Section 3 was transcribed from the official GOV.UK Appendix 22D page on 2026-08-21. It replaces an earlier engineering draft that had been derived from the B1 draft and the I1 import set: it omitted the mandatory `DE 3/39` and `DE 5/12`, marked the mandatory `DE 2/3` as conditional, and carried six elements that are not part of the C1 data set. Verify against the source page before relying on it for a submission build.
