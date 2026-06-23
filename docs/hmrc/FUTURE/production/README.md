# CDS Live — Production

TDR sandbox complete. Production application **approved** (2026-06-15).

| Content | Path |
|---------|------|
| Checklists | `checklists/` |
| Application forms | `forms/` |
| Ops log | [`../ACTIVE/tdr/evidence/LOG.md`](../ACTIVE/tdr/evidence/LOG.md) (Production / HMRC ops section) |
| Future expansion plan | [`../CDS-EXPANSION-BUILD-PLAN.md`](../CDS-EXPANSION-BUILD-PLAN.md) (B1 / I1 / C1) |

## Status

| Step | Status |
|------|--------|
| CDS Production Checklist returned | Done |
| Production app approved (SDST) | Done — 2026-06-15 |
| Developer Hub email verified | Done — 2026-06-15 |
| Production OAuth credentials | Retrieve from Developer Hub (store in Vercel; do not commit) |
| Push URL submitted to SDST | Done — 2026-06-15 |
| Production OAuth credentials in Vercel | When ready for cutover |

## Production config (submitted)

| Field | Value |
|-------|--------|
| Application ID | `00292df9-e2e6-4d66-9d28-7d79a2a931ba` |
| Push callback URL | `https://www.freightcode.co.uk/api/hmrc/webhooks/notify` |
| Notifications | Push only (Pull API removed from prod app) |
| APIs in scope | CDS declarations (import, export, simplified — per approved production checklist) |

Behaviour when live: [`../ACTIVE/tdr/AGENT-SPEC.md`](../ACTIVE/tdr/AGENT-SPEC.md) — update [`environment-matrix.md`](../ACTIVE/tdr/environment-matrix.md) on cutover.
