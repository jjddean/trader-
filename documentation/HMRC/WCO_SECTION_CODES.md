# WCO Section Codes — DMSREJ Pointer Reference

> **Source:** HMRC WCO XSD schema `WCO_DEC_2_DMS.xsd` from  
> https://github.com/hmrc/customs-declarations-information/blob/main/public/api/conf/1.0/schemas/wco/declaration/WCO_DEC_2_DMS.xsd  
> Last verified: 2026-05-26 against HMRC CDS API v2.0 (updated 20/03/2026)

Use this table to decode `DocumentSectionCode` values in DMSREJ pointer chains.  
Every WCOID here was read directly from `<WCOID>` annotations in the XSD — not inferred.

---

## Declaration-level elements (direct children of `Declaration`)

| WCOID | XML Element | Notes |
|---|---|---|
| `42A` | `Declaration` | Root element |
| `03A` | `AdditionalInformation` | DE 2/2 — statement codes |
| `05A` | `Agent` | DE 3/19 — customs representative |
| `15A` | `BorderTransportMeans` | DE 7/4, 7/6, 7/15 — mode + vessel at border |
| `28A` | `Consignment` | Transport/consignment container |
| `57A` | `Exporter` | DE 3/1 — OMIT for non-UK exporters |
| `57B` | `Declarant` | DE 3/18 — must be GB/XI EORI |
| `67A` | `GoodsShipment` | Main shipment block |

---

## GoodsShipment-level elements (inside `GoodsShipment`)

| WCOID | XML Element | Notes |
|---|---|---|
| `16A` | `Buyer` | DE 3/26 — UK importer party |
| `22B` | `TradeTerms` | DE 4/1 — incoterms (ConditionCode + LocationID) |
| `41A` | `CustomsValuation` | DE 4/9, 4/16 — at shipment level |
| `68A` | `GovernmentAgencyGoodsItem` | Per-item block (repeated) |
| `74A` | `Importer` | DE 3/15/16 — importer EORI |
| `09B` | `Seller` | DE 3/24 — supplier party |

---

## Consignment-level elements (inside `GoodsShipment/Consignment`)

| WCOID | XML Element | Notes |
|---|---|---|
| `10A` | `ArrivalTransportMeans` | DE 7/9 — vessel ID on arrival |
| `30A` | `Consignor` | Sending party in consignment |
| `64A` | `GoodsLocation` | DE 5/23 — location of goods |

---

## GovernmentAgencyGoodsItem-level elements (inside each `68A` item)

| WCOID | XML Element | Notes |
|---|---|---|
| `23A` | `Commodity` | HS code, description, weight, value |
| `41A` | `CustomsValuation` | DE 4/16 — at item level |
| `70A` | `GovernmentProcedure` | DE 1/10, 1/11 — procedure codes |
| `39B` | `ValuationAdjustment` | DE 4/9 adjustment at item level |
| `03A` | `AdditionalInformation` | DE 2/2 at item level |

---

## Commodity-level elements (inside `23A`)

| WCOID | XML Element | Notes |
|---|---|---|
| `50A` | `DutyTaxFee` | DE 4/3 — duty/preference code |
| `79A` | `InvoiceLine` | DE 4/14 — item invoice amount |

---

## Reused across multiple parent elements

| WCOID | XML Element | Appears inside |
|---|---|---|
| `04A` | `Address` | Declarant, Exporter, Seller, Buyer, Importer, GoodsLocation, etc. |
| `30A` | `Consignor` / `PreviousDocument` | Multiple levels |

---

## Common TagID values seen in DMSREJ pointers

| TagID | Field | Element |
|---|---|---|
| `103` | `CountryCode` | Address / ExportCountry / Origin |
| `112` | Item invoice amount | InvoiceLine |
| `122` | Method code or charge type | CustomsValuation |
| `164` | DutyTaxFee code | DutyTaxFee |
| `166` | Additional procedure code | GovernmentProcedure |
| `188` | Valuation adjustment amount | ValuationAdjustment |
| `226` | Statement code | AdditionalInformation |
| `241` | CityName | Address |
| `239` | Amount | ChargeDeduction |
| `245` | CurrencyID | ChargeDeduction |
| `410` | TypeCode | Address.TypeCode (address qualifier, e.g. "U" = UN/LOCODE) — FIRST child in Address sequence per XSD line 5166 |
| `241` | CityName | Address.CityName — second in Address sequence |
| `242` | CountryCode | Address.CountryCode — third in Address sequence |
| `L002` | LocationID | TradeTerms |
| `L110` | TypeCode | GoodsLocation |
| `R009` | Rule R009 | Buyer (Address combination) |
| `R038` | Rule R038 | Importer |
| `R050` | Rule R050 | Seller (Address combination) |
| `R123` | Rule R123 | Declarant (EORI format/business rule) |

---

## How to read a DMSREJ pointer chain

A pointer chain lists section codes from outer to inner scope.  
Example: `42A / 67A / 68A(seq=1) / 23A / 50A TagID 164`

Reads as:  
`Declaration → GoodsShipment → GovernmentAgencyGoodsItem[1] → Commodity → DutyTaxFee → field 164`

Multiple pointers on a single `<Error>` block identify the **same field** from different angles — read them together.

---

## DMSREJ error codes quick reference

| Code | Meaning |
|---|---|
| `CDS10001` | Mandatory field missing at the pointed location |
| `CDS10020` | Invalid or unrecognised code value |
| `CDS12005` | Business rule violation (Rxxx identifies the rule) |
| `CDS12056` | Incompatible combination of two fields |
| `CDS12070` | Field present but a related required field is absent |
| `CDS12073` | Same data declared at two incompatible levels |
| `CDS12077` | Two fields sent that are mutually exclusive |
