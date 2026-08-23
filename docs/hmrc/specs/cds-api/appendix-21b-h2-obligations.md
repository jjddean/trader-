# Appendix 21B — H2 customs warehousing declaration data set

| | |
|--|--|
| Source | https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21b-declaration-category-data-sets-h2 |
| Retrieved | 2026-08-23 |
| Status | implementation mirror (obligation table transcribed from the official page) |
| Behaviour authority | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |

## 1. Scope and rule summary

Obligation matrix for the H2 declaration category — **Special Procedure: storage
(customs warehousing)**. Section 3 is transcribed from the GOV.UK page named
above; sections 4–6 are Freightcode engineering notes and are **not** HMRC text.

H2 places goods **into** a customs warehouse. Duty and import VAT are suspended
while the goods are stored; the charge crystallises only when they are removed
to free circulation, or never, if they are re-exported.

- `DE 1/10` requested procedure is the **71 series** — see §5.
- `DE 2/7` identification of warehouse is **mandatory**, and is the data element
  that has no equivalent on any other import category.
- `DE 4/10` invoice currency is not a separate data element — a currency must
  accompany every monetary amount.
- `DE 8/7` write-off functionality is carried inside `DE 2/3`.

## 2. Symbols

| Symbol | Meaning |
|--------|---------|
| A | Mandatory — required by every Member State, or mandated by the UK as always required |
| C | Optional for economic operators |
| D | Dependent on the declaration scenario (procedure code, method of payment, and so on) |
| X | Required at item level |
| Y | Required at header level |

## 3. H2 obligation matrix

| DE | Name | Requirement | Level | Note |
|----|------|-------------|-------|------|
| 1/1 | Declaration type | A | Y | |
| 1/2 | Additional Declaration type | A | Y | |
| 1/6 | Goods item number | A | X | |
| 1/8 | Signature/Authentication | D | Y | Paper declarations only |
| 1/9 | Total number of items | C | Y | |
| 1/10 | Procedure | A | X | 71 series |
| 1/11 | Additional Procedure | A | X | |
| 2/1 | Simplified declaration/Previous documents | A | X, Y | |
| 2/2 | Additional information | D | X, Y | |
| 2/3 | Documents produced, certificates and authorisations | A | X | Carries DE 8/7 write-off |
| 2/4 | Reference number/UCR | C | X, Y | |
| 2/5 | LRN | A | Y | |
| 2/7 | **Identification of warehouse** | **A** | Y | Unique to this category |
| 3/15 | Importer | D | Y | |
| 3/16 | Importer identification no | D | Y | |
| 3/17 | Declarant | C | Y | |
| 3/18 | Declarant identification no | A | Y | |
| 3/19 | Representative | D | Y | |
| 3/20 | Representative identification no | D | Y | |
| 3/21 | Representative status code | D | Y | |
| 3/37 | Additional supply chain actor(s) identification no | C | X, Y | |
| 3/39 | Holder of the authorisation identification no | **A** | Y | The CW authorisation |
| 4/17 | Preference | C | X | The only Group 4 element |
| 5/8 | Country of destination code | A | X, Y | |
| 5/14 | Country of dispatch/export code | A | X, Y | |
| 5/15 | Country of origin code | D | X | |
| 5/16 | Country of preferential origin code | C | X | |
| 5/23 | Location of goods | A | Y | |
| 5/26 | Customs office of presentation | D | Y | |
| 5/27 | Supervising customs office | D | Y | |
| 6/2 | Supplementary units | D | X | |
| 6/5 | Gross mass (kg) | A | X, Y | |
| 6/8 | Description of goods | A | X | |
| 6/9 | Type of packages | A | X | |
| 6/10 | Number of packages | A | X | |
| 6/11 | Shipping marks | A | X | |
| 6/13 | CUS code | C | X | |
| 6/14 | Commodity code — Combined Nomenclature code | A | X | |
| 6/15 | Commodity code — TARIC code | D | X | |
| 6/16 | Commodity code — TARIC additional code(s) | D | X | |
| 6/17 | Commodity code — National additional code(s) | D | X | |
| 6/18 | Total packages | A | Y | |
| 7/2 | Container | A | Y | |
| 7/4 | Mode of transport at the border | A | Y | |
| 7/10 | Container identification number | D | X, Y | |
| 8/5 | Nature of transaction | A | X, Y | |
| 8/6 | Statistical value | A | X | |

46 rows, 25 of them mandatory.

## 4. How H2 differs from H1

> Freightcode engineering notes. Not HMRC text.

The difference is the point of the procedure: **duty is suspended, so there is
almost no valuation group.**

**Absent from H2 but present on H1:**

| DE | Name | Why it is gone |
|----|------|----------------|
| 4/1 | Delivery terms | No valuation is performed at entry |
| 4/3, 4/4, 4/6, 4/7 | Tax type, base, payable amount, total | No duty is calculated |
| 4/8 | Method of payment | Nothing to pay yet |
| 4/9 | Additions and deductions | No customs value |
| 4/11 | Total amount invoiced | |
| 4/13 | Valuation indicators | |
| 4/14 | Item price/amount | |
| 4/16 | Valuation method | Mandatory on H1; not declared at all here |
| 2/6 | Deferred payment | No charge to defer |
| 3/40 | Additional fiscal references | |
| 5/21 | Place of loading | |
| 6/1 | Net mass | Gross mass only |
| 7/5, 7/9, 7/15 | Inland mode, arrival identity, nationality | |
| 8/1 | Quota order number | Quota is claimed on removal, not entry |
| 8/2, 8/3 | Guarantee type and reference | HMRC states guarantee information is not declared on an H2 |

`DE 4/17` preference survives as the single Group 4 element, and only as C.

**Mandatory on H2 but not on H1:**

| DE | Name |
|----|------|
| 2/7 | Identification of warehouse |
| 2/3 | Documents, certificates and authorisations (D on H1) |
| 3/39 | Holder of the authorisation (D on H1) |
| 6/9, 6/11 | Type of packages, shipping marks (D on H1) |
| 7/2 | Container (D on H1) |
| 8/6 | Statistical value |

## 5. Procedure codes

> Source: https://www.gov.uk/government/publications/appendix-1-de-110-requested-and-previous-procedure-codes-of-the-customs-declaration-service-cds/requested-procedure-71-entry-to-a-customs-warehouse-cw
> Retrieved: 2026-08-23

### Entry — requested procedure 71

| Code | Meaning |
|------|---------|
| 7100 | Entry to customs warehouse, no previous procedure |
| 7110 | Re-import to customs warehouse, goods previously exported |
| 7121 | Re-import under Outward Processing, entering customs warehouse |
| 7122 | Re-import under Outward Processing not covered by 7121 |
| 7123 | Customs warehouse entry with Returned Goods Relief claim |
| 7151 | Customs warehouse entry, goods previously under Inward Processing |
| 7153 | As 7151, specific circumstances |
| 7154 | Inward Processing goods with a relief claim |
| 7171 | Entry from processing in a bonded warehouse |
| 7178 | Entry from another special procedure |

Every code requires a **Customs Warehousing authorisation** and a **Customs
Comprehensive Guarantee** for the approved premises. Individual codes add
further authorisations — Outward Processing, Inward Processing, or EIDR.

Allowable categories per the Appendix 1 index: H2 takes requested procedures
**71** and **78** (free zone/freeport). Note the discrepancy already recorded
for the export sets — the internal manual CDSSG09030 lists H2 as `71` only,
while the published Appendix 1 index includes `78`. The published index is the
higher authority.

### Removal — requested procedure 4071

Removing goods to free circulation is a **separate declaration**, not an
amendment of the entry.

| | |
|--|--|
| Code | `4071` — release to free circulation from a customs warehouse |
| Categories | H1, H5, I1 B&E |
| Authorisation | Customs Warehousing |
| Note | The MRN of the removal declaration must be given to the warehousekeeper as evidence the goods entered a procedure |

Re-export from the warehouse instead uses the **31 series** on the export side,
which is already in the B1/C1 allowable set.

HMRC waives the supplementary declaration for goods **placed under** customs
warehousing. On removal under additional declaration type B, a supplementary
declaration is likewise not required.

## 6. DE 2/7 — identification of warehouse

> Source: https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-2-references-of-messages-document-certificates-and-authorisations
> Retrieved: 2026-08-23

Two components: a one-letter **type**, then an **identifier** of up to 35
characters that ends with the authorising country code.

| Type | Warehouse |
|------|-----------|
| R | Public customs warehouse type I |
| S | Public customs warehouse type II |
| T | Public customs warehouse type III |
| U | Private customs warehouse |
| Y | Non-customs warehouse |
| Z | Free zone |

Identifier lengths: customs warehouse 7 digits, excise warehouse 13 digits,
Isle of Man free zone `0000006`. Example: `R1234567GB`.

Two restrictions that will produce rejections if missed:

1. **Types `S` and `T` may not be used with a `GB` country code.**
2. For imports to **Northern Ireland**, `GB` in DE 2/7 is restricted to excise
   premises and certain legacy customs-warehouse diversions; everything else
   must use `XI`.

All items on one declaration must use the **same warehouse**.

## 7. Build state

Nothing is implemented. There is no H2 mapper, renderer, validation gate or
schema field. `declarationCategory` accepts `B1`, `C1` and `I1` only.

If H2 is built, the shape follows I1 rather than B1: it is an import category,
so `mapToCDS_H1`'s import scaffolding applies, minus the entire valuation block
and plus `DE 2/7`.

Open before any build:

- The `78` free-zone question above.
- Whether removal (`4071`) is modelled as a distinct declaration linked to the
  entry, or as an unrelated H1. HMRC treats it as a separate declaration; the
  warehousekeeper evidence requirement implies FreightCode should hold the link.
- Retrieval was through a summarising fetch, as with the other appendix mirrors
  in this directory. Verify against the source page before relying on a
  requirement letter for a submission build.
