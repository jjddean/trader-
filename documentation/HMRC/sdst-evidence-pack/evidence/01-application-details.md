# §1 — Application details

| Field | Value | Done |
|-------|-------|------|
| Organisation name | **Freightcode** *(confirm legal entity if HMRC ask)* | [x] |
| Hub user (admin) | Jason Dean | — |
| Sandbox application name | **freightcode** | [x] |
| Sandbox application ID | `b74874e9-957e-4a40-b426-0cde839f8a45` | [x] |
| Production application name | **freightcode** | [x] |
| Production application ID | Pending — ID to follow when HMRC issues credentials | [x] |
| SaaS / on-premise | SaaS (Vercel + Convex) | [x] |
| Notifications | Push webhook | [x] |
| Sandbox callback URL | `https://cf94-62-31-164-236.ngrok-free.app/api/hmrc/webhooks/notify` (Hub challenge validated 2026-06-04) | [x] |
| Production callback URL | `https://www.freightcode.co.uk/api/hmrc/webhooks/notify` | [x] |

**Hub (freightcode sandbox):** Declarations 1.0+2.0, Information 1.0+2.0, Pull Notifications 1.0. Trade Test calls: **Declarations 2.0**, **Information 1.0+xml**.

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
