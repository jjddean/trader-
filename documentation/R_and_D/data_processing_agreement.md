---
title: Data Processing Agreement (DPA)
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Overview
This Data Processing Agreement ("DPA") is incorporated into, and is subject to the terms and conditions of, the freightcode® Terms of Service. This document reflects the parties' agreement with respect to the processing of Personal Data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.

# 2. Roles of the Parties
In the context of this Agreement:
- **The User (You, the Client Company)** acts as the **Data Controller**. You decide what commercial and personnel data is uploaded into freightcode (e.g., employee details, supplier details on commercial invoices).
- **freightcode®** acts as the **Data Processor**. We process this data strictly on your behalf and in accordance with your documented instructions via the use of our software platform.

# 3. Processing Instructions
freightcode will only process Personal Data to provide the Services as outlined in the Terms of Service. This includes parsing uploaded invoices, synchronizing data with HMRC APIs, and storing historical clearance records. We will not use the data for any independent or secondary commercial purposes (like selling trade data to third parties).

# 4. Sub-processors
You authorize freightcode to engage Sub-processors to deliver the Services. Our core Sub-processors include:
- **Convex:** For primary database hosting and serverless functions (Encrypted data at rest).
- **Vercel:** For edge hosting and network routing.
- **Clerk:** For identity and session management.
- **OpenAI / Anthropic:** Explicitly bound by Enterprise zero-retention policies for parsing unstructured text from uploaded PDFs.

We will provide at least 30 days' notice of any intended changes concerning the addition or replacement of Sub-processors.

# 5. Security Measures
freightcode shall implement and maintain appropriate technical and organizational security measures to protect Personal Data against unauthorized or accidental access, loss, alteration, or disclosure. This includes AES-256 encryption at rest, TLS 1.2+ for data in transit, and strictly scoped Role-Based Access Controls (RBAC).

# 6. Incident Management
In the event of a confirmed Personal Data Breach affecting your data, freightcode shall notify you without undue delay (and in any event, within 48 hours of becoming aware of the breach). We will provide reasonable assistance to help you meet your own regulatory obligations under the UK GDPR.

# 7. Return or Deletion of Data
Upon termination of your account or at your written request, freightcode will delete all User Personal Data from our active systems, unless UK or EU law requires the storage of such Personal Data (e.g., official HMRC customs audit trails which may be required to be held for taxation periods).

---
*Disclaimer: This is a draft commercial agreement framework. It must be reviewed and formalized by qualified UK legal counsel prior to enterprise distribution.*
