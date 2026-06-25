# Admin small gaps checklist

Track admin ops gaps that can block users or force manual intervention.  
**Related:** [`BACKLOG.md`](../hmrc/ACTIVE/tdr/BACKLOG.md) P2 #18 (billing gate for live orgs).

---

## Critical

- [x] **1. Pre-live guard on org flip** — block if production HMRC creds missing or no active org OAuth; simple confirm when clear (no checklist UI)
- [ ] **2. Admin HMRC reconnect** — support cannot fix another user's expired OAuth from admin
- [ ] **3. User onboarding in admin** — invites, org creation, waitlist, `role: admin` still in Clerk / `ADMIN_EMAILS`
- [ ] **4. Customer Stripe visibility** — no read-only view of active / trialing / past_due before live
- [ ] **5. Webhook / notification ops** — no last webhook time or admin pull trigger
- [ ] **6. Audit log on `setOrgMode`** — customer guide expects auditable mode changes
- [ ] **7. Live health probes** — `/api/health` checks env presence only, not reachability

---

## Polish / clarity

- [ ] Rename `/dashboard/admin/clerk` → declarations (route name misleading)
- [ ] Overview counts — `getOverview` samples `.take(1000)`; label or aggregate honestly
- [ ] Notifications table — link rows to declaration timeline
- [ ] Remove unused Convex queries (`listUsers`, `getHmrcConnections`, `getOldLogs`)

---

## Done log

| Date | Item | Notes |
|------|------|-------|
| 2026-06-23 | #1 Pre-live guard | Server block + alert on blockers; no modal checklist |
