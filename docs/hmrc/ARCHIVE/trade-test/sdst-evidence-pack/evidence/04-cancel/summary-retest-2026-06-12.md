# Cancel (invalidation) — SDST retest 2026-06-12

**API:** `POST /customs/declarations/cancellation-requests` (FunctionCode 13, TypeCode INV).

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-12 |
| Submit LRN | FC-MQB46PCA |
| Cancel LRN | CX-kn7fh999tx3mnjg6s3fgmr39d188h8x1 |
| MRN | 26GB6GFOZ64AZ37AR9 |
| Cancel X-Conversation-ID | 521e8797-09cc-4f56-8caa-b0041fae6646 |
| Cancel HTTP | **202** (app message: Cancel OK 200 on API route) |
| DMSACC | 2026-06-12 17:01:55 UTC |
| DMSINV (invalidation accepted) | 2026-06-12 17:02:42 UTC |
| CDS Status in app | **Cancelled (DMSINV)** |
| DMSCLE same second | Trade Test noise — **not** cancel proof (see `TRADE-TEST-REALITY.md`) |
| DMSDOC FC10 | Document check — informational only |

Result: **PASS** — dedicated cancellation endpoint + DMSINV FC02 on fresh MRN.

Raw notification: `response-dmsinv-26GB6GFOZ64AZ37AR9.xml`
