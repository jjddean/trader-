# §1 — Application details

| Field | Value | Done |
|-------|-------|------|
| Organisation name | **Freightcode** *(confirm legal entity if HMRC ask)* | [x] |
| Hub user (admin) | Jason Dean | — |
| Sandbox application name | **freightcode** | [x] |
| Sandbox application ID | `b74874e9-957e-4a40-b426-0cde839f8a45` | [x] |
| Production application name | **freightcode** | [x] |
| Production application ID | `00292df9-e2e6-4d66-9d28-7d79a2a931ba` (Hub Get production credentials URL, submitted 2026-06-12) | [x] |
| SaaS / on-premise | SaaS (Vercel + Convex) | [x] |
| Notifications | Push webhook | [x] |
| Sandbox callback URL | `https://cf94-62-31-164-236.ngrok-free.app/api/hmrc/webhooks/notify` (Hub challenge validated 2026-06-04) | [x] |
| Production callback URL | `https://www.freightcode.co.uk/api/hmrc/webhooks/notify` | [x] |
| Production webhook auth token | Matches `HMRC_WEBHOOK_AUTH_TOKEN` in `.env.local` / Vercel — Hub api-metadata 2026-06-12 | [x] |
| Push EORI (Hub metadata) | `GB531765313922` (OAuth submitter; declarations use `GB553202734852` per lane) | [x] |

**S&S (2026-06-12):** Safety & Security Import Notifications + Outcomes **unsubscribed** in Hub for this CDS return. SS-GB checklist **not** submitted. Future ENS phase — retain ability to resubscribe; do **not** ask SDST to permanently revoke S&S access.

**Hub (freightcode):** SDST confirmed production subscriptions 2026-06 — Declarations **1.0 (Beta)**, Information **1.0 (Beta)**, Push Pull Notifications **1.0 (Beta)**. Sandbox tests used Declarations **2.0** (Trade Test) and **1.0** (TDR).

**Production credentials:** Request submitted 2026-06-12. ODT §1 **Production Application ID** = UUID from Hub URL `…/developer/submissions/application/00292df9-e2e6-4d66-9d28-7d79a2a931ba/view-answers` — **not** the sandbox ID `b74874e9-…`. OAuth client secret issuance is still pending SDST approval (~10 working days).

## §2 Rate limit

| Choice | Done |
|--------|------|
| 3 requests per second | [x] |
| 8 requests per second | [ ] |

## §3 APIs in product

| API | Evidence |
|-----|----------|
| Customs Declarations | `02-submit/` through `06-file-upload/` |
| Customs Declarations Information | `07-status-query/` |
| Inventory Linking Exports | N/A |
| Bulk Data File List | N/A |

**ODT §3 narrative:** Trade Test v2.0 evidence (not TDR). Regenerate: `node test-evidence/fill-cds-odt.js`.
