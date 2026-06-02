# Trade Test Data Library

| | |
|--|--|
| Source | HMRC CDS Test Data Library (cover sheet exported to `trade-test-data-library-cover.csv`) |
| Retrieved | 2026-06-02 |
| Related API | [Customs Declarations v2.0](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/2.0) — create test user with TDL EORI |

## What it is

From the library abstract:

> The document provides a summary of all the test profiles that have been **configured and loaded into Trade Test**. Each test profile (EORI) represents a dummy “trader” and has particular attributes, e.g. a particular deferment account number, the authority to export from a particular location, or a particular set of authorisations.

Trade Test CDS validates party IDs against these **pre-loaded profiles**. EORIs created only on the Developer Hub “Create test user” web form are **not** automatically loaded as Trade Test profiles → **CDS12005** (“not recognised”) on Declarant/Importer.

## Customs Declarations API (cited setup)

When creating a test user for declaration testing:

1. Use the [Create Test User API](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/api-platform-test-user/1.0)
2. Request `"customs-services"` in `serviceNames`
3. **To use an EORI from the Test Data Library, provide it as part of the request** (`eoriNumber` field)

Example body:

```json
{
  "serviceNames": ["customs-services"],
  "eoriNumber": "GB553202734852"
}
```

## EORI used in this repo (archive)

| EORI | Evidence |
|------|----------|
| `GB553202734852` | `test-evidence/run-additional-scenarios.js`; `test-evidence/archive-pre-p0/scenario-1-happy-path-request.xml`; TDL changelog V23.0 (FZ auth) in cover CSV |

Obtain the full current TDL spreadsheet from HMRC CDS technical documentation / SDST when selecting profiles for new lanes.

## Active lane default

See `spec/lane.md` — Declarant and Importer EORI **`GB553202734852`** until a different TDL profile is cited for this lane.
