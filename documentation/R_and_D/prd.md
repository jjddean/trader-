---
title: Product Requirements Document (PRD)
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Product Overview
freightcode® is an intelligent, B2B SaaS platform designed to modernize UK customs clearances. It bridges the accessibility gap between HMRC's Customs Declaration Service (CDS) and the 99% of businesses that lack the specialist knowledge to interpret or directly access their own customs data.

# 2. Target Audience & Personas
- **The SME Importer:** Frustrated by hidden broker fees, lack of visibility into clearance delays, and manual duty payment processes. Needs an aggregated view of their import health and a simple way to pay HMRC.
- **The Digital Freight Forwarder:** Manages hundreds of clearances a day. Needs an automated way to pull data from client invoices (AI extraction) and submit exact WCO-compliant JSON payloads to HMRC without using legacy, clunky desktop software.

# 3. Core Problems Solved
1. **The Data Gap:** Accessing historical HMRC data currently requires complex manual CSV requests or expensive enterprise integrations.
2. **The "Data Entry" Bottleneck:** Typing out an 80-field declaration is error-prone.
3. **The Payments Bottleneck:** Port clearance is frequently delayed while Importers manually execute BACS payments for 5-figure tax bills.

# 4. Product Features (MVP vs. Future Phases)

## 4.1 Phase 1: Historical Data & Analytics (Current)
- **Ingestion Pipeline:** Allow users to forward HMRC "Report Ready" CSVs to a unique webhook email to automatically populate their dashboard.
- **Compliance Scorecard:** Visualize standard vs. simplified clearance ratios, broker errors, and duty relief utilization.
- **Savings Sandbox:** Highlight shipments where Preferential Origin (e.g., DCTS or EUR.1) was valid but not claimed, showing explicit £ value lost.

## 4.2 Phase 2: Actionable Declarations
- **AI Invoice Extraction:** Direct upload of commercial invoices (PDF) to auto-extract line items, supplier data, and values.
- **Smart Pre-fill Engine:** Fuzzy matching against historical data (Phase 1) to auto-suggest HS Commodity Codes and origin preferences for new items.
- **HMRC Submission Wrapper:** 1-click submission of the payload directly to the HMRC `Customs Declarations API` (sandbox testing).

## 4.3 Phase 3: Fintech & Payments
- **Open Banking Integration:** A "Pay Now" button utilizing TrueLayer or Stripe Connect to instantly route Import Duty & VAT directly from the importer's checking account to HMRC, avoiding credit card swipe fees.
- **Duty Deferment Alerts:** Real-time tracking of HMRC credit limits with automated alerts.

# 5. Success Metrics (KPIs)
- **Adoption:** Number of historical declarations processed per active workspace.
- **Efficiency:** Average time to draft a new declaration (Target: < 3 minutes, down from industry avg of 15 mins).
- **Monetization:** Conversion rate from Free (Analytics) to Pro (£99/mo Automation tier).

# 6. Out of Scope for v1.0
- Complex multi-modal transit bonds (T1/T2).
- Non-UK customs authorities (e.g., direct integration with French Delta-G). Focus is strictly on UK CDS.
