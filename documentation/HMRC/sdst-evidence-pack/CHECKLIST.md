# Master checklist — CDS production + optional SS-GB

Copy values from completed rows into `forms/CDS-Production-Checklist-v1.2-FILLED.odt`.  
Evidence files live in this pack only (`evidence/`).  
Regenerate ODT: `node test-evidence/fill-cds-odt.js` (LibreOffice closed).

**Legend:** `[x]` done · `[ ]` open · `[-]` not applicable

**SDST deadline:** email completed ODT by **2026-06-19** (14 days from last sandbox test 2026-06-05).

---

## CDS — Application & admin (`forms/CDS-Production-Checklist-v1.2-FILLED.odt`)

### §1 Application details → `evidence/01-application-details.md`

- [x] Organisation name — **Freightcode** (in ODT)
- [x] Sandbox application name + ID — **freightcode** / `b74874e9-957e-4a40-b426-0cde839f8a45`
- [x] Production application name — **freightcode**; ID **Pending** (in ODT)
- [x] Deployment model — **SaaS** (in ODT)
- [x] Notification model — **Push**; sandbox ngrok validated 2026-06-04
- [x] Production callback URL — `https://www.freightcode.co.uk/api/hmrc/webhooks/notify` (in ODT)

### §2 Rate limit

- [x] Selected **3 rps** (tick in ODT)

### §3 APIs in use

- [x] Customs Declarations API — tick + §4 evidence in ODT
- [x] Customs Declarations Information API — tick + §5.2 evidence in ODT
- [-] Customs Inventory Linking Exports — N/A (CDS-only product)
- [-] Bulk Data File List — N/A
- [x] Trade Test v2.0 evidence referenced in ODT (not TDR)

---

## CDS §4 — Customs Declarations API

| # | Endpoint | Status | Evidence folder / files |
|---|----------|--------|-------------------------|
| 4.1 | `POST /customs/declarations` (submit) | **[x]** | `evidence/02-submit/` — MRN `26GB63M1I0RQFCVAR4`, conv `68edb212-…` |
| 4.2 | `POST /customs/declarations/cancellation-requests` | **[x]** | `evidence/04-cancel/` — `26GB656DZN0FE7LAR0` DMSINV FC02 |
| 4.3 | `POST /customs/declarations/file-upload` (initiate) | **[x]** | `evidence/06-file-upload/` — conv `e8aba099-…`, ref `218eaeb7-…` |
| 4.4 | `POST /customs/declarations/amend` | **[x]** | `evidence/05-amend/` — `26GB664W3BLIFZFAR4` DMSRES FC07 |
| 4.5 | `POST /customs/declarations/arrival-notification` | **[-]** | Out of product scope |

All §4 rows ticked **Yes** with Client ID / MRN / LRN / timestamp / conversation ID in **FILLED.odt**.

---

## CDS §5 — Notifications & information

### Push / pull notifications

- [x] Push webhook configured (Developer Hub)
- [x] DMSACC + DMSTAX observed (`evidence/03-notifications/`) — **§5 satisfied for Push**
- [-] Pull notifications API — **N/A for this return** (ODT §1: **Push**; push evidence archived; pull is fallback in product only, not declared on checklist)

### §5.2 Customs Declarations Information

| Endpoint | Status | Evidence |
|----------|--------|----------|
| `GET .../mrn/{mrn}/status` | **[x]** | `evidence/07-status-query/` — ICS 22; in ODT |
| `GET .../ducr/{ducr}/status` | **[-]** | Not used |
| `GET .../ucr/{ucr}/status` | **[-]** | Not used |
| `GET .../inventory-reference/.../status` | **[-]** | Not used |

---

## CDS — Submit to SDST

- [x] `forms/CDS-Production-Checklist-v1.2-FILLED.odt` generated from **LOG.md** (`fill-cds-odt.js`)
- [ ] LibreOffice review — all **5 pages** checked before send
- [ ] Completed ODT emailed to **SDSTeam@HMRC.gov.uk** (by **2026-06-19**)

---

## SS-GB — `forms/SS-GB-Production-Application-Checklist-v2.3.odt`

**Entire section [-] unless Freightcode offers import ENS.**

- [-] §1–§6 ENS endpoints — skip for CDS-only product
- [-] Return SS-GB ODT to SDST — N/A

---

## Engineering gates (not on ODT — track before prod cutover)

Reference only; detail in `spec/pre-tdr-checklist.md`.

- [x] Notification status precedence — `tests/h1/`
- [x] CDS file-upload route wired to real HMRC API (`main` `10e7486`)
- [x] Fetch timeout + rate limiter wired (`hmrc-fetch.ts`)
- [ ] Cancel / amend / upload tested end-to-end in **app UI** (manual smoke)
- [ ] Production webhook registered in HMRC Developer Hub for prod URL

---

## Quick progress

| CDS ODT sections | Status |
|------------------|--------|
| §1 Admin | **Done** in FILLED.odt |
| §2 Rate limit | **Done** — 3 rps |
| §3 APIs | **Done** — Declarations + Information |
| §4 Endpoints | **Done** — submit, cancel, upload, amend |
| §5.2 Status | **Done** — MRN status |
| Email SDST | **Open** — review ODT, then send |

**Overall CDS pack readiness: ~95%** — LibreOffice review + email SDST by **2026-06-19**.
