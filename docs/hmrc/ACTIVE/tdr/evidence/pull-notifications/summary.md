# TDR v1 — Pull notifications

**Date:** 2026-06-13  
**Outcome:** HTTP **200** — 0 new notifications saved (queue empty / already pulled)

| Field | Value |
|-------|--------|
| M_REGNUM | `26GB6I2VFHAN3WAAR0` |
| Route | `GET /api/hmrc/notifications/pull?declarationId=…` |
| Conversations scanned | **2** (submit + cancel) |
| Saved | **0** |
| App message | Pull notifications OK (200) — queue empty or already pulled |
| Timeline | Submit, DMSDOC, DMSINV present — complete |

## Interpretation

Pull API succeeded. Zero new rows means HMRC unpulled queue had nothing left to retrieve — notifications were already stored (earlier pulls / same-session delivery). This is **PASS** for TDR pull path evidence.

Optional: paste Network JSON from pull response → `response.json`.
