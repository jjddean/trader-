---
title: Disaster Recovery (DR) & Business Continuity Plan
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Objectives
The critical nature of port clearances means any downtime for freightcode® could result in goods stuck at border control, causing demurrage fees for our clients. This plan outlines the automated redundancies ensuring High Availability (HA) and rapid disaster recovery.

# 2. Infrastructure Redundancy
- **Frontend & API Routes (Vercel):** The Next.js application is deployed on Vercel's Edge Network, ensuring global CDN distribution. If a specific availability zone fails, traffic is automatically routed to the nearest healthy node without manual intervention.
- **Database (Convex):** Convex runs on highly available cloud infrastructure with automatic, real-time replication. Single-node failures do not result in data loss or significant downtime.

# 3. Data Backup Strategy
- **Continuous Backups:** Convex automatically manages streaming backups.
- **Point-in-Time Recovery (PITR):** In the event of catastrophic data corruption (e.g., a buggy migration script deleting production records), we can restore the database state to any specific minute within the retention window.

# 4. Critical External Dependencies

## 4.1 HMRC API Outages
If the HMRC Customs Declaration Service (CDS) experiences downtime:
- **Fallback Action:** freightcode will queue all submitted `declarations` with a `Pending Retry` status.
- **User Communication:** The dashboard will display a banner pulling from HMRC's official status page, ensuring users do not assume the fault lies with freightcode.

## 4.2 Open Banking (TrueLayer/Stripe) Outages
If the primary PISP is unavailable to process duty payments:
- **Fallback Action:** The "1-Click Pay" button will dynamically disable, reverting to providing the user with standard BACS/CHAPS manual transfer instructions and the unique CDSI reference code required by HMRC.

# 5. Incident Response Protocol
1. **Detection:** Automated alerts trigger via Vercel Analytics or Sentry if error rates exceed 2% or API latency spikes.
2. **Triage:** Engineering on-call investigates. If the issue is a P1 (Critical Outage), a status update is immediately posted to `{status.freightcode.com}`.
3. **Mitigation:** If via a recent deployment, an instant 1-click rollback is performed on Vercel.
4. **Post-Mortem:** Within 48 hours of resolution, a Root Cause Analysis (RCA) is generated and published internally to prevent recurrence.
