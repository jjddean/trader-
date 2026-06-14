# CDI status query — why some MRNs returned 404 (for SDST)

**Endpoint:** `GET /customs/declarations-information/mrn/{mrn}/status`  
**HMRC error:** HTTP **404**, code **CDS60001**, message *Declaration not found*

---

## What SDST asked

Confirm **reason** for 404s on earlier tests, and provide **up-to-date tests returning HTTP 200**.

---

## Up-to-date test — HTTP 200 (ODT §5.2)

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-12 ~16:51 |
| MRN | `26GB6GFBKLT2N0TAR6` |
| Submit path | Trade Test **v2.0** Declarations (`application/vnd.hmrc.2.0+xml`) |
| Query Accept | `application/vnd.hmrc.1.0+xml` (sandbox Information API) |
| HTTP | **200** |
| ICS | **14** |
| X-Conversation-ID | `1da7b09a-339a-4730-afa1-7c9cbaa43e32` |
| DMSACC | 2026-06-12T16:51:31Z |

Recorded in **CDS-Production-Checklist-v1.2-FILLED.odt** §5.2 and `summary-retest-2026-06-12.md`.

Earlier **Trade Test v2.0** MRN `26GB63M1I0RQFCVAR4` (2026-06-04) also returned HTTP **200**, ICS **22**.

---

## MRNs that returned 404 (CDS60001)

| MRN | Submit context | Query date | HTTP | Notes |
|-----|----------------|------------|------|-------|
| `26GB6DTVT5133M7AR0` | TDR v1.0 DMSACC `FC-MQ8IDIYS` (2026-06-10) | 2026-06-11 | 404 | Frozen TDR baseline |
| `26GB6F8QX9AC62SAR0` | TDR v1.0 amend test | 2026-06-11 | 404 | Same probe session |
| `26GB6I2VFHAN3WAAR0` | TDR v1.0 cancel evidence (2026-06-13) | 2026-06-13 | 404 | DMSINV accepted on Declarations API |

Probe file: `docs/hmrc/ACTIVE/tdr/evidence/status-query/cli-test-2026-06-11.json`  
TDR follow-up: `docs/hmrc/ACTIVE/tdr/evidence/status-query/summary-2026-06-13.md`

---

## Reason (root cause — our analysis)

1. **Not authentication** — OAuth token valid; HMRC returns **404** not **401** / `INVALID_SCOPE`. Scope includes `write:customs-declarations-information`.

2. **Not invalid MRN format** — would be **400** / CDS60002.

3. **Not wrong client route** — same app route `/api/hmrc/status-query` and same HMRC path; **Trade Test v2.0** MRNs on the same sandbox app return **200**.

4. **Pattern:** 404 occurs when querying MRNs from declarations **submitted via TDR v1.0 Declarations API** (`Accept: application/vnd.hmrc.1.0+xml`, subscription enabled 2026-04-01 per SDST). **200** occurs when querying MRNs from declarations **submitted via Trade Test v2.0 Declarations API** (`Accept: application/vnd.hmrc.2.0+xml`).

5. **Conclusion:** The Customs Declarations Information API on **test-api** does not appear to index (or expose) declarations created through the **v1.0 Beta Declarations** subscription, while it does index **v2.0 Trade Test** submissions. This is a **platform / index behaviour**, not a defect in our CDI client integration.

6. **Separate TDR programme:** We continue TDR v1 evidence (submit/amend/cancel/notifications) under `docs/hmrc/ACTIVE/tdr/`. CDS ODT status-query proof uses **Trade Test v2.0** submit MRNs as above.

---

## Question for SDST

Should TDR v1.0 sandbox declarations be queryable via CDI on `test-api`, or is HTTP 200 evidence for the ODT expected only from **Trade Test v2.0** submissions until production host credentials are issued?

---

## Client configuration (unchanged)

| Setting | Value |
|---------|-------|
| Sandbox app ID | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| Host | `https://test-api.service.hmrc.gov.uk` |
| CDI Accept (sandbox) | `application/vnd.hmrc.1.0+xml` |
