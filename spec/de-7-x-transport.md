# DE 7/x — Transport

| | |
|--|--|
| Source | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-7-transport-information-modes-means-and-equipment |
| Retrieved | 2026-05-27 |

## DE 7/2 — Container

| Obligation (H1) | Format | Header | Item |
|-----------------|--------|--------|------|
| A | n1 | 1x | NA |

> Enter the appropriate Union code to indicate if the goods will be in a shipping container when crossing the external border of the Union.
> - `0` if the goods are not transported in containers
> - `1` if the goods are transported in containers

## DE 7/4 — Mode of Transport at the Border

| Obligation (H1) | Format | Header | Item |
|-----------------|--------|--------|------|
| A | n1 | 1x | NA |

> Completion of this data element is mandatory for all supplementary declarations.

| Mode | Code |
|------|------|
| Maritime (Sea) transport | 1 |
| Rail transport | 2 |
| Road transport | 3 |
| Air transport | 4 |
| Postal (Mail) consignment | 5 |
| Roll-on-Roll-off (RoRo) | 6 |
| Fixed transport installations | 7 |
| Inland waterway transport | 8 |
| Mode unknown (e.g. own propulsion) | 9 |

> The Channel Tunnel Terminal (Eurotunnel) should be declared using code '6': RoRo.
> Code 5 must only be used for goods handled by an authorised postal operator … Code 5 must not be used for consignments exported via a Fast Parcel Operator (FPO) or other non-UPU operator.

## DE 7/5 — Inland Mode of Transport

| Obligation (H1) | Format | Header | Item |
|-----------------|--------|--------|------|
| D | n1 | 1x | NA |

> Using the code list from DE 7/4, enter the inland mode of transport.
> Mode 6 (RoRo) must not be declared as the inland mode of transport.
> Completion is mandatory when import formalities are carried out away from the point of entry. Not required for entry into a customs warehouse or removals from a free zone.

## DE 7/9 — Identity of Means of Transport on Arrival

| Obligation (H1) | Format | Header | Item |
|-----------------|--------|--------|------|
| D | Type of identification: n2 + Identification number: an..35 | 1x | NA |

> This data element is not required where codes 5 (Postal) or 7 (Fixed Energy Installations) have been declared in DE 7/4.

### First component — Identification type (n2)

| Code | Description |
|------|-------------|
| 10 | International Maritime Organization (IMO) ship identification number |
| 11 | Name of the sea-going vessel |
| 20* | Wagon number |
| 30* | Registration number of the road vehicle |
| 40 | IATA flight number |
| 41 | Registration number of the aircraft |
| 80 | European Vessel Identification Number (ENI code) |
| 81 | Name of the inland waterways vessel |

> *Where Mode of Transport code '6' is declared in DE 7/4, either code 20 or 30 should be entered in DE 7/9.

### Second component — Identification number (an..35)

| Means of transport | Method of identification |
|--------------------|-------------------------|
| Sea and inland waterway transport | Name of vessel or IMO Ship Identification Number |
| Air transport | Number and date of flight (or aircraft registration number if no flight number) |
| Road transport | Vehicle registration number |
| Rail transport | Wagon number |

> The 'identity' to be declared is the identity of the means of transport on which the goods are directly loaded at the time of presentation at the customs office of import.

## DE 7/10 — Container Identification Number

| Obligation (H1) | Format | Header | Item |
|-----------------|--------|--------|------|
| D | an..17 | 9999x | 9999x |

> Leave this data element blank if the goods are not containerised or if it is not known whether they are containerised.
> If containerised but the container number is not yet known (e.g. pre-lodged), enter 'number(s) unknown'.
> To avoid duplication, the container number need only be declared against the first item of a declaration where all items are to be shipped in a single container.

## DE 7/15 — Nationality of active means of transport crossing the border

| Obligation (H1) | Format | Header | Item |
|-----------------|--------|--------|------|
| D | a2 | 1x | NA |

> Not required where codes 2 (Rail), 5 (Postal) or 7 (Fixed Energy Installation) have been declared in DE 7/4.
> Use Appendix 13 country codes.
> Where DE 7/9 identity is Eurotunnel, DE 7/15 must be FR.
> EU is not an acceptable code for the Nationality of active means of transport crossing the border.

## Lane application (DE→GB maritime laptops)

| DE | Value | Cited |
|----|-------|-------|
| 7/2 | `0` (not containerised — TBD) or `1` | Group 7 |
| 7/4 | `1` (Maritime) | Group 7 |
| 7/5 | omit (containerised import direct to Felixstowe — TBD) | Group 7 |
| 7/9 type | `11` (Name of sea-going vessel) | Group 7 |
| 7/9 number | `CSCL GLOBE` | trader input |
| 7/10 | container ID if 7/2 = 1, else omit | Group 7 |
| 7/15 | dispatch/transport nationality | Appendix 13 — TBD verify carrier nationality |

## Known errors

| Code | Pointer | Probable cause |
|------|---------|----------------|
| CDS12005 / R123 | 57B (`Declarant/ID`, DE 3/18) | Declarant EORI rule — WCOID `57B` = `Declarant`, not transport; rule text not in Tariff Vol 3 |
| CDS12073 | header/item conflict | DE 7/x duplicated at header and item where not permitted |

R123 rule text not published in Tariff Vol 3 — needs CDS error code list source (separate Appendix).
