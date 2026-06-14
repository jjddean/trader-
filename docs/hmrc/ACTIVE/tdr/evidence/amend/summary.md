# TDR v1 — Amend evidence (COR)

**Outcome:** DMSRES (FunctionCode 07) — COR amendment accepted, VersionID 2.

| Field | Value |
|-------|--------|
| MRN | `26GB6HZPT2QN2U8AR7` |
| Submit LRN | `FC-MQCO7IX1` |
| Amend LRN | `AM-zqmrw49eqhnpwtz95kh88kxqx-V5SU4Y` |
| Amend HTTP | 202 Accepted |
| Amend X-Conversation-ID | `18ab42e9-9f26-4648-9b9f-de35d8b1e4c1` |
| DMSRES FunctionalReferenceID | `45215bbdd2dc43e083e045fe355039c1` |
| DMSRES IssueDateTime | `2026-06-13T18:20:25Z` |
| Change | Item price COR → GBP 8000.00 (header + item 68A) |
| ChangeReasonCode | 21 |
| VersionID after amend | 2 |

## Timeline (UTC, app Status page)

| Time | Event |
|------|--------|
| 2026-06-13 19:04:13 | Declaration submitted |
| 2026-06-13 19:10:14 | DMSACC |
| 2026-06-13 19:11:12 | FC 02 — amend message ack (no validation errors) |
| 2026-06-13 19:11:13 | DMSCLE + DMSTAX (VersionID 2) |
| 2026-06-13 19:20:26 | **DMSRES (FC 07)** — amendment accepted |

Amend sent ~58s after DMSACC (within 1–2 min window).

## Environment

- ✅ `.env.local`: `NEXT_PUBLIC_HMRC_ENV=tdr`, `HMRC_ENVIRONMENT=sandbox`
- ✅ No `HMRC_DECLARATIONS_ACCEPT` override → `declarationsAcceptHeader()` = `application/vnd.hmrc.1.0+xml`
- HMRC `Accept` is set server-side in `fetchHmrc()` (not visible in browser Network tab)

## Files

| File | Description |
|------|-------------|
| `response-dmsres.xml` | Raw DMSRES notification |
| `summary.md` | This file |

Optional: export amend request XML from browser Network tab → `request.xml`.
