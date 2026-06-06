# Notification audit — FC-MPYAJ7RN / 26GB63M1I0RQFCVAR4

**Audited:** 2026-06-03 submit. **Corrected 2026-06-06:** prior "DMSCLE observed" claim was wrong.

## Scenario 1 happy path (accept path — what TT actually sends)

| Step | Type | FunctionCode | Timestamp (UTC) |
|------|------|--------------|-----------------|
| Accept | DMSACC | `01` | `2026-06-03T16:38:33Z` |
| Tax | DMSTAX | `13` | after accept (NameCode 67 / 4) |

> **No DMSCLE on this MRN.** Trade Test v2.0 does not emit a genuine "goods cleared" DMSCLE on an accept-only MRN. The only FC 11 ever seen was post-cancel lifecycle noise (same second as DMSINV) on a cancelled MRN — not clearance. Authoritative: `TRADE-TEST-REALITY.md`.

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

- **Submit `X-Conversation-ID`:** `68edb212-5c4a-4ef7-9223-f55630c5859e` (in `scenario-1-happy-path.md`); ensure copied into ODT.
- **DMSCLE raw XML:** none exists for the accept path — see DMSCLE note above. `dmscle-snippet.xml` is a non-evidence stub.
