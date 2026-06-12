# Trade Test Data Library

| | |
|--|--|
| Source | HMRC CDS Test Data Library (cover sheet exported to `trade-test-data-library-cover.csv`) |
| Retrieved | 2026-06-02 |
| Related API | [Customs Declarations v2.0](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/2.0) — create test user with TDL EORI |

## What it is

From the library abstract:

> The document provides a summary of all the test profiles that have been **configured and loaded into Trade Test**. Each test profile (EORI) represents a dummy “trader” and has particular attributes, e.g. a particular deferment account number, the authority to export from a particular location, or a particular set of authorisations.

## Create test user (one service — not “web vs API”)

The [Developer Hub “Create test user” page](https://developer.service.hmrc.gov.uk/api-test-user) and the [Create Test User API](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/api-platform-test-user/1.0) are the **same** `api-platform-test-user` backend (UI vs `POST /create-test-user/…`). **Do not** treat “re-create via API” as a different fix from “create on the web page.”

[Customs Declarations API v2.0](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/2.0) sandbox setup says: request `"customs-services"` and, *“To use an EORI from the Test Data Library, provide it as part of the request.”* That is an optional `eoriNumber` on the create-test-user body — available whether you use the UI or the REST endpoint, if the UI exposes it.

**Not proven in this project:** that supplying a TDL `eoriNumber` at user creation clears **CDS12005** on Declarant/Importer. Romwan (`GB531765313922`) and Yasmine (`GB243617410764`) both failed CDS12005; neither EORI is in the TDL spreadsheet — that is empirical only.

## EORI in repo archive (historical — not active lane)

| EORI | Evidence |
|------|----------|
| `GB553202734852` | `test-evidence/archive-pre-p0/`; TDL changelog V23.0 — **not in use** on active laptop lane |

Obtain the full current TDL spreadsheet from HMRC CDS technical documentation / SDST when selecting profiles for new lanes.

## Active lane

See `docs/hmrc/ARCHIVE/trade-test/lane.md` — Declarant and Importer EORI **`GB531765313922`** (Romwan Lee OAuth profile).
