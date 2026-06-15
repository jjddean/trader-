# Backup & disaster recovery one-pager

**Product:** Freightcode · **Last updated:** 2026-06-15  
**Detail:** [`documentation/R_and_D/disaster_recovery_plan.md`](../../../../documentation/R_and_D/disaster_recovery_plan.md)

---

## Objectives

Minimise downtime for customs declaration workflows. Target: restore service within hours, not days; no silent data loss on declarations or notifications.

---

## Infrastructure

| Component | HA / backup |
|-----------|-------------|
| **Vercel** | Edge deployment; rollback via previous deployment |
| **Convex** | Managed replication; point-in-time recovery (Convex dashboard) |
| **Cloudflare R2** | Versioned reference datasets (`v2026-*.json` paths) |
| **Clerk / Stripe** | Vendor-managed SLAs |

---

## Data classification

| Data | Store | Backup |
|------|-------|--------|
| Declarations, items, notifications | Convex | Convex PITR + export |
| HMRC OAuth tokens | Convex `hmrc_tokens` | Convex PITR |
| Large reference files | R2 | Versioned object keys |
| Uploaded documents | Convex storage | Convex-managed |

---

## Dependency failures

| Dependency | User-visible behaviour |
|------------|------------------------|
| **HMRC CDS down** | Submissions queue/retry; status from HMRC notifications when available |
| **Convex down** | Dashboard read/write unavailable; webhooks may 5xx until restored |
| **Stripe down** | Billing portal/checkout unavailable; declarations unaffected |

---

## Incident response (summary)

1. **Detect** — Vercel errors, Convex alerts, user reports, HMRC status.
2. **Triage** — P1 = cannot submit/view declarations; P2 = billing/AI only.
3. **Mitigate** — Vercel rollback; Convex restore if data corruption; disable feature flags if needed.
4. **Communicate** — Status to affected users; HMRC SDST if production CDS impact.
5. **Post-mortem** — Within 48h for P1; update [`REMEDIATION-LOG.md`](./REMEDIATION-LOG.md) if security-related.

---

## Recovery tests

| Test | Frequency |
|------|-----------|
| Vercel rollback drill | Before major release |
| Convex dev → prod deploy smoke | Each release |
| TDR regression (`npm run test:tdr`) | Each HMRC mapping change |
| Webhook smoke (challenge + signed POST) | After env/deploy change |
