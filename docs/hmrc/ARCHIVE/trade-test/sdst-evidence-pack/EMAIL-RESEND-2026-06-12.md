# Email to SDST — CDS ODT resend (2026-06-12 retest)

**To:** softwaredevelopersupport@service.hmrc.gov.uk  
**Cc:** (your records)  
**Subject:** Freightcode — CDS Production Checklist v1.2 resubmit (cancel/amend endpoint retest)

---

Dear Agne / Software Developer Support,

Thank you for your follow-up on our CDS Production Checklist. We have completed the requested **Trade Test v2.0** retests using the **correct HMRC endpoint paths** and attach an updated **CDS-Production-Checklist-v1.2-FILLED.odt**.

## Retest summary (12 June 2026, sandbox)

| Flow | Endpoint | MRN | Outcome |
|------|----------|-----|---------|
| **Cancel** | `POST /customs/declarations/cancellation-requests` | `26GB6GFOZ64AZ37AR9` | HTTP 202 → **DMSINV** (invalidation accepted) |
| **Amend** | `POST /customs/declarations/amend` | `26GB6GDX92A21TIAR0` | HTTP 202 → **DMSRES** (FC 07, COR amendment accepted) |
| **Status query** | `GET .../mrn/{mrn}/status` | `26GB6GFBKLT2N0TAR6` | HTTP **200**, **ICS 14** |

Evidence summaries are in our pack under `evidence/04-cancel/`, `evidence/05-amend/`, and `evidence/07-status-query/` (retest files dated 2026-06-12).

## Application details

- **Organisation:** Freightcode  
- **Sandbox application:** freightcode — ID `b74874e9-957e-4a40-b426-0cde839f8a45`  
- **Production application name:** freightcode  
- **Production application ID:** `00292df9-e2e6-4d66-9d28-7d79a2a931ba` (from Get production credentials URL; sandbox ID `b74874e9-…` is separate)  
- **Production push callback URL:** `https://www.freightcode.co.uk/api/hmrc/webhooks/notify`  
- **Notification model:** Push (sandbox ngrok validated 2026-06-04; production URL registered in Hub)

## Status query 404 on earlier MRNs

Earlier sandbox status queries for TDR test MRNs returned **HTTP 404** with valid OAuth. Our fresh Trade Test v2.0 query on `26GB6GFBKLT2N0TAR6` returns **HTTP 200** (ICS 14). We believe the earlier 404s reflect sandbox Information API indexing timing or environment, not a client routing defect.

## Safety & Security (S&S) APIs — CDS scope only for this submission

For **this CDS Production Checklist** return, Freightcode is **import CDS declarations only**. We have **unsubscribed** from Safety & Security Import Notifications and Import Outcomes in Developer Hub (subscriptions set to **No** as of 12 June 2026).

The **SS-GB Production Application Checklist is not included** with this resubmission — we have no ENS evidence to provide at this stage.

**Please note:** we plan to add S&S / ENS capabilities in a **future product phase**. We are **not** asking you to revoke, block, or permanently disallow S&S API access on our application — only to treat S&S as **out of scope for this CDS ODT review**.

When we are ready for ENS, we will subscribe again in Developer Hub and return the SS-GB checklist separately.

## Attachments

1. `CDS-Production-Checklist-v1.2-FILLED.odt` (updated)  
2. Optional: zip of `evidence/` XML if you require raw notification payloads

Please confirm receipt and advise on production OAuth credentials when ready.

Kind regards,  
Jason Dean  
Freightcode
