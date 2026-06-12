# Declaration Information API — status by MRN (SDST retest)

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-12 ~16:51 UTC |
| MRN | 26GB6GFBKLT2N0TAR6 |
| HTTP | **200** |
| X-Conversation-ID | 1da7b09a-339a-4730-afa1-7c9cbaa43e32 |
| Endpoint | GET `/customs/declarations-information/mrn/26GB6GFBKLT2N0TAR6/status` |
| Accept | `application/vnd.hmrc.1.0+xml` (sandbox Information API) |
| HMRC status field | **ICS 14** |
| DMSACC on timeline | 2026-06-12 16:51:31 UTC |
| App message | `Status query OK (200) — HMRC status: ICS 14` |

Result: **PASS** — fresh HTTP 200 for SDST resend (replaces reliance on June 2026 TDR MRN 404 probes).

**Optional:** paste full API JSON from browser Network → `status-query` into `response-retest-2026-06-12.json`.
