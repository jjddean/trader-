Group 5: Dates, Times, Periods, Places, Countries and Regions - GOV.UK

Skip to main content

Print this page

© Crown copyright 2026

This publication is licensed under the terms of the Open Government Licence v3.0 except where otherwise stated. To view this licence, visit nationalarchives.gov.uk/doc/open-government-licence/version/3 or write to the Information Policy Team, The National Archives, Kew, London TW9 4DU, or email: psi@nationalarchives.gov.uk.

Where we have identified any third party copyright information you will need to obtain permission from the copyright holders concerned.

This publication is available at https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-5-dates-times-periods-places-countries-and-regions

Known error workarounds may apply to this area of the instructions.

## DE 5/8 Country of Destination Code

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5, I1 C&F and I1 B&E | a2 | 1x | 1x |

### Declaration Category I1 C&F:

This data element is only required on a simplified declaration where specified by the Procedure Code, please see Appendix 1: DE 1/10: Requested and Previous Procedure Codes for specific details.

### All Declaration Categories:

The Destination Country Code must always be an EU Member State or Territory with which the EU has formed a Customs Union.

Using the relevant country code, enter the code for the Member State or Territory where the goods are located at the time of release into the customs procedure, for example, free circulation (See Appendix 13: Country Codes for the codes which may be used).

Where it is known at the time of drawing up the customs declaration that the goods will be dispatched to another Member State or Territory after the release, enter the code for this latter Member State or Territory, for example where Requested Procedure Codes 01 or 42 are being declared in DE 1/10, please see Appendix 1: DE 1/10: Requested and Previous Procedure Codes for specific details.

Where goods are imported with a view to place them under the Temporary Admission procedure, the Member State of destination shall be the Member State where the goods are to be first used.

Where goods are imported with a view to place them under the Inward Processing procedure, the Member State of destination shall be the Member State where the first processing activity is carried out.

### Notes:

The Destination Country Code must always be an EU Member State, Special Fiscal Territory or other Territory with which the EU has formed a Customs Union. However:

- Where the Onward Supply Relief (OSR) procedure is used (DE 1/10 codes beginning with 42), the Destination Country Code must not be GB or IM, but must be the EU Member State of destination for the onward supply.
- For example, goods being imported for onward supply to France, the code in DE 5/8 must be declared as FR.
- Where the Onward Dispatch (OSD) procedure is used (DE 1/10 codes beginning with 01), the Destination Country Code must not be GB or IM, but must be the Customs Union Territory of final destination for the onward dispatch.
- For example, goods being imported for onward dispatch to Jersey, the code in DE 5/8 must be declared as JE.

Where there are a number of items on a declaration but there is only one country of ultimate destination, this must be declared at header level only. No reference to the destination country should be made at item level.

Where there are a number of items on the declaration and there is more than one ultimate country of destination, the ultimate country of destination must be declared at individual item level only, not at the header level. The ultimate country of destination must not be the same for all individual item level data.

## DE 5/14 Country of Dispatch/Export Code

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5, I1 C&F and I1 B&E | a2 | 1x | 1x |

### Declaration Category I1 C&F:

This data element is only required on a simplified declaration where controlled goods are being entered on a simplified declaration.

### Declaration category H5:

The code declared should identify the territory of dispatch to the UK.

### All Declaration Categories:

Using the code list in Appendix 13: Country Codes, enter the relevant country code for the third country/ territory from which the goods were initially dispatched to the UK.

However, where there has been a:

- Stoppage (including consolidation) or
- Legal action taken in respect of the goods in an intermediate country, (for example, a non-EU country undertook an inspection which caused them to remain in that country for a longer period than would normally have been the case)
- Commercial transactions en-route (for example, a change of ownership in an intermediate country, for instance, a non-EU country)

You should enter the country code:

- For the last intermediate country, for instance, the non-EU country where the goods were last located before arrival in the UK or
- Where the change took place (for example, sale).

### Notes:

Factory ships: For goods produced or manufactured on factory ships not registered in the UK and consigned direct to this country, enter the code for the country in which the ship is registered.

Deep sea fisheries: For goods consigned direct to the UK from the deep-sea fisheries, enter the code for the country in which the fishing vessel is registered. Enter the description ‘deep sea fisheries’ in DE 6/8 (Description of Goods).

Where there are a number of items on a declaration but there is only one country of dispatch or export, this must be declared at header level only, unless DE 2/2 includes Additional information code NIDOM. No reference to the country of dispatch or export should be made at item level unless NIDOM is also declared.

Where there are a number of items on the declaration and there is more than one country of dispatch or export, the country of dispatch or export must be declared at individual item level only, not at the header level. The country of dispatch or export must not be the same for all individual item level data unless NIDOM is declared in DE 2/2.

Where Additional Code NIDOM is declared in DE 2/2, the country of export must always be declared at item level.

Where the goods are being dispatched from a group of countries, enter the code for the individual country the goods were originally dispatched from. For example, if goods are dispatched from the Italy and travel through the EU without any intermediate repacking or other changes, the country of dispatch should be declared as IT. FR must not be declared as the country of dispatch for goods which have just been transported through France in order to use the Channel crossings.

EU is not an acceptable code for declaring the country of dispatch or export.

Where goods are not in Free Circulation and are being dispatched from the Channel Islands into Northern Ireland (NI), refer to the guidance on manual duty calculation in DE 2/2 for instructions on how to complete the declaration.

For goods being removed from a Customs Warehouse, discharged from Inward Processing or discharged from Temporary Admission, the country of dispatch should be declared as either of the following, rather than GB:

- the third country or territory from which the goods were initially dispatched to the UK
- the last intermediate country where the goods were located before arrival in the UK

## DE 5/15 Country of Origin

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5, I1 C&F and I1 B&E | a2 | NA | 1x |

### Declaration Category I1 C&F:

This data element is only required on a simplified declaration where controlled goods are being entered on a simplified declaration.

### All Declaration Categories:

This data element is always mandatory.

Enter the code for the country of non-preferential origin of the goods from the list of codes shown in Appendix 13: Country Codes.

If a country of preferential origin is declared (DE 5/16), this data element must be completed if the country of non-preferential origin to be declared (DE 5/15) is different.

Where DE 5/16 is completed using a preference group code, DE 5/15 must be completed with the specific country of origin for the goods within that group or, if different, the non-preferential country of origin.

For imports originating from EU Member States, where the individual Member State is unknown, it is acceptable to enter any Member State involved in the production of the goods. The Member State may be identified through the accompanying commercial documentation or the Registered Exporter system (REX) code on a ‘statement on origin’. Please note, this only applies to entries on UK custom declarations: the origin stated on the proof of origin must be at the group of country level. For example, a ‘statement on origin’ made out under the UK-EU Trade Cooperation Agreement should be completed in accordance with Annex 7 of that agreement and refer to ‘the Union’ as the preferential origin of the goods.

Where the goods are subject to an electronic licence, DE 5/15 must always be completed.

### Notes:

In determining the country of origin, the rules laid down in Article 60(2) of EU Reg. No. 952/2013 should be followed.

#### Article 60(2)

Goods whose production involved more than one country or territory shall be deemed to originate in the country or territory where they underwent their last, substantial, economically justified processing or working in an undertaking equipped for that purpose, resulting in the manufacture of a new product or representing an important stage of manufacture.

## DE 5/16 Country of Preferential Origin

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5 & I1 C&F | an..4 | NA | 1x |

### Declaration Category H2:

DE 5/16 may be left blank for goods entered to a customs warehouse.

However, where a claim to preferential origin status is being reserved at the time of entry to the customs warehouse, the intended preference claim must be indicated on the entry to warehousing through the use of Additional Information (AI) statement code WHSRP in DE 2/2 (see Appendix 4: DE 2/2: Additional Information (AI) Statement Codes for details).

DE 4/17, 5/16 and 5/15 (where appropriate) must also be completed in these instances.

### Declaration Category I1 C&F:

This data element is only required on a simplified declaration where controlled goods are being entered on a simplified declaration and a claim to preference is being made.

### All Declaration Categories:

Where DE 4/17 (Preference Code) has a first digit other than ‘1’ this data element is always mandatory.

If a preferential treatment based on the origin of the goods is requested in DE 4/17 Preference, enter the country of preferential origin, as indicated in the proof of origin document. DE 5/15 must also be completed with the country of origin, even when it is identical to the country of preferential origin.

Enter the code for the country of origin or preference group of the goods from the list of codes shown in Appendix 13: Country Codes.

Where the proof of origin document refers to a group of countries, enter the group of countries by using the relevant codes in accordance with the codes listed in Appendix 13: Country Codes.

For example, for preference claims made in the UK under the UK-EU Trade Cooperation Agreement, enter the code ‘EU’ rather than the specific Member State country code.

Where DE 5/16 is completed using a preference group code, DE 5/15 must be completed with the specific country of origin for the goods within that group or, if applicable, the non-preferential country of origin.

Where DE 5/16 is completed with a preferential country of origin but the goods are subject to an electronic licence, DE 5/15 must also be completed.

## DE 5/21 Place of Loading

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H3, H4, I1 C&F and I1 B&E | an..17 | 1x | N/A |

### Declaration Category I1 C&F:

This data element is only required on a simplified declaration where a claim to a tariff quota is being made on the simplified declaration and a deduction of air transport costs is being claimed for goods arriving from a non-EU airport.

### Declaration Category H4:

Place of Loading must be completed for importations to Inward Processing when the declarant opts to use the Article 86 (3) customs debt rules as laid down in EU Reg. No. 952/2013 and an adjustment of air freight costs is claimed.

In such cases Additional Procedure Code F44 should be declared in DE 1/11 and GEN86 completed in DE 2/2 (Additional Information). Please refer to Appendix 1: DE 1/10: Requested and Previous Procedure Codes and Appendix 2A: DE 1/11: Additional Procedure Codes: Union Codes for more details.

### Additional Procedure Code (DE 1/11) Codes E01, E02, 1SV:

This data element must not be completed for goods which have been entered under Simplified Procedure Value (SPV) or Standard Import Value (SIV). It cannot therefore be used in conjunction with Additional Procedure Code E01, E02 or 1SV in DE 1/11. (See Appendix 2A: DE 1/11: Additional Procedure Codes: Union Codes for details.)

### All Declaration Categories:

This data element is only to be completed when an adjustment of air transport costs is being claimed for goods arriving from non-EU airports (see section 46 of Working out the customs value of your imported goods).

This data element is used to declare the airport of loading and should only be completed when claiming an adjustment to the customs value for the air freight charges related to the part of the journey which is considered to have been within the EU. The standard rates to be applied are shown in Appendix 15A: DE 5/21: Foreign Airport Zones and Percentages on Place of loading codes for Data Element 5/21 of the Customs Declaration Service.

It is used in conjunction with codes AR, AS, BR and BS in DE 4/9 (Addition and Deductions), otherwise it should be left blank.

Enter the 3-alpha IATA airport code shown on the air waybill which matches the codes listed in Appendix 15B: DE 5/21: Airport Codes on Place of loading codes for Data Element 5/21 of the Customs Declaration Service.

Where the goods were shipped from an airport not listed in Appendix 15B: DE 5/21: Airport Codes on Place of loading codes for Data Element 5/21 of the Customs Declaration Service, the code of the nearest listed airport must be used.

For consignments transhipped via another Member State, the airport of loading for the journey to the EU (third country airport) should be declared rather than the EU airport of transhipment.

### Notes:

When goods are imported by air into the UK, that part of the air transport costs covering the distance flown inside the EU is excluded from the value for duty.

CDS calculates the appropriate adjustment, using the percentages attached to the Airport of Loading code, excluding it from the customs value for duty but includes it in the value for VAT.

## DE 5/23 Location of Goods

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5, H7, I1 C&F and I1 B&E | Country: a2 +Type of location: a1 +Qualifier of the identification: a1 +CodedIdentification of location an..35 +Additional identifier n..3 | 1x | NA |

### Additional Declaration Types Y or Z (DE 1/2):

On supplementary declarations enter the code for the place where the goods were unloaded unless otherwise specified by the Procedure Code completion notes, see Appendix 1: DE 1/10: Requested and Previous Procedure Codes.

### All Declaration Categories:

Where goods are being declared at a GVMS location (see Appendix 16S), a Goods Not Arrived (pre-lodged) Additional Declaration Type must be declared in DE 1/2 using the codes in the table below.

Where the declaration has been pre-lodged because the goods are being released from a GVMS location, Additional Information Code ‘RRS01’ must also be declared in DE 2/2 and a GVMS location code from Appendix 16S declared in DE 5/23.

Using the relevant codes, enter the location where the goods are located at the time they are declared and available for examination purposes.

The Location code must be precise enough to allow Customs to carry out physical controls on the goods.

Details of the codes which may be declared in DE 5/23 for each particular type of location may be found in Appendix 16 DE 5/23: Goods Location Codes:

The goods location codes specified in Appendix 16 (excluding Appendix 16I) should be declared in DE 5/23 unless the DE 1/10 Procedure Code specifies otherwise. Please see Appendix 1: DE 1/10: Requested and Previous Procedure Codes for details.

The Appendix 16I codes must only be used where specified by the particular Procedure Code (DE 1/10) completion notes in Appendix 1: DE 1/10: Requested and Previous Procedure Codes.

For goods being moved through a Northern Ireland Goods Location, as noted in Appendix 16 DE 5/23: Goods Location Codes, one of Additional Information Codes ‘NIDOM’ or ‘NIIMP’ must also be declared in DE 2/2.

### Notes:

The Codes shown in column 2 of Appendices 16 DE 5/23: Goods Location Codes(with the exclusion of Appendix 16I) are the consolidated location codes to be declared in DE 5/23.

## DE 5/26 Customs Office of Presentation

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5 & I1 C&F | an8 | 1x | NA |

### Declaration Category I1 C&F:

This data element is only required on a simplified declaration where a SASP authorisation is held.

### All Declaration Categories:

This data element is only required where a SASP authorisation is used to release the goods.

This data element is made up of two components.

For all SASP declarations the codes should use one of the following formats:

For goods presented in the UK:

Enter the appropriate code from Appendix 17: DE 5/27: Supervising Office (SPOFF) Codes.

For goods presented in other Member States use the format below:

#### First Component: Country Code

- Enter use the appropriate country code (a2) for example, Ireland use IE. For a list of Country Codes, see Appendix 13: Country Codes.

#### Second Component: Customs Office Code

- Enter the code for the specific customs office within that country (an6), for example: DUB for Dublin followed by 400 representing Dublin Airport. The Customs office codes for other Member States may be found in the EU’s customs office list. Do not use these codes for goods presented in the UK.

### Notes:

This data element relates to centralised clearance, however, SASP authorisations are now deemed to be centralised clearance authorisations under the UCC.

## DE 5/27 Supervising Customs Office

| Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
| --- | --- | --- | --- |
| H1, H2, H3, H4, H5, I1 C&F and I1 B&E | an8 | 1x | NA |

### All Declaration Categories:

This data element is only to be completed when specifically instructed by the completion notes for the Procedure Code (DE 1/10). Please see Appendix 1: DE 1/10: Requested and Previous Procedure Codes for details of when this data element is to be completed and which supervising office is to be declared.

A list of the UK supervising office (SPOFF) codes may be found in Appendix 17: DE 5/27: Supervising Office (SPOFF) Codes. Codes for supervising offices in other Member States may be found in the EU’s customs office list.

### Notes:

This data element is made up of two components:

#### First Component: Country Code

- Entry the country code as specified in the authorisation (a2). A list of Country Codes may be found in Appendix 13: Country Codes.

#### Second Component: Supervising Office Code

- Enter the appropriate code (an6) which identifies the specific supervising office codes within that Member State, as specified in the authorisation.
- Codes for the UK supervising offices may be found in Appendix 17: DE 5/27: Supervising Office (SPOFF) Codes. Codes for supervising offices in other Member States may be found in the EU’s customs office list.

Back to top

## Help us improve GOV.UK

To help us improve GOV.UK, we’d like to know more about your visit today. Please fill in this survey (opens in a new tab).

Cancel