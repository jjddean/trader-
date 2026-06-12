# Notification audit — FC-MPYAJ7RN / 26GB63M1I0RQFCVAR4

**Audited:** 2026-06-03 (Trade Test v2.0)

## Observed (live, HMRC-sourced)

| Type | FunctionCode / signal | Notes |
|------|----------------------|-------|
| DMSACC | `01` | 0 validation errors; CDS13000 advisory only |
| DMSTAX | `13` + NameCode `67` | Indicative customs debt |
| DMSTAX | `13` + NameCode `4` | Payment ref on duty block |
| DMSACC family | `09` | Further acceptance-related message (A2/AFB) |

## Not observed on this MRN (accept-only)

| Type | Notes |
|------|-------|
| **DMSCLE** | **Not** on accept-only TT run — only seen after cancel on other MRNs (FC 11 noise) |
| DMSROG / DMSCTL / DMSREQ / DMSRCV | Parser + UI labels; no live sample on this MRN |

## Conclusion

- **Submit proof:** DMSACC + DMSTAX (`documentation/HMRC/sdst-evidence-pack/evidence/03-notifications/TRADE-TEST-REALITY.md`).
- **DMSCLE handler:** unit tests + webhook parser (`tests/h1/notification-parser.test.ts`); live FC 11 tied to cancel in TT, not goods clearance on accept.
