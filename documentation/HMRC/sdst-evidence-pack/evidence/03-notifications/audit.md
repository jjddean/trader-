# Notification audit — FC-MPYAJ7RN / 26GB63M1I0RQFCVAR4

**Audited:** 2026-06-03 submit; **updated 2026-06-04** (DMSCLE observed)

## Scenario 1 happy path (complete)

| Step | Type | FunctionCode | Timestamp (UTC) |
|------|------|--------------|-----------------|
| Accept | DMSACC | `01` | `2026-06-03T16:38:33Z` |
| Document check | DMSDOC | `10` | (between accept and clear) |
| Clear | **DMSCLE** | `11` | **`2026-06-04T18:56:07Z`** (UK UI 19:56:07) |

Full correlation table: **`scenario-1-happy-path.md`**.

## Other observed (live, HMRC-sourced)

| Type | FunctionCode / signal | Notes |
|------|----------------------|-------|
| DMSTAX | `13` + NameCode `67` | Indicative customs debt |
| DMSTAX | `13` + NameCode `4` | Payment ref on duty block |
| DMSACC family | `09` | Further acceptance-related message (A2/AFB) |

## Not observed on this MRN

| Type | Handler status |
|------|----------------|
| DMSROG / DMSCTL / DMSREQ / DMSRCV | Parser + UI labels implemented; no live sample on this MRN |

## Evidence gaps

- **Submit `X-Conversation-ID`:** not yet in `LOG.md` — copy from declaration / submit banner into `scenario-1-happy-path.md` and ODT.
- **DMSCLE raw XML:** paste into `dmscle-snippet.xml` from UI (stub timestamp only until pasted).
