# CDS12005 — Party ID (R123 / R038)

| | |
|--|--|
| Source — CDS error codes ODS | `docs/hmrc/specs/cds-api/mirrors/cds-error-codes-2026-03-11.ods` (GOV.UK publication updated 13 March 2026) |
| Source — ValidationResultTypes | `CDS 03 CDS Codelists and WCO References 5.1.0 v2.55.xlsx` sheet `System_Defined_Codes` row 107 |
| Source — WCO field tags | `convex/lib/cds_wco_references.ts` (from same codelists xlsx) |
| Source — Group 3 import | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-3-parties (retrieved 2026-06-02) |
| Source — Trade Test profiles | `docs/hmrc/specs/cds-api/mirrors/trade-test-data-library.md` |
| Source — Customs Declarations API | https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/2.0 |

## DMSREJ pointers (not separate “transport rules”)

| TagID | WCO path | DE | Meaning |
|-------|----------|-----|---------|
| **R123** | `Declaration/Declarant/ID` | 3/18 | Field tag on Declarant EORI (`wcoId` R123 in codelists xlsx row 117) |
| **R038** | `Declaration/GoodsShipment/Importer/ID` | 3/16 | Field tag on Importer EORI (`wcoId` R038 in codelists xlsx row 432) |

Both return validation code **CDS12005** (same family).

## CDS12005 text (ODS + System_Defined_Codes)

**ODS** (`cds-error-codes-2026-03-11.ods`):

- Description: Authorisation Error: Party ID unknown or invalid
- Explanation: Identification not recognised. An EORI or VAT number included on the declaration is **not recognised** or the number used is **not permitted in this DE**.

**System_Defined_Codes** row 107:

- Code: `CDS12005`
- Description: Authorisation Error: Invalid Party ID
- Explanation: Identification not recognised — An EORI or VAT number included on the declaration is **not recognised**.

There is **no separate published row for “R123” or “R038”** in the error-codes ODS or ValidationResultTypes — those are WCO **TagIDs** in the DMSREJ pointer only.

## Group 3 — “recognised” EORI (import guide)

DE 3/16 (Importer identification):

> If a **recognised** GB EORI is held it must be declared in DE 3/16.

DE 3/18 (Declarant identification):

> Enter the identification number (GB or XI EORI) of the Declarant in DE 3/18

Self-representation (same guide):

> Where self-representation is used, the details entered in the Declarant (DE 3/17 or 3/18) and Importer (DE 3/15 or 3/16) data elements **should be the same** and Additional Information (AI) code **00500** must be declared in DE 2/2. DE 3/19, 3/20 and 3/21 (Representative) should be left blank.

## Root cause (FC-MPVNPBLP + FC-MPWQSJ97)

| Submit | Declarant / Importer EORI | Result |
|--------|---------------------------|--------|
| FC-MPVNPBLP | `GB243617410764` (Dev Hub test user) | 2× CDS12005 R123 + R038 |
| FC-MPWQSJ97 | `GB531765313922` (Dev Hub test user) | **Same** 2× CDS12005 |

Payload shape is correct (00500 + Importer, TransactionNatureCode, etc.). Submitted EORIs (`GB243617410764`, `GB531765313922`) are **not listed** in the TDL spreadsheet; CDS returns CDS12005 (“not recognised”) on Declarant/Importer. **Inference only:** Trade Test may require TDL-loaded party IDs — **not proven** that re-creating the test user with TDL `eoriNumber` fixes CDS12005 (same create-test-user service whether UI or API).

**Trade Test Data Library** (cover sheet abstract, `trade-test-data-library-cover.csv`):

> The document provides a summary of all the test profiles that have been **configured and loaded into Trade Test**. Each test profile (EORI) represents a dummy “trader”…

**Customs Declarations API v2.0** (sandbox setup):

> To use an **EORI from the Test Data Library**, provide it as part of the request [when creating a test user].

## Retracted “fix” (was overstated)

Earlier notes claimed: *re-create via Create Test User API (not web) + `customs-services` + TDL `eoriNumber` → clears CDS12005.*

**Correction:** Developer Hub UI and Create Test User API are the **same** `api-platform-test-user` service. That advice is **not** a distinct remedy. **Never tested** here: create user with TDL `eoriNumber` → submit → DMSACC.

**Unverified experiment (user must confirm before any HMRC call):** pick an EORI from the current TDL sheet, create test user with `customs-services` (+ `eoriNumber` if supported), OAuth, align Declarant/Importer/`HMRC_EORI`, one submit.

`X-Submitter-Identifier` is set from `lane.eori` in `src/app/api/hmrc/submit/route.ts` → `fetchHmrc`.

## Submitter header (verified in code)

`src/app/api/hmrc/submit/route.ts` line 436 passes `lane.eori` to `fetchHmrc`, which sets `X-Submitter-Identifier` when present (`src/lib/hmrc-fetch.ts` line 78). No code change required if declaration EORI matches env.
