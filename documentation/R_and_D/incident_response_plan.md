---
title: Incident Response Plan (IRP)
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Objective
This document outlines the systematic procedure the freightcode® engineering and security teams will follow to manage, contain, and resolve critical incidents, specifically focusing on data breaches or prolonged HMRC API disconnections.

# 2. Incident Classification definitions
- **P1 (Critical):** Complete platform outage, active data breach, or catastrophic database failure preventing all users from submitting declarations.
- **P2 (High):** Core feature failure (e.g., Open Banking payments drop down, but manual declarations still work), or significant HMRC API latency affecting >20% of users.
- **P3 (Medium):** Localized UI bugs, isolated AI extraction failures on specific edge-case invoices.

# 3. Response Protocol (The 4 Phases)

## Phase 1: Preparation & Detection
- **Monitoring:** Sentry captures application exceptions; Vercel Analytics monitors HTTP error rates; Convex dashboard tracks query latency.
- **Alerting:** Any spike >2% error rate triggers an automated PagerDuty alert to the On-Call Engineer.

## Phase 2: Containment & Triage (Target: < 30 Mins)
- For Data Breaches: Instantly revoke the compromised API keys or Clerk authentication tokens. If a Convex database infiltration is suspected, apply strict read-only lock rules to the affected table.
- For Bad Deployments: Initiate a 1-click rollback to the previous stable Vercel deployment block.
- **Communication:** Update `status.freightcode.com` to "Investigating".

## Phase 3: Mitigation & Eradication (Target: < 2 Hours)
- Apply the patch required to resolve the vulnerability or fix the broken UI state.
- If dealing with HMRC CDS API sync issues, parse the queued `Pending Retry` webhooks and initiate a controlled replay script to prevent rate-limiting upon reconnection.

## Phase 4: Recovery & Post-Mortem
- Re-enable suspended systems after verifying integrity.
- **External Notification:** If Personal Data was exposed, notify affected users and the Information Commissioner's Office (ICO) within 72 hours, per UK GDPR requirements.
- **Root Cause Analysis (RCA):** Within 48 hours of resolution, draft an RCA detailing *Why* it happened, *How* it was fixed, and *What* architectural changes are required to ensure it never happens again.
