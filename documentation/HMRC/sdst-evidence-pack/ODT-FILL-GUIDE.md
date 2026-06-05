# CDS Production Checklist v1.2 — fill guide

Copy values into `forms/CDS-Production-Checklist-v1.2.odt`.  
Source of truth: `evidence/01-application-details.md` + `LOG.md` + evidence folders.

**Deadline:** return completed ODT to SDST within **14 days** of last sandbox test (**2026-06-05** file-upload → by **2026-06-19**).

---

## How to get and open the ODT

### Already in this repo

```
documentation/HMRC/sdst-evidence-pack/forms/CDS-Production-Checklist-v1.2.odt
```

Full path on your machine:

`c:\Users\jason\trader-app\documentation\HMRC\sdst-evidence-pack\forms\CDS-Production-Checklist-v1.2.odt`

### Open with

| App | Notes |
|-----|-------|
| **LibreOffice Writer** | Free — best for checkboxes |
| **Microsoft Word** | Opens ODT; checkboxes may need manual ☑ |
| **Google Docs** | Upload ODT → File → Open |

### If you need a fresh copy from HMRC

SDST usually attach this form when you request production credentials. You can also ask:

- **Email:** SDSTeam@HMRC.gov.uk
- **Subject:** CDS Production Checklist v1.2 — Freightcode sandbox testing complete

Keep the repo copy as your working file; save As before sending if you want a dated export.

### Return to SDST

- **To:** SDSTeam@HMRC.gov.uk
- **Attach:** completed `CDS-Production-Checklist-v1.2.odt`
- **Optional:** zip `documentation/HMRC/sdst-evidence-pack/evidence/` if they ask for raw XML (usually ODT fields are enough for Trade Test)

---

## Section 1 — Application details

| ODT field | Enter this |
|-----------|------------|
| **Organisation Name** | Freightcode |
| **Sandbox Application Name** | freightcode |
| **Sandbox Application ID** | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| **Production Application Name** | freightcode |
| **Production Application ID** | *Pending — credentials not yet issued* |
| **SaaS Based or On-Premise** | **SaaS** (Vercel + Convex) |
| **Push or Pull Notifications** | **Push** |
| **Production callback URL/s** | *TBD — stable HTTPS production URL (not ngrok). Sandbox used:* `https://cf94-62-31-164-236.ngrok-free.app/api/hmrc/webhooks/notify` |

---

## Section 2 — Rate limit

| ODT field | Enter this |
|-----------|------------|
| **3 rps** | ☑ tick |
| **8 rps** | ☐ leave blank |
| Questions 1–6 (above 8 rps) | Leave blank — not applicable |

---

## Section 3 — APIs in use

| API | Tick? | Evidence (TT = Trade Test sandbox) |
|-----|-------|--------------------------------------|
| Customs Declarations | ☑ | `evidence/02-submit/` through `06-file-upload/` |
| Customs Declarations Information | ☑ | `evidence/07-status-query/` |
| Customs Inventory Linking Exports | ☐ | N/A — not in product |
| Bulk Data File List | ☐ | N/A — not in product |

**§3 narrative:** Evidence is from **Trade Test v2.0** (Declarations `application/vnd.hmrc.2.0+xml`; Information `application/vnd.hmrc.1.0+xml`). Not TDR.

---

## Section 4 — Customs Declarations API

Tick **Yes** for each endpoint your product uses. Fill **Client ID / MRN / LRN / Timestamp** columns.

Use **Sandbox Application ID** as Client ID unless the form asks for OAuth client — then use `b74874e9-957e-4a40-b426-0cde839f8a45`.

### 4.1 Submit — `/customs/declarations` ☑

| Field | Value |
|-------|-------|
| Client ID | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| MRN | `26GB63M1I0RQFCVAR4` |
| LRN | `FC-MPYAJ7RN` |
| Timestamp | `2026-06-03T16:38:33Z` |
| Conversation ID | `68edb212-5c4a-4ef7-9223-f55630c5859e` |
| Outcome | DMSACC, 0 blocking errors; DMSTAX |

*Alternate submit (fresh run): MRN `26GB65EJN3BYSELAR9`, LRN `FC-MQ031D1B`, conv `c25b5658581e471a82022e43cd7e6ee2`.*

### 4.2 Cancel — `/customs/declarations/cancellation-requests` ☑

| Field | Value |
|-------|-------|
| Client ID | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| MRN | `26GB656DZN0FE7LAR0` |
| LRN | `FC-MPZUVPRD` (submit) / cancel LRN `CX-kn73a2vpts1b6j7tsfy7ct7mms832vkx` |
| Timestamp | `2026-06-04T18:56:06Z` |
| Conversation ID | `5a46d731-2020-4c95-810c-cc83b40d36a3` |
| Outcome | HTTP 202 → DMSINV FC02 (invalidation accepted) |

*Also valid:* `26GB65EJN3BYSELAR9`, conv `385cf335-9b53-40fd-8519-ce0eaa599761`, DMSINV `2026-06-04T23:53:57Z`.

### 4.3 File upload — `/customs/declarations/file-upload` ☑

| Field | Value |
|-------|-------|
| Client ID | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| MRN (DeclarationID) | `26GB664W3BLIFZFAR4` |
| LRN | — |
| Timestamp | `2026-06-05T13:47:40Z` |
| Conversation ID | `e8aba099-acee-438e-be25-2d4c713b9d99` |
| Outcome | HTTP 200; upload ref `218eaeb7-6639-408c-9907-328033abce6c` |

### 4.4 Amend — `/customs/declarations/amend` ☑

| Field | Value |
|-------|-------|
| Client ID | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| MRN | `26GB664W3BLIFZFAR4` |
| LRN | `FC-MQ0TDTJA` (submit) / amend `AM-kn7ce59qgf4szvq174agcnm4ns880s39` |
| Timestamp | `2026-06-05T11:12:02Z` |
| Conversation ID | `01382a81-5000-408f-9c99-5215852f5758` |
| Outcome | HTTP 202 → DMSRES FC07; VersionID 2; GBP 8000 |

### 4.5 Arrival notification — `/customs/declarations/arrival-notification` ☐

**Not in product scope** — leave unticked.

---

## Section 5.1 — Inventory Linking Exports

**N/A** — skip entire section.

---

## Section 5.2 — Customs Declarations Information

### Status by MRN — `/customs/declarations-information/mrn/{mrn}/status` ☑

| Field | Value |
|-------|-------|
| Client ID | `b74874e9-957e-4a40-b426-0cde839f8a45` |
| MRN | `26GB63M1I0RQFCVAR4` |
| Timestamp | `2026-06-04T14:40:59Z` |
| Conversation ID | `2a9e80a9-1b65-4541-8077-73d2492357f4` |
| Outcome | HTTP 200; ICS 22; Accept `application/vnd.hmrc.1.0+xml` |

### DUCR / UCR / Inventory reference status ☐

**Not used** — leave unticked.

---

## Section 5.3 — Bulk Data File List

**N/A** — skip.

---

## SS-GB checklist

`forms/SS-GB-Production-Application-Checklist-v2.3.odt` — **do not submit** (CDS-only product, no import ENS).

---

## Pre-send checklist

- [ ] All §4 endpoints you use are ticked with one MRN row each
- [ ] Production ID marked pending (not blank without explanation)
- [ ] Rate limit 3 rps ticked
- [ ] Push notifications + sandbox callback noted
- [ ] File saved as `CDS-Production-Checklist-v1.2-Freightcode.odt` (optional rename)
- [ ] Emailed to SDSTeam@HMRC.gov.uk before **2026-06-19**
