# TDR v1 — Cancel evidence (invalidation)

**Outcome:** DMSINV (FunctionCode 02) — cancellation accepted, declaration no longer active.

| Field | Value |
|-------|--------|
| MRN | `26GB6I2VFHAN3WAAR0` |
| Cancel LRN | `CX-kn78tw6ms6bdnjvp4r1mdnz7v188j528` |
| Cancel HTTP | 200 OK |
| Cancel X-Conversation-ID | `4646aa3d-48ac-4654-aef2-646c806d3c33` |
| DMSINV FunctionalReferenceID | `0f1bda0c70cf4ec88689e43d5a49d1dd` |
| DMSINV IssueDateTime | `2026-06-13T19:38:51Z` |

## Timeline (UTC, app Status page)

| Time | Event |
|------|--------|
| 2026-06-13 20:32:22 | Declaration submitted |
| 2026-06-13 20:38:52 | DMSDOC (document check) |
| 2026-06-13 20:38:52 | **DMSINV (FC 02)** — cancellation accepted |

## Environment

- ✅ `.env.local`: `NEXT_PUBLIC_HMRC_ENV=tdr`, `HMRC_ENVIRONMENT=sandbox`
- ✅ `Accept: application/vnd.hmrc.1.0+xml` via `declarationsAcceptHeader()`

## Files

| File | Description |
|------|-------------|
| `response-dmsinv.xml` | Raw DMSINV notification |
| `summary.md` | This file |

Optional: export cancel request XML from browser Network tab → `request.xml`.
