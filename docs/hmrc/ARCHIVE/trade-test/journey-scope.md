# Trade Test journey scope — Freightcode

**Source:** CDS RunBook V4.3 slide 6 — “all declaration types and procedures”; Freightcode product scope is import broker SaaS (H1 frontier first).

## In scope (TT — proven or active)

| Journey | Spec | TT evidence |
|---------|------|-------------|
| H1 import frontier, goods arrived (Type A / IMA) | `spec/lane.md` | DMSACC FC-MPYAJ7RN |
| DMSREJ burn-down (negative) | `spec/errors-handled.md` | Multiple LRNs |
| Dry-run preflight (no HMRC submit) | `test-evidence/run-hmrc-scenarios.js` | Gate before submit |

## In scope (TT — software ready, scenario not yet run)

| Journey | Notes |
|---------|--------|
| Amend (FC 13) | `POST /api/hmrc/amend` + status page button |
| Cancel (FC 13 + INV) | `POST /api/hmrc/cancel` + status page button |
| Pull notifications | `GET /api/hmrc/notifications/pull` + post-submit schedule |
| Status query | `GET /api/hmrc/status-query` + status page button |
| DMSCLE / DMSROG / DMSCTL / DMSINV / DMSTAX | Parser + precedence — see `tests/h1/` |

## Deferred to TDR (not blocking Pre-TDR request)

| Journey | Reason |
|---------|--------|
| H2 warehousing / supplementary Y/Z | Separate data sets + TDL profiles |
| Export A–Z + inventory linking | Runbook TT/TDR export matrix; not product v1 |
| Secure document upload E2E | API exists; not on passing lane |
| Full quota / CAP / security deposit | Runbook TT out-of-scope items |

## Second TT scenario (optional before TDR)

Pick **one**: duplicate passing lane with intentional DMSREJ (wrong supp unit qty `0`) **or** wait and run unhappy path only in TDR with real declarant data.
