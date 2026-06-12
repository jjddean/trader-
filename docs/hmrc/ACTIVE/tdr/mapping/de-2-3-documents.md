# DE 2/3 — Documents Produced, Certificates and Authorisations

| | |
|--|--|
| Obligation (H1) | **D** — Dependant, **X** — Item level |
| Reading note | [7] |
| Source — Appendix 5A Union | https://www.gov.uk/government/publications/data-element-23-documents-and-other-reference-codes-union-of-the-customs-declaration-service-cds |
| Source — Appendix 5A National | https://www.gov.uk/guidance/data-element-23-documents-and-other-reference-codes-national-of-the-customs-declaration-service-cds |
| Source — Appendix 5 collection | https://www.gov.uk/government/collections/data-element-23-documents-and-other-reference-codes-of-the-customs-declaration-service-cds |
| Source — Appendix 5B status codes | see Appendix 5 collection |
| Source — step-by-step CDSSG12010 | https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide/cdssg12010 |
| Source — step-by-step CDSSG12090 (status codes) | https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide/cdssg12090 |
| Retrieved | 2026-05-27 |

## Code categories (verbatim)

> Codes which begin with a letter are referred to as Union Document Codes and can be found in Appendix 5A Union.
> Codes which begin with a number are referred to as National Document Codes and can be found in Appendix 5A National.
> Where a combination of Union and National Document Codes are needed to release the goods any Union Document Codes should be declared first.

## Status codes (verbatim)

> Where a document code in Appendix 5A states that a Document Status Code is required, a list of the Status Codes accepted by CDS and their definitions can be found in Appendix 5B.

> Where a document code permits the use of status codes UA, UE, UP, US, XX or XW, and where the document normally requires a reference number, and where the document is not held (waiver is claimed), a statement supporting the use of those status codes must be provided. The statement must be provided in both the Second Component (Document Identifier) and in the fourth component: (Document Reason) (an..35) of DE 2/3.

> Use of status code XX or XW is a legal declaration that the goods are exempted from the documentary controls.
> Enough evidence must be held in records to show eligibility for the waiver or exemption which must be produced on demand.

## Lane document set — pending Appendix 5A row extraction

Required ODS download:
```
docs/hmrc/specs/cds-api/mirrors/appendix5a-union.ods   ← from gov.uk
docs/hmrc/specs/cds-api/mirrors/appendix5a-rows.md     ← extracted rows for codes used by this lane
```

| Code | Type | Required? | Status code | Lane source |
|------|------|-----------|-------------|-------------|
| N935 | Commercial invoice | TBD — Appendix 5A row | TBD | trader input |
| N271 | Packing list | TBD — Appendix 5A row | TBD | trader input |

Until the Appendix 5A row is pasted in, no `<AdditionalDocument>` element may be added or removed beyond the current set without policy violation.

## Known errors

| Code | Pointer | Meaning |
|------|---------|---------|
| CDS11004 | 02A | Document type/code combination invalid for the procedure |
| CDS77002 | 02A | Document status code missing or invalid for the document |

Both require the Appendix 5A row for each declared document.
