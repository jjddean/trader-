# Appendix 22D — C1 C&F simplified export declaration data set

| | |
|--|--|
| Source | GOV.UK export declaration category dataset collection: Appendix 22D (C1 C&F) |
| Retrieved | 2026-08-05 |
| Status | implementation mirror / engineering draft |
| Behaviour authority | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |

## 1. Scope and rule summary

This document captures the engineering obligation matrix for the C1 C&F simplified export declaration category. It is the reduced-form export equivalent of the B1 standard export declaration and is connected to the export simplified category rules in the current repo build plan.

Important published rules:

- C1 is the simplified export category for regular use.
- `DE 1/2` is the simplified export category set (`C + F`).
- It is reduced-form compared with B1, but only where the official appendix allows reduction.
- If the export scenario requires a full B1 declaration, the app must not silently downgrade to simplified rules.

## 2. Core C1 obligations for engineering

| DE | Name | Requirement | Level | Notes |
|----|------|-------------|-------|------|
| 1/1 | Declaration type | A | Y | Required |
| 1/2 | Additional declaration type | A | Y | Required for C1 |
| 1/6 | Goods item number | A | X | Required |
| 1/9 | Total number of items | A | Y | Required |
| 1/10 | Procedure | A | X | Required |
| 1/11 | Additional procedure | A | X | Required when applicable |
| 2/1 | Previous documents | A | X, Y | Required when previous declarations are involved |
| 2/3 | Documents produced, certificates and authorisations | D | X | Reduced set only when valid |
| 2/5 | LRN | A | Y | Required |
| 3/1 | Exporter | D | X, Y | Exporter EORI or address block where required |
| 3/2 | Exporter identification no | D | X, Y | EORI path |
| 3/18 | Declarant identification no | A | Y | Required |
| 3/19 | Representative | D | Y | Conditional |
| 3/20 | Representative identification no | D | Y | Conditional |
| 3/21 | Representative status code | D | Y | Conditional |
| 4/1 | Delivery terms | D | Y | Conditional |
| 5/8 | Country of destination code | A | X, Y | Required |
| 5/14 | Country of dispatch/export code | A | X, Y | Required |
| 5/15 | Country of origin code | D | X | Conditional |
| 5/23 | Location of goods | A | Y | Required |
| 6/1 | Net mass (kg) | D | X | Conditional |
| 6/2 | Supplementary units | D | X | Conditional |
| 6/5 | Gross mass (kg) | A | X, Y | Required |
| 6/8 | Description of goods | A | X | Required |
| 6/9 | Type of packages | A | X | Required |
| 6/10 | Number of packages | A | X | Required |
| 6/14 | Commodity code — CN code | D | X | Conditional |
| 6/18 | Total packages | A | Y | Required |
| 7/2 | Container | A | Y | Required |
| 7/4 | Mode of transport at the border | A | Y | Required |
| 7/9 | Identity of means of transport on arrival | D | Y | Conditional |
| 8/5 | Nature of transaction | A | X, Y | Required |

## 3. C1 engineering interpretation

### 3.1 Reduced form

C1 must not be treated as “B1 with fields hidden.” It is a reduced export declaration with a different declaration class and a smaller valid field set.

The app must enforce:

- `route = "export"`
- `declarationCategory = "C1"`
- category-specific `TypeCode` / declaration-type logic
- reduced document sets only where valid under Appendix 22D

### 3.2 Field handling

The reduced form still requires:

- valid destination and dispatch country data
- valid export goods location (`DE 5/23`)
- valid transport mode and identity (`DE 7/4` / `DE 7/9` when applicable)
- valid commodity / mass / package information
- valid exporter block logic

### 3.3 Supplementary export flow

The C1 category is not the end state of export implementation. The accepted C1 declaration is a prerequisite for the supplementary B1 export flow:

- create supplementary export after accepted C1
- preserve prior-document linkage to the accepted C1 MRN
- keep the supplementary declaration B1-based where Appendix 22 requires it
- omit repeated EXS/combined elements only when the export category rules permit omission

## 4. Validation gates

Before `mapToCDS_C1` is accepted, the app must block when:

- route/category is missing or mismatched
- exporter block is invalid for the dispatch-country scenario
- `DE 5/23` is missing or invalid
- `DE 7/4` or transport ID is missing
- `documentCode` or authorisation set is invalid for the C1 category
- B1-only data is required but the declaration silently reduced the field set

## 5. Minimum implementation checklist for C1

1. `declarationCategory = "C1"` supported in schema
2. C1 export UI available behind the export route
3. `mapToCDS_C1` implemented and category-aware
4. reduced-form validation rules seeded
5. accepted C1 → supplementary B1 flow implemented
6. B1 and H1 regression tests kept green

## 6. Source status note

The official Appendix 22D page is part of the GOV.UK Appendix 22 export declaration category data set collection. This file captures the working engineering matrix and should be matured into a full verbatim mirror when the exact page is retrieved in-repo or from a source-backed fetch session.
