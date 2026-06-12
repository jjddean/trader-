# Appendix 21A: Declaration Category Data Sets H1

> Source: https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets/appendix-21a-declaration-category-data-sets-h1
> Retrieved: 2026-05-27

The following table identifies the requirements for completion of the appropriate data elements on an H1 customs declaration.

| Symbol | Symbols in the cells — Symbol description |
| --- | --- |
| A | Mandatory: data required by every Member State or data for which the UK has opted to mandate as always required |
| C | Optional for economic operators: data that economic operators may decide to supply |
| D | Dependant on Customs declaration scenario e.g. Procedure Code, Method of Payment etc. |
| X | Data element required at the item level of the declaration of goods. The information entered at the item level of goods is valid only for the items of goods concerned |
| Y | Data element required at the header level of the declaration of goods. The information entered at the header level is valid for all declared items of goods |

| Data Element (DE) Number | Data Element (DE) name | Symbol | Note |
| --- | --- | --- | --- |
| 1/1 | Declaration type | A | Y | No Note |
| 1/2 | Additional Declaration type | A | Y | No Note |
| 1/6 | Goods item number | A | X | No Note |
| 1/8 | Signature/Authentication | D | Y | Only mandatory for a paper declaration |
| 1/9 | Total number of items | A | Y | No Note |
| 1/10 | Procedure | A | X | No Note |
| 1/11 | Additional Procedure | A | X | No Note |
| 2/1 | Simplified declaration/Previous documents | A | X, Y | No Note |
| 2/2 | Additional information | D | X, Y | [7] [10] |
| 2/3 | Documents produced, certificates and authorisations, additional references. | D | X | [7] |
| 2/4 | Reference number/UCR | C | X, Y | No Note |
| 2/5 | LRN | A | Y | No Note |
| 2/6 | Deferred payment | D | Y | Only mandatory when deferment is used. |
| 2/7 | Identification of warehouse | D | Y | [11] |
| 3/1 | Exporter | D | X, Y | [12] |
| 3/2 | Exporter identification no | D | X, Y | [12g] |
| 3/15 | Importer | D | Y | [12t] [12u] |
| 3/16 | Importer identification no | D | Y | [12a] |
| 3/17 | Declarant | C | Y | No Note |
| 3/18 | Declarant identification no | A | Y | No Note |
| 3/19 | Representative | D | Y | [12] [12b] |
| 3/20 | Representative identification no | D | Y | [12b] |
| 3/21 | Representative status code | D | Y | [12c] |
| 3/24 | Seller | D | X, Y | [12] [12d] |
| 3/25 | Seller identification no | D | X, Y | [12d] |
| 3/26 | Buyer | D | X, Y | [12] [12e] |
| 3/27 | Buyer identification no | D | X, Y | [12e] |
| 3/37 | Additional supply chain actor(s) identification no | C | X, Y | No Note |
| 3/39 | Holder of the authorisation identification no | D | Y | [12f] |
| 3/40 | Additional fiscal references identification no | D | X, Y | [67b] [67c] |
| 4/1 | Delivery terms | D | Y | [16] [20a] [31] |
| 4/3 | Calculation of taxes — Tax type | D | X | [18] |
| 4/4 | Calculation of taxes — Tax base | D | X | [18a] [31] |
| 4/6 | Calculation of taxes — Payable tax amount | D | X | [18b] |
| 4/7 | Calculation of taxes — Total | D | X | [18b] |
| 4/8 | Calculation of taxes — Method of payment | D | X | [18] |
| 4/9 | Additions and deductions | D | X, Y | [16] [20] [20a] [31] |
| 4/11 | Total amount invoiced | C | Y | No Note |
| 4/13 | Valuation indicators | D | X | [16] [31] |
| 4/14 | Item price/amount | D | X | [31] |
| 4/15 | Exchange rate | D | Y | [22] |
| 4/16 | Valuation method | A | X | No Note |
| 4/17 | Preference | A | X | No Note |
| 5/8 | Country of destination code | A | X, Y | No Note |
| 5/14 | Country of dispatch/export code | A | X, Y | No Note |
| 5/15 | Country of origin code | D | X | [28] [68] |
| 5/16 | Country of preferential origin code | D | X | [29] |
| 5/21 | Place of loading | D | Y | [29a] [31] |
| 5/23 | Location of goods | A | Y | No Note |
| 5/26 | Customs office of presentation | D | Y | [30] |
| 5/27 | Supervising customs office | D | Y | [31] |
| 6/1 | Net mass (kg) | A | X | No Note |
| 6/2 | Supplementary units | D | X | [31a] |
| 6/5 | Gross mass (kg) | A | X, Y | No Note |
| 6/8 | Description of goods | A | X | No Note |
| 6/9 | Type of packages | A | X | No Note |
| 6/10 | Number of packages | A | X | No Note |
| 6/11 | Shipping marks | A | X | No Note |
| 6/13 | CUS code | D | X | [31a] |
| 6/14 | Commodity code — Combined Nomenclature code | A | X | No Note |
| 6/15 | Commodity code — TARIC code | A | X | No Note |
| 6/16 | Commodity code — TARIC additional code(s) | D | X | [31a] |
| 6/17 | Commodity code — National additional code(s) | D | X | [31a] |
| 6/18 | Total packages | A | Y | No Note |
| 7/2 | Container | A | Y | No Note |
| 7/4 | Mode of transport at the border | A | Y | No Note |
| 7/5 | Inland mode of transport | D | Y | [41] |
| 7/9 | Identity of means of transport on arrival | D | Y | [43] |
| 7/10 | Container identification number | D | X, Y | [43a] |
| 7/15 | Nationality of active means of transport crossing the border | D | Y | [46] |
| 8/1 | Quota order number | D | X | [46a] |
| 8/2 | Guarantee type | D | Y | [49] |
| 8/3 | Guarantee reference | D | Y | [49] |
| 8/5 | Nature of transaction | A | X, Y | No Note |
| 8/6 | Statistical value | A | X | No Note |

Note:

DE 4/10 Invoice currency is not declared as a separate data element however, a currency must always be declared against any monetary amount entered on the declaration.

DE 8/7 Writing-off functionality is included in DE 2/3.

For an explanation of each note in the table see the Declaration Category Data Sets Reading Notes.
