> **ARCHIVED** — This document describes the TDR (v1.0) phase which is not the current active environment.
> The system currently runs on **Trade Test v2.0** (sandbox) and **v2.0** (production).
> This file is preserved for reference only. Do not use for configuration or operational decisions.

# HMRC Trader Dress Rehearsal (TDR) Readiness

This document outlines the objectives, configuration requirements, and the strict operational standards for the **Trader Dress Rehearsal (TDR)** phase of the HMRC Customs Declarations Service (CDS) integration.

## 🎯 Objective
The primary goal is to finalize the platform's readiness for **Trader Dress Rehearsal (TDR)**, the final staging environment before moving to live Production. This ensures the application can submit declarations and receive asynchronous notifications (via the Push Webhook) accurately and reliably.

## 💂️ The Strict Nature of TDR
Trader Dress Rehearsal is **not** a development sandbox; it is a simulation of the live Production environment.
*   **Whitelisted Execution**: TDR is carried out by whitelisted test users in the **Production environment** (using production-level credentials).
*   **Zero-Guessing Policy**: HMRC expects developers to have completed all functional testing in the Sandbox "Trade Test" phase (using `v2.0` headers). Entering TDR with "guessed" configurations or technical errors can lead to delays in production approval or direct rejection of the software application.
*   **Production Parity**: TDR must mirror live declaration lifecycles, including correct EORI numbers, real-world transport identifiers, and accurate commodity codes.

## 🛠️ Environment Configuration (Strict Compliance)

| parameter | Value / Rule | Description |
| :--- | :--- | :--- |
| **HMRC_ENVIRONMENT** | `production` | TDR is a production simulation; it uses the Production API Gateway. |
| **Accept Header** | `application/vnd.hmrc.1.0+xml` | **v1.0** is the mandatory version for the TDR phase. |
| **API Endpoints** | `https://api.service.hmrc.gov.uk/...` | Must target the Production URLs, not `test-api`. |
| **Authorization** | OAuth 2.0 (Authorization Code Flow) | Use Production Application Client ID and Secret. |
| **Fraud Prevention**| Mandatory | Headers like `Gov-Client-Public-IP`, `Gov-Client-Device-ID`, etc., must be present and correctly formatted. |

## 🔗 Webhook & Notifications
TDR requires a functioning **Public Webhook Handler** to receive real-time status updates (DMSACC, DMSCLE, etc.) from HMRC.
*   **Webhook Endpoint**: `https://0eea-62-31-164-236.ngrok-free.app/api/hmrc/webhooks/notify`
*   **Function**: Parses incoming XML, extracts the Movement Reference Number (MRN) and Conversation ID, and updates the internal database status.

## ✅ Verification Protocol
Before any TDR submission is sent:
1.  **Schema Check**: XML must be validated against the WCO Data Model 3.6 schema.
2.  **Credential Check**: Ensure the token is a valid Production-level OAuth token.
3.  **Header Check**: Confirm all `Gov-Client-*` headers match the real-world connection metadata.
4.  **Zero-Guessing Check**: No "guessed" values or experimental logic in the submission path.
