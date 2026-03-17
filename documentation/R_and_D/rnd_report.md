---
title: freightcode® Research & Development (R&D) Report
version: 1.0
date: March 2026
---

# 1. Executive Summary

This R&D report synthesizes the foundational research, technical architecture exploration, and regulatory strategy required to launch **freightcode®** into the UK market. The platform transitions traditional, manual customs clearance into an intelligent, AI-driven SaaS that bridges the gap between importers, HMRC's new Customs Declaration Service (CDS), and Open Banking.

The core problem identified is the **£570M Data Gap**: HMRC has modernized its infrastructure (CDS), but only 1% of businesses actively use government portals due to their technical complexity. freightcode provides the "Accessibility Layer" to this data.

# 2. HMRC API Integration Architecture

Our R&D established a robust pathway for direct communication with HMRC, bypassing legacy third-party Customs software (like Descartes or CHIEF systems).

## 2.1 Evaluated Endpoints
- **Customs Declarations API:** For submitting WCO-compliant JSON payloads directly to CDS.
- **CDS Notifications API:** An asynchronous Webhook receiver to handle XML status updates (e.g., clearance success, rejection codes).
- **Secure Document Upload API:** For submitting required PDFs (Form A, EUR.1) directly to HMRC's S3 buckets without passing heavy payloads through our primary servers.

## 2.2 Orchestration Strategy
The architecture relies on a Next.js App Router API wrapper (`/api/hmrc/...`) acting as a secure intermediary layer. It fetches draft `declarations` from the Convex database, injects the necessary User-Restricted OAuth Bearer tokens, formats the JSON string precisely to WCO specs, and manages the synchronous `202 Accepted` vs. asynchronous `Webhook` lifecycle.

# 3. AI & Automation Engine (The "Smart Pre-Fill")

Instead of forcing users to manually enter up to 80 strict data fields per declaration, the R&D phase focused on automating data ingestion.

## 3.1 Historical Data Sync
Since no direct HMRC API exists to pull comprehensive past declarations programmatically without high friction, we engineered an **Ingestion Pipeline**:
- Users request a CSV export from HMRC's "Report Ready" portal.
- Users forward the email with the CSV to a dedicated webhook (e.g., `userXYZ@ingest.freightcode.com`).
- A Convex backend worker parses the CSV and populates the `historical_declarations` table.

## 3.2 Machine Learning Applications
By structuring this historical data, we apply analysis layers:
- **Predictive Auto-Fill:** We built a fuzzy matching algorithm (`/api/ai/classify`) that takes unstructured goods descriptions and suggests the correct 10-digit HS Commodity Code based on proven past clearances.
- **Missed Savings Detection:** Queries identify declarations where a lower tariff rate (e.g., DCTS or Trade Agreements) was valid but not claimed, directly quantifying "money left on the table."

# 4. FinTech Integration: Open Banking for Customs

A major R&D breakthrough was identifying a frictionless payment loop for massive, sudden tax bills.

## 4.1 The "Payments" Problem
Once HMRC clears a declaration, they immediately demand Import Duty and Import VAT. Traditional software hands a reference number to the importer, who must then manually log into a corporate bank, set up a payee, and initiate a BACS transfer, often causing port delays.

## 4.2 The Solution
We researched leading UK Open Banking APIs to embed a **1-Click Settlement Button** directly within the freightcode dashboard. This allows the user to authorize a direct, immediate bank transfer.

## 4.3 Evaluated Partners
- **TrueLayer:** Selected as the top technical candidate for "Pay by Bank" capabilities due to their dominance in instant B2B account-to-account transfers, completely avoiding the percentage-based swipe fees of credit card networks (untenable for £20,000+ duty bills).
- **Stripe Connections:** Evaluated as a fallback for unified SaaS billing + Duty payment routing.

# 5. Regulatory Compliance Strategy (FCA)

By enabling massive tax movements across our platform, we evaluated the regulatory liability under the Financial Conduct Authority (FCA).

## 5.1 The "Technical Service Provider" Loophole
Our API architecture specifically dictates that freightcode **never holds or touches the funds**. We use an FCA-regulated partner (like TrueLayer) as the Payment Initiation Service Provider (PISP). TradeDNA/freightcode only passes the invoice amount and HMRC recipient details to the partner.

## 5.2 Engaging the Regulator
To ensure our AI Invoice Extraction and automated Open Banking workflows do not accidentally trigger heavy "Regulated Activity" requirements, we formulated a 2-part engagement plan:
1. **Innovation Pathways:** We will submit our conceptual architecture to the FCA to receive a dedicated Case Manager, ensuring our SaaS model is formally recognized as exempt from API/EMI regulations.
2. **Regulatory Sandbox:** If we later introduce active **Trade Finance** (e.g., automatically loaning companies working capital to pay their customs duties based on our AI's scoring of their import history), we will apply for the FCA Sandbox to test the lending product live without needing a full, immediate Part 4A Authorization.

# 6. Conclusion
The R&D phase has successfully derisked the technical integration with legacy government systems (HMRC) and identified modern, scalable solutions (Next.js serverless functions, Open Banking providers, and AI parsing) to build a Consumer-SaaS level experience in the archaic B2B customs industry.
