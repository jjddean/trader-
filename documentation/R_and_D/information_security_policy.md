---
title: Information Security Policy (InfoSec)
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Purpose
Due to freightcode® processing official taxation data (HMRC) and interacting with financial APIs (Open Banking), strict Information Security measures are mandated to protect the confidentiality, integrity, and availability of user data.

# 2. Data Protection at Rest and in Transit
- **In Transit:** All data transmitted between the client (browser), the Next.js middle-tier, and Convex databases is encrypted using TLS 1.2 or higher.
- **At Rest:** The Convex backend encrypts all stored data at rest using industry-standard AES-256 encryption.
- **Secrets Management:** Environment variables (e.g., `HMRC_CLIENT_SECRET`, Stripe Keys) are stored securely in Vercel's Environment Variables vault and are never exposed to the client-side JavaScript bundle.

# 3. Third-Party Integration Security
- **OAuth Tokens:** HMRC OAuth refresh tokens are securely stored in the Convex database against the specific Workspace. These are routinely rotated automatically per HMRC API session guidelines.
- **Open Banking:** Payment details and banking credentials are never seen, stored, or processed by freightcode. TrueLayer or Stripe Connect handles the secure authorization directly with the user's banking institution. Our servers only handle abstract "Payment Intents" and Webhook success confirmations.

# 4. Access Control
- **Authentication:** All user authentication is strictly handled via Clerk (OAuth, MFA supported).
- **Authorization:** Role-Based Access Control (RBAC) ensures users can exclusively access records linked to their specific `workspaceId`. Direct unauthenticated reads/writes to Convex are physically blocked via database security rules.
- **Internal Access:** Engineering access to production Convex databases is strictly limited, audited, and secured via 2FA.

# 5. Application Security & AI Inputs
- **File Uploads (Invoices):** Uploaded PDFs submitted for AI extraction (`/api/ai/extract`) are streamed directly in memory and processed. They are not stored permanently on freightcode servers unless explicitly requested into a long-term Document vault (AWS S3).
- **LLM Data Masking:** Currently, standard invoice extraction does not process personally identifiable information (PII) beyond B2B public trading names. If sensitive PII is detected, it will be masked prior to transmission to OpenAI/Anthropic APIs.

# 6. Audit Logging
Every mutation against the `declarations` and `hmrcTokens` tables acts as an append-only log, leaving an audit trail denoting standard `userId`, `timestamp`, and the payload signature. This is crucial for FCA and HMRC regulatory audits.
