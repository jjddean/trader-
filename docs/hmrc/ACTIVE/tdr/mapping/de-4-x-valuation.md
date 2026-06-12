# DE 4/x — Valuation, Taxes, Delivery Terms

| | |
|--|--|
| Source — Group 4 completion guide | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-4-valuation-information-and-taxes |
| Source — Appendix 7 (DE 4/1 Incoterms) | https://www.gov.uk/government/publications/appendix-7-de-41-delivery-terms-incoterm-codes |
| Source — Appendix 8 (DE 4/3 Tax Types) | https://www.gov.uk/government/publications/appendix-8-de-43-tax-types |
| Source — Appendix 9 (DE 4/8 MOP) | https://www.gov.uk/government/publications/appendix-9-de-48-method-of-payment-codes |
| Source — Appendix 10 (DE 4/9 Additions/Deductions) | https://www.gov.uk/government/publications/appendix-10-de-49-additions-and-deductions |
| Source — Appendix 11 (DE 4/10 Currency) | https://www.gov.uk/government/publications/appendix-11-de-410-currency-codes |
| Source — Appendix 12 (DE 4/17 Preference) | https://www.gov.uk/government/publications/appendix-12-de-417-preference-codes |
| Status | partial — Group 4 DE 4/1 location rule cited 2026-05-31 |

## Obligation summary (from Appendix 21A)

| DE | Name | Symbol | Level | Note |
|----|------|--------|-------|------|
| 4/1 | Delivery terms | D | Y | [16] [20a] [31] |
| 4/3 | Calculation of taxes — Tax type | D | X | [18] |
| 4/4 | Calculation of taxes — Tax base | D | X | [18a] [31] |
| 4/6 | Calculation of taxes — Payable tax amount | D | X | [18b] |
| 4/7 | Calculation of taxes — Total | D | X | [18b] |
| 4/8 | Calculation of taxes — Method of payment | D | X | [18] |
| 4/9 | Additions and deductions | D | X, Y | [16] [20] [20a] [31] |
| 4/11 | Total amount invoiced | C | Y | — |
| 4/13 | Valuation indicators | D | X | [16] [31] |
| 4/14 | Item price/amount | D | X | [31] |
| 4/15 | Exchange rate | D | Y | [22] |
| 4/16 | Valuation method | A | X | — |
| 4/17 | Preference | A | X | — |

## Lane

| DE | Value | Status |
|----|-------|--------|
| 4/1 Incoterm | CIF + location **GBFELIXSTOWE** (free-text: GB + Felixstowe) | Group 4 DE 4/1 — method 1 requires both components; mapper `resolveTradeTermsLocationId()` |
| 4/10 Currency | GBP | Appendix 11 — ISO 4217 |
| 4/11 Total invoiced | 5000.00 GBP | trader input |
| 4/14 Item price | 5000.00 GBP | reading note [31] |
| 4/16 Valuation method | 1 (Transaction value) | A — mandatory |
| 4/17 Preference | 100 (no preference) | A — mandatory; verify code list |

## DE 4/1 location (verbatim rule)

> Delivery terms code must be provided for declarations using valuation method 1 (transaction value of imported goods).
>
> The code to be declared shall be made up of two components: First Component: INCOTERM code; Second Component: Location up to which the INCOTERMs apply.
>
> Where no UN/LOCODE exists, enter the location details in the following format: The appropriate country code (a2) followed by plain text location (an..35). For example: **CIFGBCanewdon**

Source: Group 4 completion guide (retrieved 2026-05-31). XML maps to `TradeTerms/ConditionCode` + `TradeTerms/LocationID`.

## Known errors

| Code | Pointer | Probable cause |
|------|---------|----------------|
| CDS10020 | 22B / L002 | Invalid `TradeTerms/LocationID` — plain text without GB prefix |
| CDS12073 | 67A / 68A 103 | Under investigation — incomplete DE 4/1 location may contribute; fix attempt 2026-05-31 |
| CDS12077 | 23A / 50A / 164 | DutyTaxFee combination invalid — depends on DE 4/3 + 4/17 |
| CDS12077 | 92A / 501 | Origin / preference encoding invalid |
| CDS12070 | 39B / 188 | ValuationAdjustment additions/deductions mismatch |
