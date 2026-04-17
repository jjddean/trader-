# HMRC Requirement Mapping (DE 2/3)

## Purpose
- Define scenario-based requirement mapping used by the unified documents and submit flows.
- Align requirement references to HMRC CDS supporting-document declaration model (DE 2/3).

## Scenario Matrix

| Scenario | Requirement Code | Name | Requirement Level | DE Reference | Guidance |
|---|---|---|---|---|---|
| STANDARD | N935 | Commercial invoice / Origin declaration | blocking | DE 2/3 | Evidence of customs value. |
| STANDARD | N271 | Packing list | blocking | DE 2/3 | Supports package/weight verification. |
| EXPORT | N935 | Commercial invoice / Origin declaration | blocking | DE 2/3 | Evidence of customs value. |
| EXPORT | N271 | Packing list | blocking | DE 2/3 | Supports package/weight verification. |
| EXPORT | 9100 | Rules of Origin Statement | advisory | DE 2/3 | Preferential origin evidence where relevant. |
| CONTROLLED | N935 | Commercial invoice / Origin declaration | blocking | DE 2/3 | Evidence of customs value. |
| CONTROLLED | C400 | Licence | blocking | DE 2/3 | Licence/permit support for controlled goods. |

## Agreement-Aware Advisory Origin Evidence
- Applied for export-like scenarios (export route, EX declaration type, or non-GB destination):
  - U166 (Statement on Origin, REX)
  - U164 (EUR.1)
  - U101 (Registered Exporter)
- Country-context advisory:
  - N865 (Form A) for DCTS-style Form A country set.
  - otherwise N864 (Certificate of origin).

## Runtime Behavior
- Blocking requirements gate submit.
- Advisory requirements surface warnings and recommendations, but do not block submit.
- Requirement hydration occurs in both:
  - unified documents page
  - submit page
  ensuring consistent gate behavior even if users skip documents page.
