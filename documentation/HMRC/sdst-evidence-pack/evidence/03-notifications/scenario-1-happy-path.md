# Scenario 1 — submit acceptance (Trade Test v2.0)

**Use for:** SDST §4.1 — valid import **accepted** by HMRC (DMSACC, 0 blocking errors).  
**Not for:** Production “goods cleared” journey — TT does not send real **DMSCLE** on accept-only MRNs (`TRADE-TEST-REALITY.md`).

## Correlation (baseline lane — `LOG.md`)

| Field | Value |
|-------|-------|
| **LRN** | `FC-MPYAJ7RN` |
| **MRN** | `26GB63M1I0RQFCVAR4` |
| **Submit (DMSACC)** | `2026-06-03T16:38:33Z` |
| **X-Conversation-ID (submit)** | `68edb212-5c4a-4ef7-9223-f55630c5859e` |
| **Lane** | HS `8471300000`, CPC `4000/000`, origin `DE` |

## Observed notification chain (accept path)

| Order | Signal | Notes |
|-------|--------|-------|
| 1 | DMSACC (FC `01`) | 0 blocking validation errors; CDS13000 advisory |
| 2 | DMSTAX (FC `13`) | NameCode 67 / 4 |

## Evidence files

| File | Status |
|------|--------|
| `dmsacc-snippet.xml` | Archived |
| `evidence/02-submit/` | Request XML + `scenario-summary.json` |
| `evidence/07-status-query/` | ICS 22 via information API |

## Cancel / DMSCLE on other MRNs

- **DMSINV** invalidation proof: `evidence/04-cancel/` (e.g. `26GB656DZN0FE7LAR0`, `26GB65EJN3BYSELAR9`).
- **DMSCLE (FC 11)** after cancel = TT lifecycle only — not §4.1 clearance.
